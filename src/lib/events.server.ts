// Event Bus v2 — emissão de eventos de domínio cross-módulo.
// Use em qualquer ponto server-side para publicar acontecimentos relevantes
// (ex.: `crm.deal.won`, `ats.candidate.hired`, `finance.invoice.paid`).
//
// O engine de workflows v2 (futuro) lê `domain_events` ainda não processados,
// resolve `workflow_subscriptions` por padrão glob e executa as actions.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmitEventInput = {
  ownerId: string;
  eventName: string;
  source?: string;
  entityType?: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  /** Chave de deduplicação por owner (ex.: `deal.won:<dealId>`). */
  dedupeKey?: string;
  /** Quando o evento aconteceu (default: now()). */
  occurredAt?: string;
};

export async function emitEvent(
  supabase: SupabaseClient,
  input: EmitEventInput,
): Promise<{ id: string | null; deduped: boolean }> {
  const row = {
    owner_id: input.ownerId,
    event_name: input.eventName,
    source: input.source ?? "system",
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };

  // upsert via insert + onConflict deduplica por (owner_id, dedupe_key).
  const { data, error } = await supabase
    .from("domain_events")
    .insert(row as never)
    .select("id")
    .maybeSingle();

  if (error) {
    // Conflito de dedupe → não é erro fatal.
    if ((error as { code?: string }).code === "23505") {
      return { id: null, deduped: true };
    }
    console.error("[emitEvent] failed", { eventName: input.eventName, error: error.message });
    throw new Error(error.message);
  }
  return { id: (data?.id as string | undefined) ?? null, deduped: false };
}
