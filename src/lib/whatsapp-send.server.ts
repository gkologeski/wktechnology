// Envio de WhatsApp para uso em contextos server-only (cron, régua de cobrança).
// Usa exclusivamente a API oficial da Meta (Cloud API), sem depender de um
// usuário autenticado.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  metaSend,
  normalizePhone,
  resolveWaNumber,
  findConversationNumber,
} from "@/lib/whatsapp/meta-channel.server";

export type WaSendResult = {
  ok: true;
  sid: string;
  status: string;
  from: string;
  to: string;
};

/**
 * Envia uma mensagem de WhatsApp (texto ou template aprovado) pela Meta.
 * Registra `whatsapp_conversations` + `whatsapp_messages` no workspace.
 * Lança erro em falhas — cabe ao chamador tratar e registrar no histórico.
 */
export async function sendWhatsAppFromServer(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  to: string;
  body: string;
  contactId?: string | null;
  /** Rótulo interno registrado no histórico (não é o template da Meta). */
  templateName?: string | null;
  /** Template aprovado na Meta, obrigatório fora da janela de 24h. */
  metaTemplate?: { name: string; language?: string; variables?: string[] } | null;
  source?: Record<string, unknown>;
}): Promise<WaSendResult> {
  const { supabase, workspaceId, to, body } = params;
  if (!to || (!body && !params.metaTemplate)) throw new Error("Destinatário ou mensagem vazios");

  const toBare = normalizePhone(to);
  const existing = await findConversationNumber(supabase, workspaceId, toBare);
  const num = await resolveWaNumber(workspaceId, existing?.phoneNumberId ?? null);

  const { wamid, raw } = await metaSend(num, {
    to: toBare,
    body,
    template: params.metaTemplate ?? null,
  });

  // Log da conversa + mensagem (best-effort; falhas não invalidam o envio real)
  try {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: workspaceId,
          workspace_id: workspaceId,
          contact_id: params.contactId ?? null,
          contact_phone: toBare,
          twilio_number: num.displayPhoneNumber,
          provider: "meta",
          wa_phone_number_id: num.phoneNumberId,
          last_message_at: new Date().toISOString(),
          last_message_preview: (
            body || `[template ${params.metaTemplate?.name ?? params.templateName ?? ""}]`
          ).slice(0, 120),
        },
        { onConflict: "contact_phone,twilio_number" },
      )
      .select("id")
      .single();

    if (conv?.id) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conv.id,
        owner_id: workspaceId,
        workspace_id: workspaceId,
        direction: "outbound",
        body,
        from_number: num.displayPhoneNumber,
        to_number: toBare,
        provider: "meta",
        wa_message_id: wamid,
        status: "sent",
        template_name: params.templateName ?? null,
        is_template: !!params.metaTemplate,
        sent_at: new Date().toISOString(),
        raw: { ...raw, source: params.source ?? { origin: "dunning" } },
      });
    }
  } catch (e) {
    console.warn("[whatsapp-send] log falhou (envio ok)", e);
  }

  return {
    ok: true,
    sid: wamid ?? "",
    status: "sent",
    from: num.displayPhoneNumber,
    to: toBare,
  };
}
