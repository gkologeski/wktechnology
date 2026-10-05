import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export function applyTemplate(body: string, vars: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? "");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function findContactByPhone(supabase: any, phoneE164: string): Promise<string | null> {
  const noPlus = phoneE164.replace(/^\+/, "");
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .or(
      `phone.eq.${phoneE164},phone.eq.${noPlus},mobile_phone.eq.${phoneE164},mobile_phone.eq.${noPlus}`,
    )
    .maybeSingle();
  return data?.id ?? null;
}

// ---------- janela de atendimento de 24 horas ----------
export const getWhatsAppServiceWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ to: z.string().min(5) }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { findConversationNumber, isWithinServiceWindow } =
      await import("@/lib/whatsapp/meta-channel.server");
    const existing = await findConversationNumber(
      context.supabase,
      workspaceId,
      normalizePhone(data.to),
    );
    const lastInboundAt = existing?.lastInboundAt ?? null;
    return { withinWindow: isWithinServiceWindow(lastInboundAt), lastInboundAt };
  });

// ---------- send (API oficial da Meta) ----------
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        to: z.string().min(5),
        body: z.string().max(4096).optional().default(""),
        contactId: z.string().uuid().optional(),
        mediaUrl: z.string().url().optional(),
        mediaContentType: z.string().max(120).optional(),
        templateName: z.string().optional(),
        templateLanguage: z.string().max(10).optional(),
        templateVariables: z.array(z.string().max(1024)).max(20).optional(),
        contextMessageId: z.string().max(200).optional(),
      })
      .refine((v) => v.body.trim().length > 0 || !!v.mediaUrl || !!v.templateName, {
        message: "Informe um texto, anexo ou template aprovado",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await (await import("@/lib/view-as-guard.server")).assertNotReadOnlyView(context.supabase);
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { resolveWaNumber, metaSend, findConversationNumber, isWithinServiceWindow } =
      await import("@/lib/whatsapp/meta-channel.server");

    const toBare = normalizePhone(data.to);
    const existing = await findConversationNumber(supabase, workspaceId, toBare);

    if (!isWithinServiceWindow(existing?.lastInboundAt) && !data.templateName) {
      return {
        ok: false as const,
        code: "TEMPLATE_REQUIRED" as const,
        error:
          "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar.",
        sid: "",
        conversationId: "",
      };
    }

    if (data.templateName) {
      let templateQuery = supabase
        .from("wa_templates")
        .select("name, language")
        .eq("workspace_id", workspaceId)
        .eq("name", data.templateName)
        .eq("status", "APPROVED");
      if (data.templateLanguage)
        templateQuery = templateQuery.eq("language", data.templateLanguage);
      const { data: approvedTemplate, error: templateError } = await templateQuery
        .limit(1)
        .maybeSingle();
      if (templateError || !approvedTemplate) {
        return {
          ok: false as const,
          code: "TEMPLATE_NOT_APPROVED" as const,
          error: "Este modelo não está aprovado pela Meta. Escolha outro modelo aprovado.",
          sid: "",
          conversationId: "",
        };
      }
    }
    let num: Awaited<ReturnType<typeof resolveWaNumber>>;
    try {
      num = await resolveWaNumber(workspaceId, existing?.phoneNumberId ?? null);
    } catch (e) {
      // Estado esperado (sem número conectado): resultado tipado em vez de erro de runtime.
      return {
        ok: false as const,
        code: "CHANNEL_UNAVAILABLE" as const,
        error: (e as Error).message,
        sid: "",
        conversationId: "",
      };
    }

    // Resolve contato pelo telefone se não informado
    let contactId = data.contactId ?? null;
    if (!contactId) {
      contactId = await findContactByPhone(supabase, toBare);
    }

    const preview =
      (data.body && data.body.slice(0, 120)) ||
      (data.mediaUrl ? "[mídia]" : data.templateName ? `[template ${data.templateName}]` : "");

    // Grava/atualiza a conversa ANTES do envio. Conversas criadas pelo sistema
    // (webhook) são atualizadas por id; novas são criadas com o usuário como dono (RLS).
    const nowIso = new Date().toISOString();
    const { data: found, error: fErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, contact_id")
      .eq("workspace_id", workspaceId)
      .eq("contact_phone", toBare)
      .eq("twilio_number", num.displayPhoneNumber)
      .maybeSingle();
    if (fErr) throw new Error("Não foi possível localizar a conversa do WhatsApp.");
    let conversationId = found?.id as string | undefined;
    if (!conversationId) {
      const { data: created, error: iErr } = await supabase
        .from("whatsapp_conversations")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          contact_id: contactId,
          contact_phone: toBare,
          twilio_number: num.displayPhoneNumber,
          provider: "meta",
          wa_phone_number_id: num.phoneNumberId,
          last_message_at: nowIso,
          last_message_preview: preview,
        })
        .select("id")
        .single();
      if (iErr || !created)
        throw new Error("Não foi possível registrar a conversa do WhatsApp. Mensagem não enviada.");
      conversationId = created.id as string;
    }
    const conv = { id: conversationId };

    const { wamid, raw } = await metaSend(num, {
      to: toBare,
      body: data.body,
      mediaUrl: data.mediaUrl,
      mediaContentType: data.mediaContentType,
      template: data.templateName
        ? {
            name: data.templateName,
            language: data.templateLanguage,
            variables: data.templateVariables ?? [],
          }
        : null,
      contextMessageId: data.contextMessageId,
    });

    if (found) {
      // Melhor esforço: membros sem permissão de edição não bloqueiam o envio já feito.
      const { error: uErr } = await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: nowIso,
          last_message_preview: preview,
          ...(found.contact_id ? {} : { contact_id: contactId }),
        })
        .eq("id", conv.id);
      if (uErr) console.warn("[whatsapp] atualização da conversa ignorada", uErr.code);
    }

    const { error: mErr } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      owner_id: userId,
      workspace_id: workspaceId,
      direction: "outbound",
      body: data.body,
      media_url: data.mediaUrl ?? null,
      media_content_type: data.mediaContentType ?? null,
      from_number: num.displayPhoneNumber,
      to_number: toBare,
      provider: "meta",
      wa_message_id: wamid,
      context_message_id: data.contextMessageId ?? null,
      status: "accepted",
      template_name: data.templateName ?? null,
      is_template: !!data.templateName,
      sent_by: userId,
      sent_at: nowIso,
      raw,
    });
    if (mErr)
      throw new Error(
        "Mensagem enviada ao WhatsApp, mas não foi possível registrá-la no histórico.",
      );

    if (contactId) {
      await supabase.from("activities").insert({
        owner_id: workspaceId,
        type: "whatsapp",
        related_contact_id: contactId,
        subject: data.templateName ? `WhatsApp · ${data.templateName}` : "WhatsApp enviado",
        body: data.body || preview,
        email_direction: "outbound",
        completed: true,
        outcome: "sent",
        outcome_set_at: new Date().toISOString(),
        external_ids: { wa_message_id: wamid, conversation_id: conv.id },
      });
    }

    return { ok: true as const, error: null, sid: wamid ?? "", conversationId: conv.id as string };
  });

// ---------- list conversations ----------
export const listWhatsAppConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select(
        "id, contact_id, lead_id, identity_status, contact_phone, twilio_number, provider, wa_phone_number_id, last_inbound_at, last_message_at, last_message_preview, unread_count, status, assigned_to",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ---------- list messages ----------
export const listWhatsAppMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, direction, body, media_url, media_content_type, status, created_at, sent_at, delivered_at, read_at, wa_message_id, template_name, is_template",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return rows ?? [];
  });

// ---------- mark conversation read ----------
export const markWhatsAppRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw error;

    // Confirma a leitura na Meta (best-effort) usando a última mensagem recebida.
    try {
      const { data: last } = await supabase
        .from("whatsapp_messages")
        .select("wa_message_id")
        .eq("conversation_id", data.conversationId)
        .eq("direction", "inbound")
        .not("wa_message_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("wa_phone_number_id")
        .eq("id", data.conversationId)
        .maybeSingle();
      if (last?.wa_message_id) {
        const workspaceId = await resolveActiveWorkspace(userId);
        const { resolveWaNumber, metaMarkRead } =
          await import("@/lib/whatsapp/meta-channel.server");
        const num = await resolveWaNumber(workspaceId, conv?.wa_phone_number_id ?? null);
        await metaMarkRead(num, last.wa_message_id as string);
      }
    } catch {
      // leitura na Meta é opcional; a caixa de entrada continua consistente
    }
    return { ok: true };
  });

// ---------- números conectados (configuração) ----------
export const getWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: numbers } = await supabase
      .from("wa_phone_numbers")
      .select("phone_number_id, display_phone_number, verified_name, quality_rating, is_default")
      .eq("workspace_id", workspaceId)
      .order("is_default", { ascending: false });
    const list = numbers ?? [];
    const def = list.find((n: any) => n.is_default) ?? list[0] ?? null;
    return {
      provider: "meta" as const,
      connected: list.length > 0,
      numbers: list as {
        phone_number_id: string;
        display_phone_number: string;
        verified_name: string | null;
        quality_rating: string | null;
        is_default: boolean;
      }[],
      default_phone_number_id: def?.phone_number_id ?? null,
      effective_from: def ? normalizePhone(def.display_phone_number) : "",
    };
  });

export const saveWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ default_phone_number_id: z.string().min(3).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error: clearErr } = await supabase
      .from("wa_phone_numbers")
      .update({ is_default: false })
      .eq("workspace_id", workspaceId);
    if (clearErr) throw clearErr;
    const { error } = await supabase
      .from("wa_phone_numbers")
      .update({ is_default: true })
      .eq("workspace_id", workspaceId)
      .eq("phone_number_id", data.default_phone_number_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- assignment ----------
export const listAssignableMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: members } = await supabase
      .from("team_members")
      .select("member_user_id")
      .eq("workspace_owner_id", workspaceId);
    const ids = new Set<string>([userId, ...(members ?? []).map((m: any) => m.member_user_id)]);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(ids));
    return (profs ?? []) as { id: string; full_name: string | null }[];
  });

export const assignWhatsAppConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        assignedTo: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.assignedTo) {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("user_id, status")
        .eq("workspace_id", workspaceId)
        .eq("user_id", data.assignedTo)
        .neq("status", "inactive")
        .maybeSingle();
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("created_by")
        .eq("id", workspaceId)
        .maybeSingle();
      if (!member && workspace?.created_by !== data.assignedTo) {
        throw new Error("Selecione um membro ativo deste workspace.");
      }
    }
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.conversationId)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const setWhatsAppConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["open", "closed", "snoozed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- templates aprovados na Meta ----------
export const listWhatsAppTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("wa_templates")
      .select("name, language, status, components")
      .eq("workspace_id", workspaceId)
      .eq("status", "APPROVED")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((t: any) => {
      const comps = Array.isArray(t.components) ? t.components : [];
      const bodyComp = comps.find((c: any) => String(c?.type ?? "").toUpperCase() === "BODY") as
        | { text?: string }
        | undefined;
      const body = bodyComp?.text ?? "";
      const variableCount = Array.from(body.matchAll(/\{\{(\d+)\}\}/g))
        .map((m) => Number(m[1]))
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        name: t.name as string,
        language: (t.language as string) ?? "pt_BR",
        status: (t.status as string) ?? "PENDING",
        approved: String(t.status ?? "").toUpperCase() === "APPROVED",
        body,
        variableCount,
      };
    });
  });
