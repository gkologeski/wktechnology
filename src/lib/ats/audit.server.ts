/**
 * Helper server-side para registrar eventos de domínio do ATS, padronizando
 * nomes e payloads. Usa o bus existente (`emitEvent` → `domain_events`).
 *
 * Convenção de nomes: `ats.<área>.<verbo_passado>`
 *   ex.: ats.job.posted, ats.candidate.hired, ats.offer.signed,
 *        ats.interview.completed, ats.dsar.requested
 *
 * Usar SEMPRE em server functions / server routes — nunca no cliente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitEvent } from "@/lib/events.server";

export type AtsEventName =
  // Onda 5
  | "ats.job.posted"
  | "ats.job.unposted"
  | "ats.candidate.sourced"
  | "ats.referral.submitted"
  // Onda 6
  | "ats.assessment.invited"
  | "ats.assessment.completed"
  | "ats.background_check.started"
  | "ats.background_check.completed"
  | "ats.interview.scheduled"
  | "ats.interview.completed"
  // Onda 7
  | "ats.offer.approved"
  | "ats.offer.signed"
  | "ats.dsar.requested"
  | "ats.dsar.fulfilled"
  | "ats.consent.granted"
  | "ats.consent.revoked"
  // Onda 8
  | "ats.candidate.hired"
  | "ats.hire.handed_off"
  | "ats.quality_of_hire.recorded";

export async function recordAtsEvent(
  supabase: SupabaseClient,
  args: {
    ownerId: string;
    name: AtsEventName;
    entityType:
      | "job"
      | "candidate"
      | "application"
      | "interview"
      | "offer"
      | "dsar"
      | "referral"
      | "assessment"
      | "background_check"
      | "consent"
      | "hire"
      | "quality_of_hire";
    entityId: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
  },
) {
  const result = await emitEvent(supabase, {
    ownerId: args.ownerId,
    eventName: args.name,
    source: "ats",
    entityType: args.entityType,
    entityId: args.entityId,
    payload: args.payload ?? {},
    dedupeKey: args.dedupeKey,
  });
  // Fan-out para webhooks de saída (silencioso em falha para não bloquear o caller).
  if (!result.deduped) {
    try {
      const { enqueueWebhookEvent } = await import("@/lib/webhooks/dispatcher.server");
      await enqueueWebhookEvent(args.ownerId, args.name, {
        entity_type: args.entityType,
        entity_id: args.entityId,
        ...(args.payload ?? {}),
      });
    } catch (e) {
      console.warn("[recordAtsEvent] webhook enqueue failed", e);
    }
  }
  return result;
}
