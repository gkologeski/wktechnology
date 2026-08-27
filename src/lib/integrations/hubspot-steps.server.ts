// Per-step execution helpers for HubSpot import.
// Each step runs in its own HTTP request (via /api/public/hubspot-run-step)
// so the Cloudflare Worker timeout (~30s) is respected.
// State is rebuilt from DB each call (no in-memory cache between steps).
import type { SupabaseClient } from "@supabase/supabase-js";
// ─────────────────────────── Step framework ──────────────────────────────────

import {
  appendLog,
  loadResume,
  makeProgressBumper,
  patchItemBefore,
} from "./hubspot-steps-state.server";
import { runCompareStep } from "./hubspot-step-compare.server";
import { runCompaniesStep } from "./hubspot-step-companies.server";
import { runContactsStep } from "./hubspot-step-contacts.server";
import { runDealsStep } from "./hubspot-step-deals.server";
import { runLeadsStep } from "./hubspot-step-leads.server";
import { runTicketsStep } from "./hubspot-step-tickets.server";
import { runActivitiesStep } from "./hubspot-step-activities.server";
import type { StepRunArgs, StepRunState } from "./hubspot-step-run-context";
import {
  discoverActivityTargets,
  discoverDealContactsMap,
  discoverTargetsFromAssociations,
} from "./hubspot-steps-discovery.server";
import type {
  ItemRow,
  ResumeState,
  Scope,
  StepCtx,
  StepName,
  StepResult,
} from "./hubspot-steps-types";

export type { Scope, StepCtx, StepName, StepResult } from "./hubspot-steps-types";

export const STEP_DEPS: Record<StepName, StepName[]> = {
  compare: [],
  companies: ["compare"],
  contacts: ["compare"],
  deals: ["compare"],
  leads: ["compare"],
  tickets: ["compare"],
  "activities-notes": ["compare"],
  "activities-calls": ["compare"],
  "activities-meetings": ["compare"],
  "activities-tasks": ["compare"],
  "activities-emails": ["compare"],
};

const STEP_ORDER: StepName[] = [
  "compare",
  "companies",
  "contacts",
  "deals",
  "leads",
  "tickets",
  "activities-notes",
  "activities-calls",
  "activities-meetings",
  "activities-tasks",
  "activities-emails",
];

export function planSteps(scope: Scope): StepName[] {
  const wanted = new Set<StepName>();
  wanted.add("compare");
  if (scope.companies) wanted.add("companies");
  if (scope.contacts) wanted.add("contacts");
  if (scope.deals) wanted.add("deals");
  if (scope.leads) wanted.add("leads");
  if (scope.tickets) wanted.add("tickets");
  if (scope.activities) {
    wanted.add("activities-notes");
    wanted.add("activities-calls");
    wanted.add("activities-meetings");
    wanted.add("activities-tasks");
    wanted.add("activities-emails");
  }
  return STEP_ORDER.filter((s) => wanted.has(s));
}

const DEFAULT_BUDGET_MS = 22_000;

export async function runStep(ctx: StepCtx): Promise<StepResult> {
  const { supabase, userId, workspaceId, jobId, step, itemId, scope } = ctx;
  const deadlineAt = ctx.deadlineAt ?? Date.now() + DEFAULT_BUDGET_MS;
  const isExpired = () => Date.now() >= deadlineAt;

  const resume = await loadResume(supabase, itemId);
  const isResume = Boolean(resume.cursor || resume.read_index || resume.imported_hs_ids?.length);

  // Initialize / preserve before
  const baseBefore: Record<string, unknown> = {
    ...resume,
    step,
    order: STEP_ORDER.indexOf(step),
    depends_on: STEP_DEPS[step],
    started_at: resume.started_at ?? new Date().toISOString(),
    cursor: resume.cursor,
    read_index: resume.read_index ?? 0,
    running_succeeded: resume.running_succeeded ?? 0,
    running_failed: resume.running_failed ?? 0,
    discovered: resume.discovered,
    imported_hs_ids: resume.imported_hs_ids ?? [],
    last_heartbeat_at: new Date().toISOString(),
    paused: false,
  };
  await supabase
    .from("enrichment_job_items")
    .update({ status: "running", before: baseBefore as never })
    .eq("id", itemId);
  await appendLog(supabase, jobId, {
    level: "info",
    step,
    message: isResume
      ? `Retomando etapa ${step} (cursor=${resume.cursor ?? "—"}, idx=${resume.read_index ?? 0})`
      : `Iniciando etapa ${step}`,
  });
  const bump = makeProgressBumper(supabase, itemId, jobId);

  const st: StepRunState = {
    ok: (resume.running_succeeded as number) ?? 0,
    fail: (resume.running_failed as number) ?? 0,
    imported: [...(resume.imported_hs_ids ?? [])],
    partial: false,
  };

  // Persist progress + cursor (used on each pause / page boundary)
  const persistCursor = async (extra: Record<string, unknown>) => {
    await patchItemBefore(supabase, itemId, {
      running_succeeded: st.ok,
      running_failed: st.fail,
      imported_hs_ids: st.imported,
      ...extra,
    });
  };

  const args: StepRunArgs = {
    supabase,
    userId,
    workspaceId,
    jobId,
    itemId,
    step,
    scope,
    resume,
    st,
    deadlineAt,
    isExpired,
    bump,
    persistCursor,
  };

  try {
    if (step === "compare") {
      return runCompareStep({ supabase, workspaceId, jobId, itemId, scope });
    }

    const runners: Partial<Record<string, (a: StepRunArgs) => Promise<StepResult | void>>> = {
      companies: runCompaniesStep,
      contacts: runContactsStep,
      deals: runDealsStep,
      leads: runLeadsStep,
      tickets: runTicketsStep,
    };
    const runner = step.startsWith("activities-") ? runActivitiesStep : runners[step];
    if (runner) {
      const early = await runner(args);
      if (early) return early;
    }

    if (st.partial) {
      // Mantém status='running' para evitar flicker na UI; o próximo tick
      // reclama itens com (status='pending') OU (status='running' AND before.paused=true).
      await patchItemBefore(supabase, itemId, {
        paused: true,
        last_heartbeat_at: new Date().toISOString(),
      });
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Etapa ${step} pausada para próximo tick (${st.ok} st.ok / ${st.fail} falhas)`,
      });
      return { succeeded: st.ok, failed: st.fail, importedHsIds: st.imported, partial: true };
    }

    await supabase
      .from("enrichment_job_items")
      .update({
        status: "done",
        after: {
          succeeded: st.ok,
          failed: st.fail,
          finished_at: new Date().toISOString(),
          imported_hs_ids: st.imported,
        } as never,
      })
      .eq("id", itemId);
    await appendLog(supabase, jobId, {
      level: "info",
      step,
      message: `Etapa ${step} concluída: ${st.ok} st.ok / ${st.fail} falhas`,
    });
    return { succeeded: st.ok, failed: st.fail, importedHsIds: st.imported };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("enrichment_job_items")
      .update({
        status: "failed",
        error: msg,
        after: { succeeded: st.ok, failed: st.fail, imported_hs_ids: st.imported } as never,
      })
      .eq("id", itemId);
    await appendLog(supabase, jobId, { level: "error", step, message: msg });
    throw e;
  }
}

// Pick the next pending item in the job whose dependencies are all 'done'.
export async function pickNextItem(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ itemId: string; step: StepName } | null> {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("id, status, before")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const doneSteps = new Set(
    items.filter((it) => it.status === "done").map((it) => it.before?.step ?? ""),
  );
  const pending = items
    .filter((it) => it.status === "pending")
    .sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0));
  for (const it of pending) {
    const deps = it.before?.depends_on ?? [];
    if (deps.every((d) => doneSteps.has(d))) {
      return { itemId: it.id, step: (it.before?.step ?? "") as StepName };
    }
  }
  return null;
}

export async function finalizeJob(supabase: SupabaseClient, jobId: string) {
  const { data: rows } = await supabase
    .from("enrichment_job_items")
    .select("status, after")
    .eq("job_id", jobId);
  const items = (rows ?? []) as ItemRow[];
  const total = items.length;
  const doneCount = items.filter((it) => it.status === "done").length;
  const failedCount = items.filter((it) => it.status === "failed").length;
  let succeeded = 0;
  let failed = 0;
  for (const it of items) {
    succeeded += (it.after?.succeeded as number | undefined) ?? 0;
    failed += (it.after?.failed as number | undefined) ?? 0;
  }
  const allDone = doneCount + failedCount === total;
  if (!allDone) {
    await supabase
      .from("enrichment_jobs")
      .update({ processed: doneCount + failedCount, succeeded, failed })
      .eq("id", jobId);
    return false;
  }
  await supabase
    .from("enrichment_jobs")
    .update({
      status: failedCount > 0 && doneCount === 0 ? "failed" : "done",
      processed: total,
      succeeded,
      failed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return true;
}
