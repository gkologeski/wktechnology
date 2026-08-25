// Estado/persistência dos passos de importação do HubSpot (logs, checkpoints, mapas).
// Extraído de hubspot-steps.server.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hsPost } from "./hubspot-api.server";
import type { HsTable, LogEntry, ResumeState, StepName } from "./hubspot-steps-types";

export async function appendLog(supabase: SupabaseClient, jobId: string, entry: Omit<LogEntry, "ts">) {
  const full: LogEntry = { ...entry, ts: new Date().toISOString() };
  const { data: cur } = await supabase
    .from("enrichment_jobs")
    .select("step_logs")
    .eq("id", jobId)
    .single();
  const arr = Array.isArray(cur?.step_logs) ? (cur!.step_logs as LogEntry[]) : [];
  const next = [...arr, full].slice(-300);
  await supabase
    .from("enrichment_jobs")
    .update({ step_logs: next as never })
    .eq("id", jobId);
}

export async function patchItemBefore(
  supabase: SupabaseClient,
  itemId: string,
  patch: Record<string, unknown>,
) {
  const { data: cur } = await supabase
    .from("enrichment_job_items")
    .select("before")
    .eq("id", itemId)
    .single();
  const merged = { ...((cur?.before as object) ?? {}), ...patch };
  await supabase
    .from("enrichment_job_items")
    .update({ before: merged as never })
    .eq("id", itemId);
}

// Throttled progress writer. Also heartbeats enrichment_jobs.updated_at so the
// zombie-sweeper doesn't kill long-running steps that are actually progressing.
export function makeProgressBumper(supabase: SupabaseClient, itemId: string, jobId: string) {
  let last = 0;
  return async (succeeded: number, failed: number, discovered?: number, force = false) => {
    const now = Date.now();
    if (!force && now - last < 600) return;
    last = now;
    await Promise.all([
      patchItemBefore(supabase, itemId, {
        running_succeeded: succeeded,
        running_failed: failed,
        last_heartbeat_at: new Date().toISOString(),
        ...(discovered !== undefined ? { discovered } : {}),
      }),
      supabase
        .from("enrichment_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId),
    ]);
  };
}

// Load HS-ID → localId map for entities imported earlier. We scan the local
// database first so a resumed job still sees records imported before a timeout,
// even if the item checkpoint lost its imported_hs_ids list.
export async function loadMapForStep(
  supabase: SupabaseClient,
  workspaceId: string,
  jobId: string,
  table: HsTable,
  fromStep: StepName,
): Promise<Map<string, string>> {
  const importedIds = await loadImportedHsIdsForStep(supabase, workspaceId, jobId, table, fromStep);
  if (importedIds.length > 0 && importedIds.length <= 2_000) {
    return loadLocalMapForHsIds(supabase, workspaceId, table, importedIds);
  }

  return scanLocalHubspotMap(supabase, workspaceId, table);
}

export async function loadImportedHsIdsForStep(
  supabase: SupabaseClient,
  workspaceId: string,
  jobId: string,
  table: HsTable,
  fromStep: StepName,
): Promise<string[]> {
  const { data: items } = await supabase
    .from("enrichment_job_items")
    .select("after, before")
    .eq("job_id", jobId);
  const item = (items ?? []).find(
    (it) => (it.before as { step?: string } | null)?.step === fromStep,
  );
  const ids =
    (item?.after as { imported_hs_ids?: string[] } | null)?.imported_hs_ids ??
    (item?.before as { imported_hs_ids?: string[] } | null)?.imported_hs_ids ??
    [];
  if (ids.length > 0) return Array.from(new Set(ids.map(String)));

  const fallback = await scanLocalHubspotMap(supabase, workspaceId, table);
  return [...fallback.keys()];
}

async function scanLocalHubspotMap(
  supabase: SupabaseClient,
  workspaceId: string,
  table: HsTable,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from(table)
      .select("id, external_ids")
      .eq("workspace_id", workspaceId)
      .not("external_ids->>hubspot", "is", null)
      .range(from, from + 999);
    for (const r of data ?? []) {
      const hs = (r.external_ids as { hubspot?: string } | null)?.hubspot;
      if (hs) map.set(String(hs), r.id as string);
    }
    if (!data || data.length < 1000) break;
  }
  return map;
}

export async function loadLocalMapForHsIds(
  supabase: SupabaseClient,
  workspaceId: string,
  table: HsTable,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
  for (let i = 0; i < unique.length; i += 250) {
    const chunk = unique.slice(i, i + 250);
    const { data } = await supabase
      .from(table)
      .select("id, external_ids")
      .eq("workspace_id", workspaceId)
      .in("external_ids->>hubspot", chunk);
    for (const r of data ?? []) {
      const hs = (r.external_ids as { hubspot?: string } | null)?.hubspot;
      if (hs) map.set(String(hs), r.id as string);
    }
  }
  return map;
}

export async function loadResume(supabase: SupabaseClient, itemId: string): Promise<ResumeState> {
  const { data } = await supabase
    .from("enrichment_job_items")
    .select("before")
    .eq("id", itemId)
    .single();
  return ((data?.before as ResumeState | null) ?? {}) as ResumeState;
}

export async function searchTotal(obj: string): Promise<number> {
  try {
    const r = (await hsPost(`/crm/v3/objects/${obj}/search`, { limit: 1 })) as { total?: number };
    return r.total ?? 0;
  } catch {
    return 0;
  }
}
