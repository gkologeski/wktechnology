// Upsert idempotente por HubSpot id. Extraído de hubspot-steps.server.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HsUpsertTable, UpsertResult, UpsertTask } from "./hubspot-steps-types";

function withOriginalCreatedAt(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.created_at || !payload.hs_createdate) return payload;
  return { ...payload, created_at: payload.hs_createdate };
}

/** Compare existing row vs incoming payload by HS id; insert/update/skip. */
export async function upsertByHsId(
  supabase: SupabaseClient,
  table: HsUpsertTable,
  ownerId: string,
  hsId: string,
  payload: Record<string, unknown>,
): Promise<UpsertResult> {
  const normalizedPayload = withOriginalCreatedAt(payload);
  const compareKeys = Object.keys(normalizedPayload).filter(
    (k) => k !== "owner_id" && k !== "external_ids" && k !== "hs_raw",
  );
  const selectCols = ["id", ...compareKeys].join(",");
  const { data: existing } = await supabase
    .from(table)
    .select(selectCols)
    .eq("owner_id", ownerId)
    .eq("external_ids->>hubspot", hsId)
    .maybeSingle();

  if (existing) {
    const ex = existing as unknown as Record<string, unknown>;
    const localId = ex.id as string;
    const diff: Record<string, unknown> = {};
    for (const k of compareKeys) {
      const cur = ex[k];
      const nxt = normalizedPayload[k];
      if (JSON.stringify(cur ?? null) !== JSON.stringify(nxt ?? null)) diff[k] = nxt;
    }
    if (Object.keys(diff).length === 0) return { status: "unchanged", localId };
    const { error } = await supabase
      .from(table)
      .update(diff as never)
      .eq("id", localId);
    if (error) return { status: "failed", error: error.message };
    return { status: "updated", localId };
  }

  const { data: row, error } = await supabase
    .from(table)
    .insert(normalizedPayload as never)
    .select("id")
    .single();
  if (error || !row) return { status: "failed", error: error?.message ?? "insert failed" };
  return { status: "inserted", localId: (row as { id: string }).id };
}

export async function upsertBatchByHsId(
  supabase: SupabaseClient,
  table: HsUpsertTable,
  ownerId: string,
  tasks: UpsertTask[],
): Promise<UpsertResult[]> {
  if (tasks.length === 0) return [];
  const normalizedTasks = tasks.map((task) => ({
    ...task,
    payload: withOriginalCreatedAt(task.payload),
  }));
  const compareKeys = Array.from(
    new Set(
      normalizedTasks.flatMap((t) =>
        Object.keys(t.payload).filter(
          (k) => k !== "owner_id" && k !== "external_ids" && k !== "hs_raw",
        ),
      ),
    ),
  );
  const selectCols = ["id", "external_ids", ...compareKeys].join(",");
  const { data: existing, error: selectError } = await supabase
    .from(table)
    .select(selectCols)
    .eq("owner_id", ownerId)
    .in(
      "external_ids->>hubspot",
      normalizedTasks.map((t) => t.hsId),
    );

  if (selectError)
    return Promise.all(
      normalizedTasks.map((t) => upsertByHsId(supabase, table, ownerId, t.hsId, t.payload)),
    );

  const existingByHs = new Map<string, Record<string, unknown>>();
  for (const row of (existing ?? []) as unknown as Record<string, unknown>[]) {
    const hs = (row.external_ids as { hubspot?: string } | null)?.hubspot;
    if (hs && !existingByHs.has(String(hs))) existingByHs.set(String(hs), row);
  }

  const results: UpsertResult[] = Array(normalizedTasks.length)
    .fill(null)
    .map(() => ({ status: "failed", error: "not processed" }));
  const inserts: { index: number; row: Record<string, unknown> }[] = [];
  const updates: { index: number; localId: string; diff: Record<string, unknown> }[] = [];

  normalizedTasks.forEach((task, index) => {
    const existingRow = existingByHs.get(task.hsId);
    if (!existingRow) {
      inserts.push({ index, row: task.payload });
      return;
    }
    const localId = existingRow.id as string;
    const diff: Record<string, unknown> = {};
    for (const k of compareKeys) {
      if (JSON.stringify(existingRow[k] ?? null) !== JSON.stringify(task.payload[k] ?? null))
        diff[k] = task.payload[k];
    }
    if (Object.keys(diff).length === 0) results[index] = { status: "unchanged", localId };
    else updates.push({ index, localId, diff });
  });

  for (let i = 0; i < updates.length; i += 12) {
    const batch = updates.slice(i, i + 12);
    const updated = await Promise.all(
      batch.map((u) =>
        supabase
          .from(table)
          .update(u.diff as never)
          .eq("id", u.localId),
      ),
    );
    updated.forEach(({ error }, j) => {
      const u = batch[j];
      results[u.index] = error
        ? { status: "failed", error: error.message }
        : { status: "updated", localId: u.localId };
    });
  }

  if (inserts.length > 0) {
    const { data: inserted, error } = await supabase
      .from(table)
      .insert(inserts.map((i) => i.row) as never)
      .select("id, external_ids");
    if (error) {
      inserts.forEach((ins) => {
        results[ins.index] = { status: "failed", error: error.message };
      });
    } else {
      const insertedByHs = new Map<string, string>();
      for (const row of (inserted ?? []) as unknown as {
        id: string;
        external_ids: { hubspot?: string } | null;
      }[]) {
        const hs = row.external_ids?.hubspot;
        if (hs) insertedByHs.set(String(hs), row.id);
      }
      inserts.forEach((ins) => {
        const hs = (ins.row.external_ids as { hubspot?: string } | null)?.hubspot;
        results[ins.index] =
          hs && insertedByHs.has(String(hs))
            ? { status: "inserted", localId: insertedByHs.get(String(hs)) }
            : { status: "failed", error: "insert did not return id" };
      });
    }
  }

  return results;
}
