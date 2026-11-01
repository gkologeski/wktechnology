// WhatsApp de apoio após a ligação do agente de voz (server-only).
// Chamado pelo retorno da Vapi. Envia no máximo uma mensagem por tentativa
// (reserva atômica em followup_status), respeita descadastro e a janela de 24 h.
import { chooseFollowup, followupUsesTemplate } from "@/lib/prospecting-call-followup";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function sendCallFollowup(attemptId: string): Promise<{ status: string }> {
  const sb = await sbAdmin();
  const { data: att } = await sb
    .from("prospecting_call_attempts")
    .select("id, workspace_id, campaign_id, followup_campaign_id, lead_id, status, ended_reason, followup_status")
    .eq("id", attemptId)
    .maybeSingle();
  if (!att || att.followup_status) return { status: "skip" };
  const kind = chooseFollowup(att.status, att.ended_reason);
  if (!kind) return { status: "skip" };
  const campaignId = att.campaign_id ?? att.followup_campaign_id;
  if (!campaignId || !att.lead_id) return { status: "skip" };

  const { data: camp } = await sb
    .from("prospecting_campaigns")
    .select("id, workspace_id, followup_enabled, followup_sender_phone_number_id, followup_template_name, followup_template_language, followup_answered_text")
    .eq("id", campaignId)
    .eq("workspace_id", att.workspace_id)
    .maybeSingle();
  if (!camp?.followup_enabled || !camp.followup_template_name) return { status: "skip" };

  // Reserva: só uma execução passa (status-update e end-of-call-report chegam ambos).
  const { data: claimed } = await sb
    .from("prospecting_call_attempts")
    .update({ followup_status: "sending" })
    .eq("id", attemptId)
    .is("followup_status", null)
    .select("id");
  if (!claimed?.length) return { status: "skip" };

  const finish = async (status: string, error?: string) => {
    await sb
      .from("prospecting_call_attempts")
      .update({
        followup_status: status,
        followup_error: error ?? null,
        followup_sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", attemptId);
    return { status };
  };

  try {
    const { data: lead } = await sb
      .from("leads")
      .select("id, first_name, phone")
      .eq("id", att.lead_id)
      .eq("workspace_id", att.workspace_id)
      .maybeSingle();
    if (!lead?.phone) return finish("skipped", "Lead sem telefone");
    const { normalizePhone, findConversationNumber, isWithinServiceWindow } =
      await import("@/lib/whatsapp/meta-channel.server");
    const to = normalizePhone(lead.phone);
    const { brPhoneVariants } = await import("@/lib/whatsapp/phone-variants");
    const opt = await sb
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", att.workspace_id)
      .in("contact_phone", brPhoneVariants(to))
      .not("opted_out_at", "is", null)
      .limit(1);
    if (opt.error) return finish("failed", "Não foi possível verificar descadastro");
    if (opt.data?.length) return finish("skipped", "Contato descadastrado");

    // Quem executa a campanha precisa continuar com acesso ao lead e às campanhas.
    try {
      await assertSalesWorker(sb, "prospecting_campaigns", campaignId, [
        { table: "leads", id: att.lead_id },
        { resource: "techsales.marketing.campaigns", action: "create" },
      ]);
    } catch {
      return finish("skipped", "Sem permissão atual para enviar WhatsApp");
    }
    const existing = await findConversationNumber(sb, att.workspace_id, to);
    const answeredText = String(camp.followup_answered_text ?? "").trim();
    const useTemplate = followupUsesTemplate(
      kind,
      isWithinServiceWindow(existing?.lastInboundAt),
      answeredText.length > 0,
    );
    const firstName = String(lead.first_name ?? "").trim() || "tudo bem";
    const { metaSend, resolveWaNumber } = await import("@/lib/whatsapp/meta-channel.server");
    const num = await resolveWaNumber(
      att.workspace_id,
      camp.followup_sender_phone_number_id ?? existing?.phoneNumberId ?? null,
    );
    const body = useTemplate ? "" : answeredText.replaceAll("{{lead.name}}", firstName);
    const { wamid, raw } = await metaSend(num, {
      to,
      body,
      template: useTemplate
        ? {
            name: camp.followup_template_name,
            language: camp.followup_template_language ?? "pt_BR",
            variables: [firstName],
          }
        : null,
    });
    // Registro na conversa (best-effort; o envio já aconteceu).
    try {
      const { data: conv } = await sb
        .from("whatsapp_conversations")
        .upsert(
          {
            owner_id: att.workspace_id,
            workspace_id: att.workspace_id,
            contact_phone: to,
            twilio_number: num.displayPhoneNumber,
            provider: "meta",
            wa_phone_number_id: num.phoneNumberId,
            last_message_at: new Date().toISOString(),
            last_message_preview: (body || `[template ${camp.followup_template_name}]`).slice(0, 120),
          },
          { onConflict: "contact_phone,twilio_number" },
        )
        .select("id")
        .single();
      if (conv?.id) {
        const { ensureWhatsAppConversationIdentity } =
          await import("@/lib/inbox/identity-resolution.server");
        await ensureWhatsAppConversationIdentity(sb, conv.id, {}).catch(() => null);
        await sb.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          owner_id: att.workspace_id,
          workspace_id: att.workspace_id,
          direction: "outbound",
          body,
          from_number: num.displayPhoneNumber,
          to_number: to,
          provider: "meta",
          wa_message_id: wamid,
          status: "accepted",
          template_name: useTemplate ? camp.followup_template_name : null,
          is_template: useTemplate,
          sent_at: new Date().toISOString(),
          raw: { ...raw, source: { origin: "voice_call_followup", attempt_id: attemptId, kind } },
        });
      }
    } catch (e) {
      console.warn("[call-followup] registro falhou (envio ok)", e);
    }
    return finish("sent");
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "erro";
    console.error("[call-followup]", attemptId, msg);
    return finish("failed", msg);
  }
}
