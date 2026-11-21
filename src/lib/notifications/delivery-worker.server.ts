import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "../access-control/work-core.server";
import {
  notificationDeliveryJobSchema,
  type NotificationDeliveryJob,
  type NotificationTransportResult,
} from "./delivery-types";

const candidatesSchema = z.array(z.object({ id: z.string().uuid() })).max(50);
const resultSchema = z.object({ result: z.string().min(1).max(80) }).passthrough();
type Counters = {
  scanned: number;
  accepted: number;
  deferred: number;
  suppressed: number;
  uncertain: number;
  failed: number;
  skipped: number;
};
const reasonCodes = new Set([
  "invalid_recipient",
  "invalid_configuration",
  "invalid_template",
  "sender_unavailable",
  "provider_rejected",
  "provider_rate_limited",
  "provider_preflight_unavailable",
  "transport_unknown",
  "recipient_suppressed",
]);
const outcomeSchema = z.object({
  status: z.enum(["accepted", "suppressed", "retry_scheduled", "failed", "uncertain"]),
  provider: z.enum(["meta_cloud", "lovable_whatsapp", "managed_email", "slack_webhook"]),
  providerId: z.string().max(500).nullable().optional(),
  reasonCode: z
    .string()
    .refine((code) => reasonCodes.has(code))
    .optional(),
  retryAfterSeconds: z.number().int().min(1).max(86400).optional(),
});

/** Runs only from the existing authenticated service cron, never from a UI request. */
export async function tickNotificationDeliveries(
  client: SupabaseClient,
  limit = 20,
  dependencies: {
    send?: (
      job: NotificationDeliveryJob,
      authorizeBeforePost: () => Promise<void>,
    ) => Promise<NotificationTransportResult>;
  } = {},
): Promise<Counters> {
  const bounded = z.number().int().min(1).max(50).parse(limit);
  const candidates = candidatesSchema.parse(
    await workRpc(client, "notification_worker_list", { p_limit: bounded }),
  );
  const counters: Counters = {
    scanned: candidates.length,
    accepted: 0,
    deferred: 0,
    suppressed: 0,
    uncertain: 0,
    failed: 0,
    skipped: 0,
  };
  let failures = 0;
  for (const candidate of candidates) {
    try {
      const raw = await workRpc<unknown>(client, "notification_delivery_claim", {
        p_id: candidate.id,
      });
      const claim = resultSchema.parse(raw);
      if (claim.result !== "claimed") {
        countWithoutSend(counters, claim.result);
        continue;
      }
      const job = notificationDeliveryJobSchema.parse(raw);
      if (job.id !== candidate.id) throw new Error("Reserva não corresponde à entrega.");
      let cancellation: string | null = null;
      const authorizeBeforePost = async () => {
        const preflight = z
          .object({ allowed: z.boolean() })
          .passthrough()
          .parse(
            await workRpc(client, "notification_delivery_preflight", {
              p_id: job.id,
              p_token: job.token,
            }),
          );
        if (!preflight.allowed) {
          cancellation = String(preflight.result ?? "suppressed");
          throw new Error("Envio cancelado antes do transporte.");
        }
        const current = notificationDeliveryJobSchema.parse(preflight);
        // Zod builds both jobs in the same field order. Compare the complete
        // discriminated payload, including collective endpoint pins, never a
        // fabricated recipient for Slack.
        if (JSON.stringify(current) !== JSON.stringify(job))
          throw new Error("O destino ou a reserva mudou antes do envio.");
      };
      try {
        await authorizeBeforePost();
      } catch (error) {
        if (!cancellation) throw error;
      }
      if (cancellation) {
        countWithoutSend(counters, cancellation);
        continue;
      }
      let outcome: z.infer<typeof outcomeSchema>;
      try {
        const send =
          dependencies.send ??
          ((item, authorize) =>
            import("./delivery-adapters.server").then((adapter) =>
              adapter.sendNotificationDelivery(item, undefined, authorize),
            ));
        outcome = outcomeSchema.parse(await send(job, authorizeBeforePost));
        const expectedProvider =
          job.channel === "slack"
            ? "slack_webhook"
            : job.channel === "email"
              ? "managed_email"
              : "meta_cloud";
        if (outcome.provider !== expectedProvider)
          throw Error("Provedor não corresponde ao canal reservado.");
        if (job.channel === "slack" && outcome.providerId)
          throw Error("Webhook não fornece recibo individual.");
        if (outcome.status === "accepted" && job.channel === "whatsapp" && !outcome.providerId)
          outcome = {
            status: "uncertain",
            provider: outcome.provider,
            reasonCode: "transport_unknown",
          };
      } catch {
        // An unexpected exception may happen after the provider accepted the POST.
        outcome = {
          status: "uncertain",
          provider:
            job.channel === "slack"
              ? "slack_webhook"
              : job.channel === "email"
                ? "managed_email"
                : "meta_cloud",
          reasonCode: "transport_unknown",
        };
      }
      if (cancellation) {
        countWithoutSend(counters, cancellation);
        continue;
      }
      const finished = z.object({ updated: z.boolean() }).parse(
        await workRpc(client, "notification_delivery_finish", {
          p_id: job.id,
          p_token: job.token,
          p_status: outcome.status,
          p_provider: outcome.provider,
          p_provider_id: outcome.providerId ?? null,
          p_reason: outcome.reasonCode ?? null,
          p_retry_after_seconds: outcome.retryAfterSeconds ?? null,
        }),
      );
      if (!finished.updated) throw new Error("A tentativa perdeu a reserva antes da confirmação.");
      if (outcome.status === "retry_scheduled") counters.deferred++;
      else counters[outcome.status]++;
    } catch {
      failures++;
    }
  }
  if (failures)
    throw new Error(
      `Não foi possível validar ou persistir ${failures} entrega(s). Consulte o histórico; nenhum reenvio incerto foi autorizado.`,
    );
  return counters;
}

function countWithoutSend(counters: Counters, result: string) {
  if (["deferred", "quota", "outside_window", "retry_scheduled"].includes(result))
    counters.deferred++;
  else if (result === "suppressed") counters.suppressed++;
  else if (result === "uncertain") counters.uncertain++;
  else counters.skipped++;
}
