import { z } from "zod";
import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";
import { notificationCentralUrl, NOTIFICATION_UPDATE_TEXT } from "./delivery-content";
import type { NotificationTransportResult } from "./delivery-types";

const slackNotificationJobSchema = z
  .object({
    id: z.string().uuid(),
    token: z.string().uuid(),
    channel: z.literal("slack"),
    idempotencyKey: z.string().min(1).max(500),
    workspaceId: z.string().uuid(),
    workflowId: z.string().uuid(),
    runId: z.string().uuid(),
    integrationId: z.string().uuid(),
    endpointRevision: z.number().int().positive(),
    endpointHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

/** A collective channel destination, never a personal recipient or a secret-bearing job. */
export type SlackNotificationJob = z.infer<typeof slackNotificationJobSchema>;
export type SlackNotificationDependencies = {
  resolveEndpoint: (job: SlackNotificationJob) => Promise<{ webhookUrl: string } | null>;
  fetch: typeof fetch;
  appOrigin: () => string | Promise<string>;
};

const endpointSchema = z.object({ webhookUrl: z.string().max(2000) });
const POST_TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_SECONDS = 86_400;

const outcome = (
  status: NotificationTransportResult["status"],
  reasonCode?: NotificationTransportResult["reasonCode"],
): NotificationTransportResult => ({
  provider: "slack_webhook",
  status,
  ...(reasonCode ? { reasonCode } : {}),
});

/** URL syntax is checked again at the server-only transport, independent of the saved config. */
export function isSlackIncomingWebhookUrl(value: string): boolean {
  if (
    value.length > 2000 ||
    value.trim() !== value ||
    !/^https:\/\/hooks\.slack\.com(?::443)?\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(
      value,
    )
  )
    return false;
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.hostname === "hooks.slack.com" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

async function endpointHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Slack's successful response is only `ok`; never buffer arbitrary provider response content. */
async function hasSlackAcceptance(response: Response): Promise<boolean> {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const bytes = new Uint8Array(32);
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return new TextDecoder().decode(bytes.subarray(0, size)).trim() === "ok";
      if (size + chunk.value.byteLength > bytes.length) {
        void reader.cancel().catch(() => {});
        return false;
      }
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

const runtime: SlackNotificationDependencies = {
  appOrigin: () => CANONICAL_APP_ORIGIN,
  fetch: (...args) => fetch(...args),
  resolveEndpoint: async (job) => {
    const [{ supabaseAdmin }, { workRpc }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/access-control/work-core.server"),
    ]);
    return endpointSchema.parse(
      await workRpc(supabaseAdmin, "notification_slack_endpoint", {
        p_id: job.id,
        p_token: job.token,
      }),
    );
  },
};

/**
 * Sends one protected, neutral notice to the pinned collective webhook. The ledger owns
 * authorization, deduplication, quotas and retries; this boundary never retries a POST.
 */
export async function sendSlackNotification(
  input: SlackNotificationJob,
  dependencies: SlackNotificationDependencies = runtime,
  beforeSend?: () => Promise<void>,
): Promise<NotificationTransportResult> {
  const parsed = slackNotificationJobSchema.safeParse(input);
  if (!parsed.success || typeof beforeSend !== "function")
    return outcome("failed", "invalid_configuration");
  const job = parsed.data;
  let webhookUrl: string;
  let centralUrl: string;
  try {
    centralUrl = notificationCentralUrl(await dependencies.appOrigin());
  } catch {
    return outcome("failed", "invalid_configuration");
  }
  try {
    const endpoint = endpointSchema.safeParse(await dependencies.resolveEndpoint(job));
    if (!endpoint.success || !isSlackIncomingWebhookUrl(endpoint.data.webhookUrl))
      return outcome("failed", "sender_unavailable");
    webhookUrl = endpoint.data.webhookUrl;
    if ((await endpointHash(webhookUrl)) !== job.endpointHash)
      return outcome("failed", "sender_unavailable");
  } catch {
    // Resolving the private endpoint performed reads only; no POST needs reconciliation.
    return {
      ...outcome("retry_scheduled", "provider_preflight_unavailable"),
      retryAfterSeconds: 60,
    };
  }
  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${NOTIFICATION_UPDATE_TEXT} Acesse a central de notificações: ${centralUrl}`,
      mrkdwn: false,
      unfurl_links: false,
      unfurl_media: false,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  };
  try {
    await beforeSend();
  } catch {
    return {
      ...outcome("retry_scheduled", "provider_preflight_unavailable"),
      retryAfterSeconds: 60,
    };
  }
  try {
    const response = await dependencies.fetch(webhookUrl, request);
    if (response.status !== 200 && response.body) void response.body.cancel().catch(() => {});
    if (response.status === 429) {
      const value = response.headers.get("Retry-After");
      const seconds = value && /^\d+$/.test(value) ? Number(value) : NaN;
      if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_RETRY_AFTER_SECONDS)
        return outcome("failed", "provider_rate_limited");
      return {
        ...outcome("retry_scheduled", "provider_rate_limited"),
        retryAfterSeconds: seconds,
      };
    }
    if (response.status === 200 && (await hasSlackAcceptance(response)))
      return { ...outcome("accepted"), providerId: null };
    if (response.status >= 400 && response.status < 500 && response.status !== 408)
      return outcome("failed", "provider_rejected");
    return outcome("uncertain", "transport_unknown");
  } catch {
    // An exception may follow remote acceptance. Never expose provider details or retry blindly.
    return outcome("uncertain", "transport_unknown");
  }
}
