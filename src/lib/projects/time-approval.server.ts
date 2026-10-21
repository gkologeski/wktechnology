// Helpers server-only do fluxo de aprovação (usados por time-approval.functions.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanDbError } from "@/lib/projects/time-entry.shared";

/** Itens pendentes (com a revisão enviada) dos apontamentos informados, visíveis ao aprovador (RLS). */
export async function pendingItemsFor(supabase: SupabaseClient, entryIds: string[]) {
  const { data, error } = await supabase
    .from("project_timesheet_submission_items")
    .select("id, entry_revision, time_entry_id")
    .in("time_entry_id", entryIds)
    .eq("decision", "pending");
  if (error) throw new Error(cleanDbError(error.message));
  const rows = (data ?? []) as { id: string; entry_revision: number }[];
  if (rows.length === 0) {
    throw new Error(
      "Nenhum apontamento enviado para decisão: o profissional precisa enviar o período antes.",
    );
  }
  return rows.map((r) => ({ item_id: r.id, revision: r.entry_revision }));
}

/** Evento de domínio por apontamento (base para webhooks); falha de evento não desfaz a decisão. */
export async function emitTimeEntryEvent(
  supabase: SupabaseClient,
  workspaceId: string,
  eventName: string,
  entryIds: string[],
) {
  const { emitEvent } = await import("@/lib/events.server");
  for (const id of entryIds) {
    try {
      await emitEvent(supabase as never, {
        ownerId: workspaceId,
        eventName,
        source: "techprojects",
        entityType: "project_time_entry",
        entityId: id,
        payload: { time_entry_id: id },
      });
    } catch (err) {
      console.error("[time-approval] evento falhou", {
        eventName,
        id,
        error: (err as Error).message,
      });
    }
  }
}
