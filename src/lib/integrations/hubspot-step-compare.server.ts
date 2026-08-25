// Etapa "compare" da importação do HubSpot: conta remoto vs local por objeto,
// registra a diferença e marca as etapas já sincronizadas para serem puladas.
// Extraído de hubspot-steps.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendLog, searchTotal } from "./hubspot-steps-state.server";
import type { Scope, StepResult } from "./hubspot-steps-types";

export async function runCompareStep({
  supabase,
  workspaceId,
  jobId,
  itemId,
  scope,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  jobId: string;
  itemId: string;
  scope: Scope;
}): Promise<StepResult> {
  // Count remote (HubSpot) vs local for each planned object and log the diff.
  // Steps where local >= remote are marked to be skipped (no fetch).
  const objects: {
    key: "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities";
    remote: () => Promise<number>;
    localTable: "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities";
  }[] = [];
  if (scope.companies !== false)
    objects.push({
      key: "companies",
      remote: () => searchTotal("companies"),
      localTable: "companies",
    });
  if (scope.contacts)
    objects.push({
      key: "contacts",
      remote: () => searchTotal("contacts"),
      localTable: "contacts",
    });
  if (scope.deals)
    objects.push({ key: "deals", remote: () => searchTotal("deals"), localTable: "deals" });
  if (scope.leads)
    objects.push({ key: "leads", remote: () => searchTotal("leads"), localTable: "leads" });
  if (scope.tickets)
    objects.push({
      key: "tickets",
      remote: () => searchTotal("tickets"),
      localTable: "tickets",
    });
  if (scope.activities) {
    objects.push({
      key: "activities",
      remote: async () => {
        const parts = await Promise.all([
          searchTotal("notes"),
          searchTotal("calls"),
          searchTotal("meetings"),
          searchTotal("tasks"),
          searchTotal("emails"),
        ]);
        return parts.reduce((a: number, b: number) => a + b, 0);
      },
      localTable: "activities",
    });
  }

  const skipSteps: string[] = [];
  const summary: Record<string, { local: number; remote: number; diff: number }> = {};

  for (const o of objects) {
    const [remote, localRes] = await Promise.all([
      o.remote().catch(() => 0),
      supabase
        .from(o.localTable)
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);
    const local = localRes.count ?? 0;
    const diff = Math.max(0, remote - local);
    summary[o.key] = { local, remote, diff };
    await appendLog(supabase, jobId, {
      level: "info",
      step: "compare",
      message: `${o.key}: local=${local} · HubSpot=${remote} · diferença=${diff}`,
      count: diff,
    });
    if (diff === 0 && remote > 0) {
      // already in sync — skip the corresponding step(s)
      if (o.key === "activities") {
        skipSteps.push(
          "activities-notes",
          "activities-calls",
          "activities-meetings",
          "activities-tasks",
          "activities-emails",
        );
      } else {
        skipSteps.push(o.key);
      }
      await appendLog(supabase, jobId, {
        level: "info",
        step: "compare",
        message: `${o.key}: já está sincronizado, etapa será pulada`,
      });
    }
  }

  // Persist comparison + skip list on the job scope so other steps can read it
  const { data: jobRow } = await supabase
    .from("enrichment_jobs")
    .select("scope")
    .eq("id", jobId)
    .single();
  const prevScope = (jobRow?.scope as Record<string, unknown> | null) ?? {};
  await supabase
    .from("enrichment_jobs")
    .update({
      scope: { ...prevScope, compare_summary: summary, skip_steps: skipSteps } as never,
    })
    .eq("id", jobId);

  // Mark downstream items as 'done' with 0 imports when in skip list
  if (skipSteps.length > 0) {
    const { data: allItems } = await supabase
      .from("enrichment_job_items")
      .select("id, before")
      .eq("job_id", jobId);
    for (const it of allItems ?? []) {
      const stepName = (it.before as { step?: string } | null)?.step;
      if (stepName && skipSteps.includes(stepName)) {
        await supabase
          .from("enrichment_job_items")
          .update({
            status: "done",
            after: { succeeded: 0, failed: 0, imported_hs_ids: [], skipped: true } as never,
          })
          .eq("id", it.id);
      }
    }
  }

  await supabase
    .from("enrichment_job_items")
    .update({
      status: "done",
      after: {
        succeeded: 1,
        failed: 0,
        imported_hs_ids: [],
        compare_summary: summary,
        skip_steps: skipSteps,
      } as never,
    })
    .eq("id", itemId);
  return { succeeded: 1, failed: 0, importedHsIds: [] };
}
