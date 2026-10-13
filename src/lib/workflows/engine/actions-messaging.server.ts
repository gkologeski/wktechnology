import { workspaceOfSource } from "@/lib/workspace-source.server";
import { withWorkflowWorkspace } from "./workspace-payload";
// Ações de mensagem e integrações: notificação, e-mail, WhatsApp, Slack, Teams,
// webhook e inclusão em cadência. Extraído sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toStr } from "../render-tokens";
import { type LogStep, notificationLinkFor, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleMessagingAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "add_to_sequence": {
      const sequenceWorkspace = await workspaceOfSource(supabase, "sequences", action.sequence_id);
      if (sequenceWorkspace !== ctx.workspaceId)
        throw new Error("Sequência fora da empresa do fluxo.");
      const { error } = await supabase.from("sequence_enrollments").insert(
        withWorkflowWorkspace(ctx, {
          owner_id: ctx.ownerId,
          sequence_id: action.sequence_id,
          entity_id: ctx.entityId,
          status: "active",
          next_run_at: new Date().toISOString(),
        }) as never,
      );
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "add_to_sequence",
        detail: { sequence_id: action.sequence_id },
      };
    }
    case "send_notification": {
      const title = renderTokens(action.title, ctx.after) as string;
      const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
      const targetUserId = action.user_id?.trim() ? action.user_id : ctx.ownerId;
      const link = notificationLinkFor(ctx.entity, ctx.entityId);
      const { error } = await supabase.from("notifications").insert({
        owner_id: ctx.ownerId,
        user_id: targetUserId,
        type: "workflow",
        title,
        body,
        link,
        entity: ctx.entity,
        entity_id: ctx.entityId,
      } as never);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "send_notification",
        detail: { title, user_id: targetUserId },
      };
    }
    case "webhook": {
      const payload = action.payload
        ? JSON.parse(toStr(renderTokens(JSON.stringify(action.payload), ctx.after)))
        : { entity: ctx.entity, entity_id: ctx.entityId, after: ctx.after };
      const res = await fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
      return { at, ok: true, action: "webhook", detail: { url: action.url, status: res.status } };
    }
    case "send_email": {
      const toField = action.to_field || "email";
      const to = (ctx.after?.[toField] as string | null) ?? null;
      if (!to) throw new Error(`sem destinatário em ${toField}`);
      let subject = action.subject;
      let body = action.body;
      if (action.template_id) {
        const { data: tpl } = await supabase
          .from("email_templates")
          .select("subject, body_html, body_text")
          .eq("id", action.template_id)
          .maybeSingle();
        if (tpl) {
          subject = (tpl.subject as string) || subject;
          body = (tpl.body_html as string) || (tpl.body_text as string) || body;
        }
      }
      subject = renderTokens(subject, ctx.after) as string;
      body = renderTokens(body, ctx.after) as string;
      const { error } = await supabase.from("email_messages").insert(
        withWorkflowWorkspace(ctx, {
          owner_id: ctx.ownerId,
          direction: "outbound",
          to_emails: [to],
          subject,
          body_html: body,
          body_text: body.replace(/<[^>]+>/g, ""),
        }) as never,
      );
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "send_email", detail: { to, subject, queued: true } };
    }
    case "send_whatsapp": {
      const toField = action.to_field || "phone";
      const to = (ctx.after?.[toField] as string | null) ?? null;
      if (!to) throw new Error(`sem destinatário em ${toField}`);
      const { validateWhatsAppStep, whatsAppIdempotencyKey } = await import(
        "../whatsapp-step"
      );
      const { loadApprovedTemplates } = await import("@/lib/whatsapp/templates.server");
      // Revalida no fornecedor no momento do envio: modelo pode ter sido pausado.
      const catalog = await loadApprovedTemplates(supabase, ctx.workspaceId);
      const issue = validateWhatsAppStep(action, catalog);
      if (issue) throw new Error(issue.message);
      const template = action.template_name!.trim();
      const variables = (action.template_variables ?? []).map((v) =>
        toStr(renderTokens(v, ctx.after, ctx.vars)),
      );
      const key = whatsAppIdempotencyKey({
        workspaceId: ctx.workspaceId,
        runId: ctx.runId,
        entityId: ctx.entityId,
        template,
        to,
      });
      if (key) {
        const { data: prior } = await supabase
          .from("whatsapp_messages")
          .select("id, status")
          .eq("workspace_id", ctx.workspaceId)
          .eq("raw->source->>idempotency_key", key)
          .limit(1);
        if (prior && prior.length > 0)
          return {
            at,
            ok: true,
            action: "send_whatsapp",
            detail: { to, template, skipped: "already_sent" },
          };
      }
      const { sendWhatsAppFromServer } = await import("@/lib/whatsapp-send.server");
      const res = await sendWhatsAppFromServer({
        supabase,
        workspaceId: ctx.workspaceId,
        to,
        body: "",
        contactId: ctx.entity === "contacts" ? ctx.entityId : null,
        templateName: template,
        metaTemplate: { name: template, language: action.template_language, variables },
        source: {
          origin: "workflow",
          workflow_id: ctx.workflowId ?? null,
          run_id: ctx.runId ?? null,
          idempotency_key: key,
        },
      });
      return {
        at,
        ok: true,
        action: "send_whatsapp",
        detail: { to: res.to, template, provider_id: res.sid, status: res.status },
      };
    }
    case "send_slack": {
      const { data: integ } = await supabase
        .from("slack_integrations")
        .select("access_token, default_channel_id")
        .eq("owner_id", ctx.ownerId)
        .maybeSingle();
      if (!integ) throw new Error("Slack não conectado neste workspace");
      const channel = action.channel?.trim() || (integ.default_channel_id as string | null);
      if (!channel) throw new Error("Canal do Slack não informado e sem canal padrão");
      const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${integ.access_token}`,
        },
        body: JSON.stringify({ channel, text }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(`Slack: ${json.error ?? res.status}`);
      return { at, ok: true, action: "send_slack", detail: { channel } };
    }
    case "send_teams": {
      const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
      const title = action.title
        ? (renderTokens(action.title, ctx.after, ctx.vars) as string)
        : undefined;
      // Microsoft Teams Incoming Webhook aceita MessageCard simples.
      const body = title ? { title, text } : { text };
      const res = await fetch(action.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Teams respondeu ${res.status}`);
      return { at, ok: true, action: "send_teams", detail: { title } };
    }
    default:
      return null;
  }
}
