import type { NotificationAdapterDependencies } from "./delivery-adapters.server";
import { NOTIFICATION_UPDATE_TEXT } from "./delivery-content";
import { notificationDeliveryJobSchema, type NotificationDeliveryJob } from "./delivery-types";
import { normalizePhone } from "@/lib/phone/e164";

/** Internal service boundary: source snapshots cannot become arbitrary history writes. */
export function assertNotificationRuntimeJob(input: NotificationDeliveryJob) {
  const job = notificationDeliveryJobSchema.parse(input);
  if (job.channel !== "whatsapp") throw new Error("Entrega WhatsApp inválida.");
  const normalized = normalizePhone(job.phone);
  if (
    normalized.status !== "valid" ||
    normalized.extension ||
    normalized.e164 !== job.phone ||
    !/^\d{5,30}$/.test(job.senderPhoneNumberId ?? "") ||
    !job.connectionId
  )
    throw new Error("Entrega WhatsApp inválida.");
  return job;
}

/** Lazy runtime imports prevent pure adapter tests from initializing provider configuration. */
export const notificationAdapterDependencies: NotificationAdapterDependencies = {
  appOrigin: async () => (await import("@/lib/email-tracking.server")).trackingBaseUrl(),
  managedEmailConfigured: () => Boolean(process.env.LOVABLE_API_KEY),
  sendEmail: async (input) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTransactionalEmailFromServer } = await import("@/lib/email-send.server");
    return sendTransactionalEmailFromServer({
      ...input,
      throwOnError: true,
      supabase: supabaseAdmin,
    });
  },
  readCloudSender: async (workspaceId, senderId) => {
    const { resolveCloudNumber } = await import("@/lib/whatsapp/cloud-runtime.server");
    const number = await resolveCloudNumber(workspaceId, senderId);
    if (!number) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cached = await (supabaseAdmin as any)
      .from("wa_cloud_numbers")
      .select("quality_rating,status")
      .eq("workspace_id", workspaceId)
      .eq("phone_number_id", senderId)
      .maybeSingle();
    if (cached.error) throw new Error("Remetente indisponível.");
    return {
      ...number,
      qualityRating: cached.data?.quality_rating ?? null,
      status: cached.data?.status ?? null,
    };
  },
  readCloudTemplates: async (workspaceId, senderId) =>
    (await import("@/lib/whatsapp/cloud-runtime.server")).cloudTemplates(workspaceId, senderId),
  isWhatsAppSuppressed: async (workspaceId, phone) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { brPhoneVariants } = await import("@/lib/whatsapp/phone-variants");
    const { suppressionKey, activeSuppressions } =
      await import("@/lib/whatsapp/whatsapp-suppression");
    const optedOut = await supabaseAdmin
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("contact_phone", brPhoneVariants(phone))
      .not("opted_out_at", "is", null)
      .limit(1);
    const key = suppressionKey(phone);
    const suppressed = await supabaseAdmin
      .from("whatsapp_number_suppressions")
      .select("phone_key,reason,expires_at,released_at")
      .eq("workspace_id", workspaceId)
      .eq("phone_key", key);
    if (optedOut.error || suppressed.error) throw new Error("Supressão indisponível.");
    return Boolean(
      optedOut.data?.length || activeSuppressions((suppressed.data ?? []) as never).get(key),
    );
  },
  sendCloud: async (workspaceId, senderId, body, authorizeBeforePost, validateTemplate) => {
    if (typeof authorizeBeforePost !== "function")
      throw new Error("Autorização de envio indisponível.");
    if (typeof validateTemplate !== "function")
      throw new Error("Validação do modelo indisponível.");
    return (await import("@/lib/whatsapp/cloud-runtime.server")).sendCloudPayload(
      workspaceId,
      senderId,
      body,
      { beforeSend: authorizeBeforePost, validateTemplate },
    );
  },
  recordWhatsAppRefusal: async (input, code) => {
    const job = assertNotificationRuntimeJob(input);
    if (code !== "131026" && code !== "131049") throw new Error("Recusa de destinatário inválida.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("wa_record_suppression", {
      p_ws: job.workspaceId,
      p_phone: job.phone,
      p_code: code,
      p_at: new Date().toISOString(),
    });
    if (error) throw new Error("Supressão indisponível.");
  },
  recordWhatsAppAcceptance: async (input, sender, providerId) => {
    const job = assertNotificationRuntimeJob(input);
    if (
      sender.provider !== "cloud" ||
      sender.workspaceId !== job.workspaceId ||
      sender.phoneNumberId !== job.senderPhoneNumberId ||
      sender.connectionId !== job.connectionId ||
      !providerId.trim()
    )
      throw new Error("Aceitação WhatsApp inválida.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const readConversation = () =>
      admin
        .from("whatsapp_conversations")
        .select("id,provider,wa_phone_number_id")
        .eq("workspace_id", job.workspaceId)
        .eq("contact_phone", job.phone)
        .eq("twilio_number", sender.displayPhoneNumber)
        .maybeSingle();
    let conversation = await readConversation();
    if (conversation.error) throw new Error("Histórico indisponível.");
    if (!conversation.data) {
      const created = await admin.from("whatsapp_conversations").upsert(
        {
          owner_id: job.workspaceId,
          workspace_id: job.workspaceId,
          contact_phone: job.phone,
          twilio_number: sender.displayPhoneNumber,
          provider: "meta",
          wa_phone_number_id: sender.phoneNumberId,
          last_message_at: now,
          last_message_preview: NOTIFICATION_UPDATE_TEXT,
        },
        { onConflict: "contact_phone,twilio_number", ignoreDuplicates: true },
      );
      if (created.error) throw new Error("Histórico indisponível.");
      // The legacy global conflict key cannot authorize taking another workspace's row.
      conversation = await readConversation();
    }
    if (
      conversation.error ||
      !conversation.data?.id ||
      conversation.data.provider !== "meta" ||
      conversation.data.wa_phone_number_id !== sender.phoneNumberId
    )
      throw new Error("Histórico indisponível.");
    const message = await admin.from("whatsapp_messages").insert({
      conversation_id: conversation.data.id,
      owner_id: job.workspaceId,
      workspace_id: job.workspaceId,
      direction: "outbound",
      body: NOTIFICATION_UPDATE_TEXT,
      from_number: sender.displayPhoneNumber,
      to_number: job.phone,
      provider: "meta",
      wa_message_id: providerId,
      status: "accepted",
      template_name: job.templateName,
      is_template: true,
      sent_at: now,
      raw: {
        source: {
          origin: "notification_center",
          notification_delivery_id: job.id,
          idempotency_key: job.idempotencyKey,
          attempt_token: job.token,
          connection_id: job.connectionId,
        },
      },
    });
    if (message.error) throw new Error("Histórico indisponível.");
    await admin
      .from("whatsapp_conversations")
      .update({ last_message_at: now, last_message_preview: NOTIFICATION_UPDATE_TEXT })
      .eq("id", conversation.data.id)
      .eq("workspace_id", job.workspaceId)
      .eq("provider", "meta")
      .eq("wa_phone_number_id", sender.phoneNumberId);
  },
};
