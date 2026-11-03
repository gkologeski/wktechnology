import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { TokenContext } from "@/lib/message-tokens";
import { renderRequiredTokens, usesEntityTokens } from "./variable-tokens";
import { validateEmailAddress } from "@/lib/email-address";
import { isValidE164 } from "@/lib/phone/e164";
import { pickUnsuppressedWhatsApp } from "@/lib/whatsapp/whatsapp-suppression";
import { SequenceNotStartedError } from "./runtime";
import { inspectSequenceTemplate } from "./preflight";
import type { RuntimeContext, SequencePorts } from "./worker.server";
import type { SequenceStep } from "./draft";
async function persistReceipt(
  admin: SupabaseClient,
  effect: import("./worker.server").EffectReservation,
  payload: Record<string, unknown>,
) {
  await workRpc(admin, "prospecting_sequence_receipt_store", {
    p_effect: effect.id,
    p_token: effect.token,
    p_payload: payload,
  });
  try {
    await workRpc(admin, "prospecting_sequence_delivery_commit", {
      p_effect: effect.id,
      p_token: effect.token,
      p_payload: payload,
    });
    return { receipt: String(payload.messageId), committed: true as const };
  } catch {
    // Receipt already committed. Keep the run paused for Inbox repair; never send again.
    return {
      receipt: String(payload.messageId),
      committed: true as const,
      projectionPending: true,
    };
  }
}
function assertReservedSource(
  effect: import("./worker.server").EffectReservation,
  ctx: RuntimeContext,
  sourceKey: string,
) {
  if (effect.sourceKey !== sourceKey || !effect.source)
    throw new SequenceNotStartedError("sender_changed_before_send");
  for (const key of ["email", "phones", "first_name", "last_name", "company_name"]) {
    if (
      JSON.stringify((effect.source as unknown as Record<string, unknown>)[key] ?? null) !==
      JSON.stringify((ctx.source as unknown as Record<string, unknown>)[key] ?? null)
    )
      throw new SequenceNotStartedError("source_changed_before_send");
  }
}
function requiredTokens(text: string, context: TokenContext) {
  return renderRequiredTokens(text, context as Record<string, unknown>);
}
async function tokenContext(
  admin: SupabaseClient,
  ctx: RuntimeContext,
  step: SequenceStep,
): Promise<TokenContext> {
  const { loadAgentContext } = await import("@/lib/message-tokens-agent.server");
  const source = ctx.source as RuntimeContext["source"] & {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
  const { loadEntityVariables } = await import("./variable-context.server");
  const texts =
    step.type === "email"
      ? [step.subject, step.body]
      : step.type === "whatsapp"
        ? Object.values(step.variables)
        : [];
  const entities = texts.some((t) => usesEntityTokens(t))
    ? await loadEntityVariables(admin, ctx.run.workspace_id, ctx.person)
    : {};
  return {
    ...source,
    ...entities,
    full_name: [source.first_name, source.last_name].filter(Boolean).join(" "),
    company: source.company_name,
    agent: await loadAgentContext(admin, ctx.run.owner_id),
  };
}
async function channelIdentity(
  admin: SupabaseClient,
  ctx: RuntimeContext,
  sourceKey: string,
  channel: "email" | "whatsapp",
  agentId: string | null,
) {
  if (!agentId) return;
  const { loadChannelRuntime } = await import("@/lib/prospecting/sdr/channel-runtime.server");
  const state = await loadChannelRuntime(admin, {
    workspaceId: ctx.run.workspace_id,
    channel,
    sourceKey,
    agentId,
    origin: "campaign",
  });
  if (state.status !== "active") throw new Error("Agente não está habilitado para esta conta.");
}
async function unsubscribeFooter(admin: SupabaseClient, ctx: RuntimeContext, email: string) {
  const address = email.toLowerCase();
  const read = () =>
    admin
      .from("email_unsubscribes")
      .select("token,reason")
      .eq("workspace_id", ctx.run.workspace_id)
      .eq("owner_id", ctx.run.owner_id)
      .eq("email", address)
      .maybeSingle();
  const existing = await read();
  if (existing.error) throw new Error("Não foi possível verificar o descadastro.");
  if (existing.data && existing.data.reason !== "__token__")
    throw new Error("Destinatário descadastrado.");
  let token = existing.data?.token;
  if (!token) {
    token = crypto.randomUUID().replaceAll("-", "");
    const inserted = await admin.from("email_unsubscribes").insert({
      workspace_id: ctx.run.workspace_id,
      owner_id: ctx.run.owner_id,
      email: address,
      token,
      reason: "__token__",
    });
    if (inserted.error) {
      const concurrent = await read();
      if (concurrent.error || !concurrent.data?.token || concurrent.data.reason !== "__token__")
        throw new Error("Não foi possível preparar o descadastro.");
      token = concurrent.data.token;
    }
  }
  const { publicAppOrigin } = await import("@/lib/runtime-config.server");
  return `\n\nPara não receber mais estes contatos: ${publicAppOrigin()}/api/public/email/unsubscribe/${encodeURIComponent(token)}`;
}
/** The caller provides handoff separately; there is no fallback to a generic/default assistant. */
export function sequenceDeliveryPorts(
  admin: SupabaseClient,
  handoff: SequencePorts["handoff"],
): SequencePorts {
  return {
    handoff,
    prepare: async (ctx, step) => {
      if (step.type === "call" && step.mode === "automatic") {
        const { prepareSequenceVoice } = await import("./voice.server");
        return prepareSequenceVoice(admin, ctx);
      }
      if (step.type === "call" || step.type === "task")
        return async (effect) => {
          const id = await workRpc<string>(admin, "prospecting_sequence_task_effect", {
            p_effect: effect.id,
            p_token: effect.token,
            p_lease: ctx.run.lease_token,
          });
          return { receipt: id, committed: true };
        };
      if (step.type !== "email" && step.type !== "whatsapp") throw new Error("Etapa não enviável.");
      const account = await workRpc<{ sourceKey: string }>(
        admin,
        "prospecting_sequence_delivery_access",
        { p_run: ctx.run.id, p_lease: ctx.run.lease_token },
      );
      const tokens = await tokenContext(admin, ctx, step);
      const agentId =
        (step.type === "whatsapp" ? step.agentId : null) || ctx.definition.settings.agentId;
      await channelIdentity(admin, ctx, account.sourceKey, step.type, agentId);
      if (step.type === "email") {
        const checked = validateEmailAddress(ctx.source.email);
        if (!checked.ok) throw new Error("Destinatário inválido.");
        const subject = requiredTokens(step.subject, tokens),
          body =
            requiredTokens(step.body, tokens) +
            (await unsubscribeFooter(admin, ctx, checked.value));
        const gmail = await import("@/lib/gmail.server");
        const row = await admin
          .from("email_accounts")
          .select(
            "id,workspace_id,owner_id,email,access_token,refresh_token,expires_at,status,history_id",
          )
          .eq("id", account.sourceKey)
          .eq("workspace_id", ctx.run.workspace_id)
          .eq("owner_id", ctx.run.owner_id)
          .eq("status", "connected")
          .maybeSingle();
        if (row.error || !row.data) throw new Error("Conta Gmail indisponível.");
        const mailbox = row.data as import("@/lib/gmail.server").EmailAccountRow;
        let threadId: string | undefined, inReplyTo: string | undefined;
        if (step.thread === "reply") {
          const reference = await workRpc<{ threadId: string; messageIdHeader: string }>(
            admin,
            "prospecting_sequence_reply_thread",
            { p_run: ctx.run.id, p_lease: ctx.run.lease_token, p_recipient: checked.value },
          );
          if (!reference?.threadId || !reference.messageIdHeader)
            throw new Error("Referência de resposta indisponível.");
          threadId = reference.threadId;
          inReplyTo = reference.messageIdHeader;
        }
        const accessToken = await gmail.ensureAccessToken(mailbox);
        gmail.buildRawMime({
          from: mailbox.email,
          to: [checked.value],
          subject,
          bodyText: body,
          messageId: "<sequence-preview@techerp.invalid>",
          ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
        });
        return async (effect) => {
          assertReservedSource(effect, ctx, account.sourceKey);
          await channelIdentity(admin, ctx, account.sourceKey, "email", agentId);
          const messageIdHeader = `<seq-${effect.id}@techerp.invalid>`;
          const raw = gmail.buildRawMime({
            from: mailbox.email,
            to: [checked.value],
            subject,
            bodyText: body,
            messageId: messageIdHeader,
            ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
          });
          const result = await gmail.gmailSendRaw(
            await gmail.ensureAccessToken(mailbox),
            raw,
            threadId,
          );
          return persistReceipt(admin, effect, {
            messageId: result.id,
            threadId: result.threadId,
            messageIdHeader,
            inReplyTo,
            from: mailbox.email,
            to: checked.value,
            subject,
            body,
          });
        };
      }
      // Mesmo número escolhido pelo worker: pula os bloqueados pela Meta (131026/131049).
      const phone = pickUnsuppressedWhatsApp(
        ctx.source.phones.filter((p): p is string => !!p && isValidE164(p)),
        ctx.suppressedPhones ?? new Map(),
      ).pick;
      if (phone.status !== "ok") throw new Error("WhatsApp inválido.");
      const { resolveWaNumber, metaSend, applyPositionalTemplate } =
        await import("@/lib/whatsapp/meta-channel.server");
      const { loadTemplateCatalog } = await import("@/lib/whatsapp/templates.server");
      const { describeTemplate } = await import("@/lib/whatsapp/template-shape");
      const number = await resolveWaNumber(ctx.run.workspace_id, account.sourceKey);
      if (number.provider !== "cloud") {
        const { getConnectedPhone } = await import("@/lib/whatsapp/gateway-channel.server");
        const info = await getConnectedPhone();
        if (info.id !== account.sourceKey || info.quality_rating === "RED")
          throw new Error("Número indisponível ou com qualidade baixa.");
      }
      const catalog = await loadTemplateCatalog(admin, ctx.run.workspace_id, {
        phoneNumberId: account.sourceKey,
      });
      const template =
        catalog.source === "provider"
          ? catalog.items.find(
              (t) =>
                t.name === step.templateName &&
                t.language === step.language &&
                t.status === "APPROVED",
            )
          : undefined;
      const variables = Object.fromEntries(
        Object.entries(step.variables).map(([key, value]) => [key, requiredTokens(value, tokens)]),
      );
      if (!template || inspectSequenceTemplate(step.id, template, variables).length)
        throw new Error("Modelo atual indisponível ou incompleto.");
      const shape = describeTemplate(template.components);
      const values = Array.from(
        { length: shape.variableCount },
        (_, i) => variables[String(i + 1)],
      );
      const body = applyPositionalTemplate(shape.body, values);
      return async (effect) => {
        assertReservedSource(effect, ctx, account.sourceKey);
        await channelIdentity(admin, ctx, account.sourceKey, "whatsapp", agentId);
        const result = await metaSend(number, {
          to: phone.e164,
          template: { name: template.name, language: template.language, variables: values },
        });
        if (!result.wamid) throw new Error("Resultado do envio desconhecido.");
        return persistReceipt(admin, effect, {
          messageId: result.wamid,
          from: number.displayPhoneNumber,
          to: phone.e164,
          body,
        });
      };
    },
  };
}
