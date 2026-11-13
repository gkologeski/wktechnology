// Registra a ligação de voz na conversa da Inbox do Lead/Contato (mesma
// conversa do WhatsApp quando o número é o mesmo). Chamado só pelo retorno
// autenticado da Vapi; uma linha por ligação (índice único por call_attempt_id).
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { formatSlotPt } from "@/lib/prospecting/sdr/tools/scheduling";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";
import { buildCallInboxBody, CALL_PREFIX } from "./call-inbox";

export async function recordCallInInbox(attemptId: string): Promise<{ status: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any;
  const { data: att } = await sb
    .from("prospecting_call_attempts")
    .select(
      "id, workspace_id, campaign_id, followup_campaign_id, lead_id, contact_id, script_id, status, duration_seconds, summary, transcript, recording_url, meeting_status, meeting_start_at, ended_at",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!att || (!att.lead_id && !att.contact_id)) return { status: "skip" };
  const { data: dup } = await sb
    .from("whatsapp_messages")
    .select("id")
    .eq("call_attempt_id", attemptId)
    .maybeSingle();
  if (dup) return { status: "exists" };

  const table = att.contact_id ? "contacts" : "leads";
  const targetId = (att.contact_id ?? att.lead_id) as string;
  const campaignId = att.campaign_id ?? att.followup_campaign_id;
  if (campaignId) {
    try {
      await assertSalesWorker(sb, "prospecting_campaigns", campaignId, [{ table, id: targetId }]);
    } catch {
      return { status: "skip" };
    }
  }
  const { data: row } = await sb
    .from(table)
    .select(att.contact_id ? "phone, mobile_phone, whatsapp_e164" : "phone, whatsapp_e164")
    .eq("id", targetId)
    .eq("workspace_id", att.workspace_id)
    .maybeSingle();
  const phone = row?.whatsapp_e164 || row?.mobile_phone || row?.phone;
  if (!phone) return { status: "skip" };

  const { normalizePhone, findConversationNumber, resolveWaNumber } =
    await import("@/lib/whatsapp/meta-channel.server");
  const to = normalizePhone(phone);
  const existing = await findConversationNumber(sb, att.workspace_id, to);
  let followupSender: string | null = null;
  if (campaignId) {
    const { data: c } = await sb
      .from("prospecting_campaigns")
      .select("followup_sender_phone_number_id")
      .eq("id", campaignId)
      .maybeSingle();
    followupSender = c?.followup_sender_phone_number_id ?? null;
  }
  let num: { displayPhoneNumber: string; phoneNumberId: string };
  try {
    num = await resolveWaNumber(att.workspace_id, existing?.phoneNumberId ?? followupSender);
  } catch {
    return { status: "no_whatsapp_number" };
  }
  let scriptName: string | null = null;
  if (att.script_id) {
    const { data: s } = await sb
      .from("prospecting_scripts")
      .select("name")
      .eq("id", att.script_id)
      .maybeSingle();
    scriptName = s?.name ?? null;
  }
  const body = buildCallInboxBody({
    status: att.status,
    duration_seconds: att.duration_seconds,
    script_name: scriptName,
    summary: att.summary,
    transcript: att.transcript,
    meeting_when:
      att.meeting_status === "booked" && att.meeting_start_at
        ? formatSlotPt(Date.parse(att.meeting_start_at), DEFAULT_TIME_ZONE)
        : null,
  });
  const at = att.ended_at ?? new Date().toISOString();
  const { data: conv, error: convErr } = await sb
    .from("whatsapp_conversations")
    .upsert(
      {
        owner_id: att.workspace_id,
        workspace_id: att.workspace_id,
        contact_phone: to,
        twilio_number: num.displayPhoneNumber,
        provider: "meta",
        wa_phone_number_id: num.phoneNumberId,
        last_message_at: at,
        last_message_preview: `${CALL_PREFIX} · ${(att.summary ?? "").slice(0, 90)}`,
      },
      { onConflict: "contact_phone,twilio_number" },
    )
    .select("id")
    .single();
  if (convErr || !conv?.id) return { status: "failed" };
  const { ensureWhatsAppConversationIdentity } =
    await import("@/lib/inbox/identity-resolution.server");
  await ensureWhatsAppConversationIdentity(sb, conv.id, {}).catch(() => null);
  const { error } = await sb.from("whatsapp_messages").insert({
    conversation_id: conv.id,
    owner_id: att.workspace_id,
    workspace_id: att.workspace_id,
    direction: "outbound",
    body,
    media_url: att.recording_url ?? null,
    media_content_type: att.recording_url ? "audio/wav" : null,
    from_number: num.displayPhoneNumber,
    to_number: to,
    provider: "voice",
    // Situação própria: não é envio do WhatsApp (sem aviso de falha de entrega).
    status: "call",
    sent_at: at,
    call_attempt_id: attemptId,
    raw: { source: { origin: "voice_call", attempt_id: attemptId } },
  });
  // Corrida entre retornos: índice único impede a segunda linha.
  if (error && !String(error.code).startsWith("23505")) return { status: "failed" };
  return { status: "recorded" };
}
