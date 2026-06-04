// Tick-based execution for HubSpot imports.
// One tick = one pending item (= one step from planSteps) executed in its own
// HTTP request, so the Cloudflare Worker timeout (~30s) only has to fit a
// single step instead of an entire pipeline.
//
// Drivers:
// • UI live timeline calls tickHubspotImportJob every few seconds while open.
// • pg_cron calls /api/public/hooks/hubspot-tick every minute as a fallback
//   so jobs progress even when no one is watching the screen.
//
// Concurrency: each tick claims one pending item atomically
// (`UPDATE ... WHERE status='pending' RETURNING *`). If no row is claimed,
// another tick is already working on this job — return early.

import type { SupabaseClient } from "@supabase/supabase-js";
import { runStep, planSteps, STEP_DEPS, type StepName, type Scope } from "./hubspot-steps.server";

type LogEntry = { ts: string; level: "info" | "warn" | "error"; step: string; message: string; count?: number };

async function appendLog(supabase: SupabaseClient, jobId: string, entry: Omit<LogEntry, "ts">) {
  const full: LogEntry = { ...entry, ts: new Date().toISOString() };
  const { data: cur } = await supabase
    .from("enrichment_jobs")
    .select("step_logs")
    .eq("id", jobId)
    .single();
  const arr = Array.isArray(cur?.step_logs) ? (cur!.step_logs as LogEntry[]) : [];
  const next = [...arr, full].slice(-300);
  await supabase.from("enrichment_jobs").update({ step_logs: next as never }).eq("id", jobId);
}

// Cria os itens (1 por step) para o job. Idempotente: só cria se ainda não houver.
export async function ensureJobItems(supabase: SupabaseClient, jobId: string, steps: StepName[]) {
  const { data: existing } = await supabase
    .from("enrichment_job_items")
    .select("id, before")
    .eq("job_id", jobId);
  const have = new Set(
    (existing ?? []).map((it) => (it.before as { step?: string } | null)?.step).filter(Boolean)
  );
  const rows = steps
    .filter((s) => !have.has(s))
    .map((s, i) => ({
      job_id: jobId,
      status: "pending",
      before: { step: s, order: i, depends_on: STEP_DEPS[s] } as never,
    }));
  if (rows.length > 0) await supabase.from("enrichment_job_items").insert(rows);
}

type TickResult =
  | { kind: "no_job" }
  | { kind: "no_pending"; jobId: string; finished: true }
  | { kind: "ran"; jobId: string; step: StepName; ok: number; fail: number; finished: boolean }
  | { kind: "busy"; jobId: string }
  | { kind: "error"; jobId: string; message: string };

async function repairPrematureDependents(supabase: SupabaseClient, jobId: string, items: unknown[]) {
  const rows = items as { id: string; status: string; before: { step?: string; depends_on?: string[]; [k: string]: unknown } | null; after: { succeeded?: number; failed?: number; imported_hs_ids?: string[] } | null }[];
  const unfinishedSteps = new Set(
    rows
      .filter((it) => it.status !== "done")
      .map((it) => it.before?.step)
      .filter(Boolean) as string[],
  );
  const toReset = rows.filter((it) => {
    const deps = it.before?.depends_on ?? [];
    const zeroResult = (it.after?.succeeded ?? 0) === 0 && (it.after?.failed ?? 0) === 0 && (it.after?.imported_hs_ids?.length ?? 0) === 0;
    const depsUnfinished = deps.some((dep) => unfinishedSteps.has(dep));
    if (!depsUnfinished) return false;
    return it.status === "running" || (it.status === "done" && zeroResult);
  });
  for (const item of toReset) {
    const before = { ...((item.before as Record<string, unknown> | null) ?? {}), paused: false };
    await supabase
      .from("enrichment_job_items")
      .update({ status: "pending", before: before as never, after: null, error: null })
      .eq("id", item.id);
  }
  if (toReset.length > 0) {
    await appendLog(supabase, jobId, {
      level: "warn",
      step: "scheduler",
      message: `Reabrindo ${toReset.length} etapa(s) que haviam concluído antes das dependências`,
    });
  }
  return toReset.length;
}

// Encontra próximo job HubSpot para executar (queued/running) e processa UM step.
// Quando ownerId é fornecido, restringe ao owner; quando undefined (cron),
// pega qualquer job — o supabase client passado deve ser o admin.
export async function tickOnce(
  supabase: SupabaseClient,
  jobId?: string,
  ownerId?: string,
): Promise<TickResult> {
  // 1) Selecionar o job
  let job: { id: string; scope: unknown; status: string; owner_id: string } | null = null;
  if (jobId) {
    const q = supabase.from("enrichment_jobs").select("id, scope, status, owner_id, workspace_id").eq("id", jobId);
    if (ownerId) q.eq("owner_id", ownerId);
    const { data } = await q.maybeSingle();
    job = data ?? null;
  } else {
    let q = supabase
      .from("enrichment_jobs")
      .select("id, scope, status, owner_id, workspace_id")
      .eq("provider", "hubspot")
      .eq("kind", "import")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(1);
    if (ownerId) q = q.eq("owner_id", ownerId);
    const { data } = await q.maybeSingle();
    job = data ?? null;
  }
  if (!job) return { kind: "no_job" };
  // Cancelled/finished jobs must not execute new steps
  if (job.status !== "queued" && job.status !== "running") {
    return { kind: "no_pending", jobId: job.id, finished: true };
  }

  const scope = (job.scope ?? {}) as Scope;

  // 2) Pegar próximo item pending e claim atômico
  const { data: items } = await supabase
    .from("enrichment_job_items")
    .select("id, status, before, after")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });

  const allItems = items ?? [];
  if (await repairPrematureDependents(supabase, job.id, allItems)) {
    return { kind: "busy", jobId: job.id };
  }

  // 2a) Zombie reaper: itens em 'running' sem heartbeat recente (>90s) viram
  // pausados, permitindo que outro tick os reclame.
  const ZOMBIE_MS = 90_000;
  const now = Date.now();
  for (const it of allItems) {
    if (it.status !== "running") continue;
    const before = (it.before as { last_heartbeat_at?: string; started_at?: string; paused?: boolean } | null) ?? {};
    if (before.paused) continue;
    const beat = before.last_heartbeat_at ?? before.started_at;
    const age = beat ? now - new Date(beat).getTime() : Infinity;
    if (age > ZOMBIE_MS) {
      await supabase
        .from("enrichment_job_items")
        .update({ before: { ...before, paused: true } as never })
        .eq("id", it.id);
      await appendLog(supabase, job.id, {
        level: "warn",
        step: (before as { step?: string }).step ?? "scheduler",
        message: `Item travado há ${Math.round(age / 1000)}s → reagendado para próximo tick`,
      });
      // Reflete a mudança em memória para o resto deste tick
      it.before = { ...before, paused: true } as never;
    }
  }

  const doneSteps = new Set(
    allItems
      .filter((it) => it.status === "done")
      .map((it) => ((it.before as { step?: string } | null)?.step ?? ""))
      .filter(Boolean),
  );
  // Pendente = status pending OU running+paused (resumível)
  const claimable = allItems
    .filter((it) => {
      if (it.status === "pending") return true;
      if (it.status === "running" && (it.before as { paused?: boolean } | null)?.paused) return true;
      return false;
    })
    .sort(
      (a, b) =>
        (((a.before as { order?: number } | null)?.order ?? 0) -
          ((b.before as { order?: number } | null)?.order ?? 0)),
    );
  const pending = claimable.find((it) => {
    const deps = ((it.before as { depends_on?: string[] } | null)?.depends_on ?? []) as string[];
    return deps.every((d) => doneSteps.has(d));
  });
  const blockedPending = claimable.length > 0 && !pending;
  // Considera 'running ativo' apenas itens não-pausados
  const running = allItems.find(
    (it) => it.status === "running" && !(it.before as { paused?: boolean } | null)?.paused,
  );
  const anyUnfinished = pending || running || blockedPending;

  // Sem nada pra fazer → finalizar job
  if (!anyUnfinished) {
    const totals = (items ?? []).reduce(
      (acc, it) => {
        const a = (it.after as { succeeded?: number; failed?: number } | null) ?? {};
        return {
          succeeded: acc.succeeded + (a.succeeded ?? 0),
          failed: acc.failed + (a.failed ?? 0),
        };
      },
      { succeeded: 0, failed: 0 },
    );
    const anyFailed = (items ?? []).some((it) => it.status === "failed");
    await supabase
      .from("enrichment_jobs")
      .update({
        status: anyFailed ? "failed" : "done",
        succeeded: totals.succeeded,
        failed: totals.failed,
        processed: items?.length ?? 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await appendLog(supabase, job.id, {
      level: "info",
      step: "done",
      message: `Importação finalizada: ${totals.succeeded} ok / ${totals.failed} falhas`,
    });
    return { kind: "no_pending", jobId: job.id, finished: true };
  }

  // Se há item já 'running' ativo (não pausado), outro worker está nele → sair
  if (running) {
    return { kind: "busy", jobId: job.id };
  }
  if (!pending) return { kind: "busy", jobId: job.id };

  if (blockedPending) {
    return { kind: "busy", jobId: job.id };
  }

  // Claim atômico: aceita SOMENTE pending OU running+paused=true.
  // Sem isso, dois ticks simultâneos (UI + cron) reclamam o mesmo item
  // ativo, um deles marca a etapa como 'done' por um instante, e os
  // dependentes disparam vazios antes da etapa-pai realmente terminar.
  const prevBefore = (pending.before as Record<string, unknown> | null) ?? {};
  const isPaused = (prevBefore as { paused?: boolean }).paused === true;
  const claimedBefore = { ...prevBefore, paused: false, last_heartbeat_at: new Date().toISOString() };
  let claimQuery = supabase
    .from("enrichment_job_items")
    .update({ status: "running", before: claimedBefore as never })
    .eq("id", pending.id);
  if (isPaused) {
    // Só reclama se ainda estiver pausado (CAS via JSON flag).
    claimQuery = claimQuery.eq("status", "running").eq("before->>paused", "true");
  } else {
    claimQuery = claimQuery.eq("status", "pending");
  }
  const { data: claimed, error: claimErr } = await claimQuery.select("id").maybeSingle();
  if (claimErr || !claimed) {
    return { kind: "busy", jobId: job.id };
  }

  // Garantir que o job esteja em 'running'
  if (job.status !== "running") {
    await supabase
      .from("enrichment_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);
  } else {
    await supabase.from("enrichment_jobs").update({ updated_at: new Date().toISOString() }).eq("id", job.id);
  }

  const step = (pending.before as { step?: StepName } | null)?.step as StepName;
  if (!step) {
    await supabase
      .from("enrichment_job_items")
      .update({ status: "failed", after: { error: "Item sem 'step'" } as never })
      .eq("id", pending.id);
    return { kind: "error", jobId: job.id, message: "Item sem step" };
  }

  // 3) Executar o step (com orçamento de 22s; runStep gerencia status do item)
  try {
    const result = await runStep({
      supabase,
      userId: job.owner_id,
      workspaceId: job.workspace_id ?? job.owner_id,
      jobId: job.id,
      step,
      itemId: pending.id,
      scope,
      deadlineAt: Date.now() + 22_000,
    });
    // runStep already updated item status to done/pending/failed and
    // wrote after/before. Do NOT overwrite here.

    // Atualizar contadores do job — soma os finalizados + os em execução
    // para que a UI veja progresso real, não só steps completos.
    const { data: refreshed } = await supabase
      .from("enrichment_job_items")
      .select("status, before, after")
      .eq("job_id", job.id);
    const doneCount = (refreshed ?? []).filter((it) => it.status === "done" || it.status === "failed").length;
    const sumSucc = (refreshed ?? []).reduce((s, it) => {
      const done = (it.after as { succeeded?: number } | null)?.succeeded ?? 0;
      const running = (it.before as { running_succeeded?: number } | null)?.running_succeeded ?? 0;
      return s + (it.status === "done" || it.status === "failed" ? done : running);
    }, 0);
    const sumFail = (refreshed ?? []).reduce((s, it) => {
      const done = (it.after as { failed?: number } | null)?.failed ?? 0;
      const running = (it.before as { running_failed?: number } | null)?.running_failed ?? 0;
      return s + (it.status === "done" || it.status === "failed" ? done : running);
    }, 0);
    await supabase
      .from("enrichment_jobs")
      .update({ processed: doneCount, succeeded: sumSucc, failed: sumFail })
      .eq("id", job.id);

    const stillPending = (refreshed ?? []).some(
      (it) => it.status === "pending" || it.status === "running",
    );
    if (!stillPending) {
      const anyFailed = (refreshed ?? []).some((it) => it.status === "failed");
      await supabase
        .from("enrichment_jobs")
        .update({ status: anyFailed ? "failed" : "done", finished_at: new Date().toISOString() })
        .eq("id", job.id);
      await appendLog(supabase, job.id, {
        level: "info",
        step: "done",
        message: `Importação finalizada: ${sumSucc} ok / ${sumFail} falhas`,
      });
    }

    return {
      kind: "ran",
      jobId: job.id,
      step,
      ok: result.succeeded,
      fail: result.failed,
      finished: !stillPending,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("enrichment_job_items")
      .update({ status: "failed", after: { error: msg } as never })
      .eq("id", pending.id);
    await appendLog(supabase, job.id, { level: "error", step, message: msg });
    return { kind: "error", jobId: job.id, message: msg };
  }
}

// Helper: cria item plan a partir do scope (5-key) usando o planSteps 9-step.
export function planStepsFromScope(scope: Scope): StepName[] {
  return planSteps(scope);
}
