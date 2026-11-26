import { workRpc } from "@/lib/access-control/work-core.server";
import type { JourneyContext } from "./import-journey-access.server";
import { allowedImportProviders } from "./import-journey-access.server";
import { IMPORT_ENTITY_LABELS, type ImportProvider, type JourneyCoverage } from "./import-journey";
import {
  getJourneyStatus,
  getCounts,
  loadJourneySources,
  type JourneyRow,
} from "./import-journey-status.server";

// This service never writes project_time_entries or financial entries. Native guarded import RPCs remain authoritative.
type NativeRun = {
  id: string;
  kind?: string;
  status: string;
  phase?: string;
  report?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  error?: string | null;
  source_team_ids?: string[];
  collect_coverage?: Record<string, unknown>;
  collect_cursor?: { phase?: string; gaps?: Array<{ entity: string; reason: string }> };
  source_workspace_id?: string;
  source_org_id?: string;
  preview_run_id?: string | null;
};
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
const table = (provider: ImportProvider) =>
  provider === "clockify"
    ? "clockify_import_runs"
    : provider === "jibble"
      ? "time_import_runs"
      : "clickup_import_runs";
async function nativeRun(
  ctx: JourneyContext,
  provider: ImportProvider,
  id: string,
): Promise<NativeRun> {
  let query = ctx.client
    .from(table(provider) as never)
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id);
  if (provider === "jibble") query = query.eq("provider", "jibble").neq("kind", "rollback");
  const result = await query.maybeSingle();
  if (result.error || !result.data)
    throw new Error("A execução desta origem não está disponível neste workspace.");
  return result.data as unknown as NativeRun;
}
async function status(ctx: JourneyContext) {
  const { providers } = await allowedImportProviders(ctx.client, ctx.userId);
  return getJourneyStatus(ctx, providers);
}
function safeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "A coleta foi interrompida. Retome para continuar.";
  return /https?:\/\/|(?:token|api.?key|authorization)\s*[:=]|pk_[a-z\d]/i.test(message)
    ? "A leitura da origem foi interrompida. Confira a conexão e retome sem perder o histórico."
    : message.slice(0, 600);
}

export async function startJourney(ctx: JourneyContext, providers: ImportProvider[]) {
  const sources = await loadJourneySources(ctx, providers);
  if (sources.some((s) => !s.canManage || !s.ready || !s.sourceId))
    throw new Error(
      "Conecte e confirme as organizações das origens escolhidas antes de continuar.",
    );
  for (const source of sources)
    await workRpc(ctx.client, "project_import_journey_begin", {
      p_workspace: ctx.workspaceId,
      p_provider: source.provider,
      p_source: source.sourceId,
      p_name: source.sourceName ?? source.label,
    });
  return status(ctx);
}
async function createNative(ctx: JourneyContext, row: JourneyRow) {
  // Reuse a native active run instead of creating a second job after a lost HTTP response.
  let openQuery = ctx.client
    .from(table(row.provider) as never)
    .select("*")
    .eq("workspace_id", ctx.workspaceId);
  if (row.provider === "jibble")
    openQuery = openQuery.eq("provider", "jibble").neq("kind", "rollback");
  const open = await openQuery
    .in(
      "status",
      row.provider === "clickup"
        ? ["collecting", "planned", "applying"]
        : ["queued", "running", "paused"],
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open.error) throw new Error(open.error.message);
  if (open.data) {
    const existing = open.data as unknown as NativeRun;
    if (
      row.provider !== "clickup" &&
      (existing.source_workspace_id ?? existing.source_org_id) !== row.source_id
    )
      throw new Error(
        "Há uma execução de outra origem em andamento. Confira a conexão e retome a execução anterior.",
      );
    if (row.provider === "clickup" && !(existing.source_team_ids ?? []).length) {
      if (["collecting", "planned"].includes(existing.status)) {
        // Adoption has already preserved old snapshots. Native start retires only unapplied previews,
        // retaining their rows and decisions; the new collector proves the selected scope afresh.
        const s = await import("@/lib/integrations/clickup/clickup-import.server");
        const created = await s.startCollect(ctx);
        return { native_run_id: created.runId, stage: "collect", preview_run_id: null };
      }
      await assertLegacyClickUpScope(ctx, row, existing.id);
      return { native_run_id: existing.id, stage: "collect", preview_run_id: null };
    }
    if (
      row.provider === "clickup" &&
      [...(existing.source_team_ids ?? [])].sort().join(",") !==
        row.source_id.split(",").sort().join(",")
    )
      throw new Error(
        "A execução anterior usa outras organizações. Restaure as origens confirmadas ou encerre a execução antiga antes de iniciar outra.",
      );
    return {
      native_run_id: existing.id,
      stage:
        existing.kind === "import" || ["planned", "applying"].includes(existing.status)
          ? "apply"
          : "collect",
      preview_run_id: existing.preview_run_id ?? null,
    };
  }
  if (row.provider === "clockify") {
    const s = await import("@/lib/integrations/clockify/clockify-service.server");
    const created = await s.startClockifyRun(ctx, {
      kind: "dry_run",
      options: { refetch: true, noProjectPolicy: "stage", erpStatus: "locked" },
    });
    return { native_run_id: created.runId, stage: "collect" };
  }
  if (row.provider === "jibble") {
    const s = await import("@/lib/integrations/jibble/jibble-service.server");
    const created = await s.startJibbleRun(ctx, {
      kind: "dry_run",
      options: { refetch: true, fromDate: null, erpStatus: "locked", billable: false },
    });
    return { native_run_id: created.runId, stage: "collect" };
  }
  const s = await import("@/lib/integrations/clickup/clickup-import.server");
  const created = await s.startCollect(ctx);
  return { native_run_id: created.runId, stage: "collect" };
}
async function assertLegacyClickUpScope(ctx: JourneyContext, row: JourneyRow, runId: string) {
  const selected = new Set(row.source_id.split(","));
  let found = false;
  for (let from = 0; ; from += 1000) {
    const result = await ctx.client
      .from("clickup_import_groups" as never)
      .select("team_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("run_id", runId)
      .order("list_ext_id")
      .range(from, from + 999);
    if (result.error)
      throw new Error("Não foi possível conferir as organizações da execução anterior.");
    const groups = (result.data ?? []) as Array<{ team_id: string }>;
    if (groups.some((g) => !selected.has(g.team_id)))
      throw new Error(
        "A aplicação anterior inclui uma organização não confirmada. Confira as origens antes de continuar.",
      );
    found ||= groups.length > 0;
    if (groups.length < 1000) break;
  }
  if (!found)
    throw new Error(
      "A aplicação anterior não tem origem comprovada. Confira essa execução no histórico antes de continuar.",
    );
}
async function existingApply(
  ctx: JourneyContext,
  row: JourneyRow,
  previewId: string,
): Promise<string | null> {
  let query = ctx.client
    .from(table(row.provider) as never)
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("kind", "import")
    .eq("preview_run_id", previewId)
    .neq("status", "cancelled");
  if (row.provider === "jibble") query = query.eq("provider", "jibble");
  const r = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return (r.data as unknown as { id: string } | null)?.id ?? null;
}
export function normalizeJourneyCoverage(run: NativeRun) {
  const raw = (run.collect_coverage ?? run.report?.coverage ?? run.counts?.coverage) as
    | {
        complete?: boolean;
        gaps?: Array<{ entity?: string; reason?: string }>;
        entities?: JourneyCoverage[];
      }
    | undefined;
  const gaps = raw?.gaps ?? [];
  const inventory = (run.report?.inventory ??
    run.report?.capabilities ??
    run.counts?.capabilities ??
    {}) as Record<
    string,
    { capability?: string; status?: string; count?: number; detail?: string }
  >;
  const entities: JourneyCoverage[] =
    raw?.entities ??
    Object.entries(inventory).map(([entity, c]) => ({
      entity,
      label: IMPORT_ENTITY_LABELS[entity] ?? entity.replaceAll("_", " "),
      status: ["ok", "collected", "empty"].includes(c.capability ?? c.status ?? "")
        ? "available"
        : "unavailable",
      count: typeof c.count === "number" ? c.count : null,
      ...(c.detail ? { reason: c.detail } : {}),
    }));
  for (const gap of gaps) {
    const entity = gap.entity ?? "origin",
      current = entities.find((e) => e.entity === entity);
    if (current) {
      current.status = "unavailable";
      current.reason = gap.reason ?? "Cobertura não comprovada.";
    } else
      entities.push({
        entity,
        label: IMPORT_ENTITY_LABELS[entity] ?? entity.replaceAll("_", " "),
        status: "unavailable",
        count: null,
        reason: gap.reason ?? "Cobertura não comprovada.",
      });
  }
  return { complete: raw?.complete === true && gaps.length === 0, entities, gaps };
}
async function advanceTime(
  ctx: JourneyContext,
  row: JourneyRow,
  resume: boolean,
): Promise<Record<string, unknown>> {
  const id = row.native_run_id!;
  let run = await nativeRun(ctx, row.provider, id);
  if (row.provider === "clockify") {
    const s = await import("@/lib/integrations/clockify/clockify-service.server");
    if (resume && ["paused", "failed"].includes(run.status))
      await s.setClockifyRunState(ctx, id, "resume");
    await s.advanceClockifyRun(ctx.workspaceId, id);
  } else {
    const s = await import("@/lib/integrations/jibble/jibble-service.server");
    if (resume && ["paused", "failed"].includes(run.status))
      await s.setJibbleRunState(ctx, id, "resume");
    await s.advanceJibbleRun(ctx.workspaceId, id);
  }
  run = await nativeRun(ctx, row.provider, id);
  if (["paused", "failed", "cancelled"].includes(run.status))
    return {
      status: "paused",
      error: safeError(
        new Error(run.error ?? "A origem parou antes de terminar. Retome a coleta."),
      ),
    };
  if (run.status !== "completed") return { status: "running" };
  if (row.stage === "collect") {
    const coverage = normalizeJourneyCoverage(run);
    // The user's single Import-all confirmation authorizes guarded normalization, not approval of invalid hours.
    if (row.provider === "clockify") {
      const s = await import("@/lib/integrations/clockify/clockify-service.server");
      const existing = await existingApply(ctx, row, id);
      if (existing)
        return { preview_run_id: id, native_run_id: existing, stage: "apply", coverage };
      await s.confirmClockifyPreview(ctx, id);
      const started = await s.startClockifyRun(ctx, { kind: "import", previewRunId: id });
      return { preview_run_id: id, native_run_id: started.runId, stage: "apply", coverage };
    }
    const s = await import("@/lib/integrations/jibble/jibble-service.server");
    const existing = await existingApply(ctx, row, id);
    if (existing) return { preview_run_id: id, native_run_id: existing, stage: "apply", coverage };
    await s.confirmJibblePreview(ctx, id);
    const started = await s.startJibbleRun(ctx, { kind: "import", previewRunId: id });
    return { preview_run_id: id, native_run_id: started.runId, stage: "apply", coverage };
  }
  const complete = row.coverage.complete === true;
  const classified = await workRpc<{ done: boolean }>(ctx.client, "project_import_ready_step", {
    p_workspace: ctx.workspaceId,
    p_journey: row.id,
    p_limit: 500,
  });
  if (!classified.done) return { status: "running" };
  return {
    stage: "done",
    status: complete ? "complete" : "partial",
    coverage: row.coverage,
    error: complete
      ? null
      : "Os registros recebidos foram preservados. Há limitações de cobertura da origem; confira os detalhes antes de considerar o histórico integral.",
  };
}
async function advanceClickUp(
  ctx: JourneyContext,
  row: JourneyRow,
): Promise<Record<string, unknown>> {
  const s = await import("@/lib/integrations/clickup/clickup-import.server"),
    id = row.native_run_id!;
  const before = await nativeRun(ctx, "clickup", id);
  if (["rolled_back", "discarded"].includes(before.status))
    return {
      status: "paused",
      error:
        "Esta execução foi encerrada em outra sessão. Os originais permanecem preservados; confira o histórico antes de iniciar uma nova importação.",
    };
  if (!(before.source_team_ids ?? []).length && ["applying", "applied"].includes(before.status)) {
    await assertLegacyClickUpScope(ctx, row, id);
    if (before.status === "applying") await s.runStep(ctx, "apply", id);
    const legacy = await nativeRun(ctx, "clickup", id);
    // Finish the already-started transactional application first. Then collect the full scope,
    // without treating an old partial snapshot as complete coverage or repeating its linked rows.
    return legacy.status === "applied"
      ? { native_run_id: null, preview_run_id: null, stage: "collect", coverage: {} }
      : { status: "running" };
  }
  if (row.stage === "collect" && before.status === "collecting") {
    const collected = await s.collectStep(ctx, id);
    if (collected.waitSeconds > 0)
      return {
        coverage: { ...row.coverage, waitUntil: Date.now() + collected.waitSeconds * 1000 },
        status: "running",
      };
    if (!collected.done) return { status: "running" };
    await s.finishCollect(ctx, id, collected.cursor);
    const current = await nativeRun(ctx, "clickup", id);
    return {
      stage: "apply",
      preview_run_id: id,
      coverage: await clickUpCoverage(ctx, id, current),
    };
  }
  if (row.stage === "collect" && ["planned", "applying", "applied"].includes(before.status))
    return { stage: "apply", preview_run_id: id, coverage: await clickUpCoverage(ctx, id, before) };
  if (!["applied", "rolled_back", "discarded", "failed"].includes(before.status))
    await s.runStep(ctx, "apply", id);
  const current = await nativeRun(ctx, "clickup", id);
  if (current.status === "failed")
    return {
      status: "paused",
      error: safeError(new Error(current.error ?? "A aplicação dos dados foi interrompida.")),
    };
  if (current.status !== "applied") return { status: "running" };
  const classified = await workRpc<{ done: boolean }>(ctx.client, "project_import_ready_step", {
    p_workspace: ctx.workspaceId,
    p_journey: row.id,
    p_limit: 500,
  });
  if (!classified.done) return { status: "running" };
  const coverage = await clickUpCoverage(ctx, id, current),
    complete = coverage.complete;
  return {
    stage: "done",
    status: complete ? "complete" : "partial",
    coverage,
    error: complete
      ? null
      : coverage.sourceLimited && !coverage.retryable
        ? "Todos os registros disponibilizados pela API foram recebidos. A origem não disponibiliza alguns formatos ou itens excluídos; confira as limitações da cobertura."
        : "Coleta com lacunas: os registros recebidos estão preservados, mas a cobertura ainda não é integral. Confira os tipos sem acesso ou conteúdo indisponível.",
  };
}
async function clickUpCoverage(ctx: JourneyContext, runId: string, run: NativeRun) {
  const coverage = normalizeJourneyCoverage(run);
  const counts = await workRpc<Array<{ entity: string; count: number }>>(
    ctx.client,
    "project_import_entity_counts",
    { p_workspace: ctx.workspaceId, p_provider: "clickup", p_run: runId },
  );
  const byEntity = new Map(counts.map((c) => [c.entity, c.count]));
  for (const entity of [
    "organization",
    "person",
    "space",
    "folder",
    "list",
    "task",
    "comment",
    "time_entry",
    "attachment",
    "document",
    "document_page",
  ]) {
    const gap = coverage.entities.find((c) => c.entity === entity);
    if (gap) gap.count = byEntity.get(entity) ?? null;
    else
      coverage.entities.push({
        entity,
        label: IMPORT_ENTITY_LABELS[entity] ?? entity,
        status: coverage.complete ? "available" : "unknown",
        count: byEntity.get(entity) ?? (coverage.complete ? 0 : null),
        ...(!coverage.complete
          ? { reason: "A coleta teve lacunas; confira as capacidades que a origem disponibilizou." }
          : {}),
      });
  }
  const capabilities = run.collect_coverage?.capabilities as Record<string, string> | undefined;
  for (const [entity, reason] of Object.entries(capabilities ?? {}))
    coverage.entities.push({
      entity,
      label: IMPORT_ENTITY_LABELS[entity] ?? entity,
      status: "not_collected",
      count: null,
      reason,
    });
  const sourceLimited = Object.keys(capabilities ?? {}).length > 0;
  return {
    ...coverage,
    complete: coverage.complete && !sourceLimited,
    sourceLimited,
    retryable: coverage.gaps.length > 0,
  };
}
export async function advanceJourney(
  ctx: JourneyContext,
  input: { provider: ImportProvider; runId: string; action?: "advance" | "resume" },
) {
  const claimed = await workRpc<JourneyRow | null>(ctx.client, "project_import_journey_claim", {
    p_workspace: ctx.workspaceId,
    p_id: input.runId,
    p_provider: input.provider,
  });
  if (!claimed) return status(ctx);
  if (claimed.provider !== input.provider) throw new Error("Origem da execução divergente.");
  const db = await admin();
  let patch: Record<string, unknown> = {};
  try {
    if (!claimed.backfill_done) {
      const legacy = await workRpc<{ cursor: string | null; done: boolean; count: number }>(
        ctx.client,
        "project_import_preserve_legacy_step",
        {
          p_workspace: ctx.workspaceId,
          p_provider: claimed.provider,
          p_after: claimed.backfill_cursor ?? null,
          p_limit: 500,
          p_journey: claimed.id,
        },
      );
      patch = { backfill_done: legacy.done, backfill_cursor: legacy.cursor, status: "running" };
    } else if (Number(claimed.coverage.waitUntil ?? 0) > Date.now()) patch = { status: "running" };
    else if (!claimed.native_run_id) patch = await createNative(ctx, claimed);
    else
      patch =
        claimed.provider === "clickup"
          ? await advanceClickUp(ctx, claimed)
          : await advanceTime(ctx, claimed, input.action === "resume");
  } catch (error) {
    patch = { status: "paused", error: safeError(error) };
  }
  patch.counts = await getCounts(ctx, claimed.provider, claimed.id);
  const saved = await workRpc<boolean>(db, "project_import_journey_checkpoint", {
    p_workspace: ctx.workspaceId,
    p_id: claimed.id,
    p_lease: claimed.lease_token,
    p_patch: patch,
  });
  if (!saved)
    throw new Error("Outra sessão avançou esta execução. Atualize para conferir o estado atual.");
  return status(ctx);
}
