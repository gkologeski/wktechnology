import { validateEmailAddress } from "@/lib/email-address";
import { normalizePhone } from "@/lib/phone/e164";
import { MetaCloudError } from "@/lib/whatsapp/cloud-api.server";
import type { ServerEmailResult } from "@/lib/email-send.server";
import {
  notificationCentralUrl,
  notificationTemplateIncompatibility,
  notificationTemplatePayload,
} from "./delivery-content";
import {
  notificationDeliveryJobSchema,
  type NotificationDeliveryJob,
  type NotificationPersonalDeliveryJob,
  type NotificationTransportResult,
} from "./delivery-types";

export type NotificationCloudSender = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  workspaceId: string;
  connectionId: string;
  provider: "cloud";
  qualityRating: string | null;
  status: string | null;
};

/** Test doubles implement the same boundary without importing credentials or a real client. */
export type NotificationAdapterDependencies = {
  appOrigin: () => string | Promise<string>;
  managedEmailConfigured: () => boolean;
  sendEmail: (input: {
    recipientEmail: string;
    templateName: "notification-update";
    templateData: { centralUrl: string };
    idempotencyKey: string;
    beforeSend: () => Promise<void>;
  }) => Promise<ServerEmailResult>;
  readCloudSender: (
    workspaceId: string,
    senderId: string,
  ) => Promise<NotificationCloudSender | null>;
  readCloudTemplates: (workspaceId: string, senderId: string) => Promise<unknown[] | null>;
  isWhatsAppSuppressed: (workspaceId: string, phone: string) => Promise<boolean>;
  sendCloud: (
    workspaceId: string,
    senderId: string,
    body: Record<string, unknown>,
    authorizeBeforePost: () => Promise<void>,
  ) => Promise<unknown>;
  recordWhatsAppAcceptance: (
    job: NotificationDeliveryJob,
    sender: NotificationCloudSender,
    providerId: string,
  ) => Promise<void>;
  recordWhatsAppRefusal: (job: NotificationDeliveryJob, code: "131026" | "131049") => Promise<void>;
};

type Provider = NotificationTransportResult["provider"];
const result = (
  provider: Provider,
  status: NotificationTransportResult["status"],
  reasonCode?: NotificationTransportResult["reasonCode"],
): NotificationTransportResult => ({ provider, status, ...(reasonCode ? { reasonCode } : {}) });

async function dependencies(injected?: NotificationAdapterDependencies) {
  return (
    injected ?? (await import("./delivery-adapter-runtime.server")).notificationAdapterDependencies
  );
}

function provenSender(
  sender: NotificationCloudSender | null,
  workspaceId: string,
  senderId: string,
) {
  return (
    sender?.provider === "cloud" &&
    sender.workspaceId === workspaceId &&
    sender.phoneNumberId === senderId &&
    sender.status === "CONNECTED" &&
    ["GREEN", "HIGH"].includes(sender.qualityRating ?? "") &&
    /^\+[1-9]\d{4,14}$/.test(sender.displayPhoneNumber)
  );
}

/** Only a typed HTTP refusal proves non-acceptance; opaque errors never enable fallback. */
function transportFailure(provider: Provider, error: unknown): NotificationTransportResult {
  const typed = error as { status?: unknown; retryAfterSeconds?: unknown } | null;
  const status = typeof typed?.status === "number" ? typed.status : null;
  if (status === 429) {
    const delay =
      typeof typed?.retryAfterSeconds === "number" && Number.isFinite(typed.retryAfterSeconds)
        ? Math.max(1, Math.ceil(typed.retryAfterSeconds))
        : 60;
    // Never shorten a provider cooldown to fit a local retry bound.
    if (delay > 86400) return result(provider, "failed", "provider_rate_limited");
    return {
      ...result(provider, "retry_scheduled", "provider_rate_limited"),
      retryAfterSeconds: delay,
    };
  }
  if (status !== null && status >= 400 && status < 500 && status !== 408)
    return result(provider, "failed", "provider_rejected");
  return result(provider, "uncertain", "transport_unknown");
}

async function sendEmail(
  job: NotificationPersonalDeliveryJob,
  deps: NotificationAdapterDependencies,
  centralUrl: string,
  authorizeBeforePost: () => Promise<void>,
) {
  const recipient = validateEmailAddress(job.email);
  if (!recipient.ok) return result("managed_email", "failed", "invalid_recipient");
  if (!deps.managedEmailConfigured())
    return result("managed_email", "failed", "sender_unavailable");
  try {
    await authorizeBeforePost();
    const delivery = await deps.sendEmail({
      recipientEmail: recipient.value,
      templateName: "notification-update",
      templateData: { centralUrl },
      idempotencyKey: job.idempotencyKey,
      beforeSend: authorizeBeforePost,
    });
    if (delivery.status === "suppressed")
      return result("managed_email", "suppressed", "recipient_suppressed");
    if (delivery.status !== "sent")
      return result("managed_email", "uncertain", "transport_unknown");
    // The managed wrapper's messageId is a local reference, not provider delivery evidence.
    return { ...result("managed_email", "accepted"), providerId: null };
  } catch (error) {
    return transportFailure("managed_email", error);
  }
}

async function sendWhatsApp(
  job: NotificationPersonalDeliveryJob,
  deps: NotificationAdapterDependencies,
  centralUrl: string,
  authorizeBeforePost: () => Promise<void>,
) {
  const normalized = normalizePhone(job.phone);
  if (normalized.status !== "valid" || normalized.extension || normalized.e164 !== job.phone)
    return result("meta_cloud", "failed", "invalid_recipient");
  if (!/^\d{5,30}$/.test(job.senderPhoneNumberId ?? ""))
    return result("meta_cloud", "failed", "sender_unavailable");
  const senderId = job.senderPhoneNumberId!;
  let sender: NotificationCloudSender | null;
  let templatePayload: ReturnType<typeof notificationTemplatePayload>;
  try {
    sender = await deps.readCloudSender(job.workspaceId, senderId);
    if (!provenSender(sender, job.workspaceId, senderId))
      return result("meta_cloud", "failed", "sender_unavailable");
    if (await deps.isWhatsAppSuppressed(job.workspaceId, normalized.e164))
      return result("meta_cloud", "suppressed", "recipient_suppressed");
    if (!job.templateName || !job.templateLanguage)
      return result("meta_cloud", "failed", "invalid_template");
    const templates = await deps.readCloudTemplates(job.workspaceId, senderId);
    const template = templates?.find((item) => {
      if (!item || typeof item !== "object") return false;
      const t = item as Record<string, unknown>;
      return t.name === job.templateName && t.language === job.templateLanguage;
    }) as Record<string, unknown> | undefined;
    templatePayload = template
      ? notificationTemplatePayload(template, {
          name: job.templateName,
          language: job.templateLanguage,
          centralUrl,
        })
      : null;
    if (!templatePayload) return result("meta_cloud", "failed", "invalid_template");
  } catch {
    // This stage performed reads only. Retrying does not risk a duplicate POST.
    return {
      ...result("meta_cloud", "retry_scheduled", "provider_preflight_unavailable"),
      retryAfterSeconds: 60,
    };
  }
  let response: unknown;
  try {
    response = await deps.sendCloud(
      job.workspaceId,
      senderId,
      {
        messaging_product: "whatsapp",
        to: normalized.e164,
        type: "template",
        template: templatePayload,
      },
      authorizeBeforePost,
    );
  } catch (error) {
    const failure = transportFailure("meta_cloud", error);
    if (
      failure.status === "failed" &&
      error instanceof MetaCloudError &&
      (error.code === 131026 || error.code === 131049)
    ) {
      try {
        await deps.recordWhatsAppRefusal(job, String(error.code) as "131026" | "131049");
      } catch {
        /* A local suppression failure never changes a definite provider refusal. */
      }
    }
    return failure;
  }
  const providerId = (response as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id;
  if (typeof providerId !== "string" || !providerId.trim())
    return result("meta_cloud", "uncertain", "transport_unknown");
  try {
    await deps.recordWhatsAppAcceptance(job, sender!, providerId);
  } catch {
    // Remote acceptance is true even if local history fails. The ledger retains the wamid.
  }
  return { ...result("meta_cloud", "accepted"), providerId };
}

/** Service-only worker boundary: the claim RPC already fixed recipient, consent and sender. */
export async function sendNotificationDelivery(
  input: NotificationDeliveryJob,
  injected?: NotificationAdapterDependencies,
  authorizeBeforePost?: () => Promise<void>,
): Promise<NotificationTransportResult> {
  const parsed = notificationDeliveryJobSchema.safeParse(input);
  const provider =
    input?.channel === "slack"
      ? "slack_webhook"
      : input?.channel === "whatsapp"
        ? "meta_cloud"
        : "managed_email";
  if (!parsed.success || !authorizeBeforePost)
    return result(provider, "failed", "invalid_configuration");
  if (parsed.data.channel === "slack") {
    if (injected) return result("slack_webhook", "failed", "invalid_configuration");
    return (await import("./slack-transport.server")).sendSlackNotification(
      parsed.data,
      undefined,
      authorizeBeforePost,
    );
  }
  const deps = await dependencies(injected);
  let centralUrl: string;
  try {
    centralUrl = notificationCentralUrl(await deps.appOrigin());
  } catch {
    return result(provider, "failed", "invalid_configuration");
  }
  return parsed.data.channel === "email"
    ? sendEmail(parsed.data, deps, centralUrl, authorizeBeforePost)
    : sendWhatsApp(parsed.data, deps, centralUrl, authorizeBeforePost);
}

export type NotificationWhatsAppTemplate = {
  name: string;
  language: string;
  body: string;
  compatible: boolean;
  reason?: string;
};

/** Called only after user/workspace/channel permission checks; never creates a Meta template. */
export async function loadNotificationWhatsAppTemplates(
  workspaceId: string,
  senderPhoneNumberId: string,
  injected?: NotificationAdapterDependencies,
): Promise<NotificationWhatsAppTemplate[]> {
  if (!/^\d{5,30}$/.test(senderPhoneNumberId)) return [];
  const deps = await dependencies(injected);
  const centralUrl = notificationCentralUrl(await deps.appOrigin());
  const sender = await deps.readCloudSender(workspaceId, senderPhoneNumberId);
  if (!provenSender(sender, workspaceId, senderPhoneNumberId)) return [];
  const templates = await deps.readCloudTemplates(workspaceId, senderPhoneNumberId);
  return (templates ?? []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const t = value as Record<string, unknown>;
    if (typeof t.name !== "string" || typeof t.language !== "string") return [];
    const reason = notificationTemplateIncompatibility(t, {
      name: t.name,
      language: t.language,
      centralUrl,
    });
    const body = Array.isArray(t.components)
      ? t.components.find((c) => c?.type === "BODY")?.text
      : "";
    return [
      {
        name: t.name,
        language: t.language,
        body: typeof body === "string" ? body : "",
        compatible: !reason,
        ...(reason ? { reason } : {}),
      },
    ];
  });
}
