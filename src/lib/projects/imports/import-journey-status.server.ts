import { workRpc } from "@/lib/access-control/work-core.server";
import type { JourneyContext } from "./import-journey-access.server";
import type {
  ImportProvider,
  JourneyStatus,
  JourneySource,
  JourneyRun,
  JourneyCoverage,
} from "./import-journey";

export type JourneyRow = {
  id: string;
  workspace_id: string;
  provider: ImportProvider;
  source_id: string;
  source_name: string;
  requested_by: string;
  stage: "collect" | "apply" | "done";
  status: JourneyRun["status"];
  native_run_id: string | null;
  preview_run_id: string | null;
  coverage: Record<string, unknown>;
  counts?: RecordCounts;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  lease_token?: string;
  backfill_done?: boolean;
  backfill_cursor?: string | null;
};
export type RecordCounts = JourneyStatus["summary"];
export async function getCounts(
  ctx: JourneyContext,
  provider?: ImportProvider,
  run?: string | null,
): Promise<RecordCounts> {
  return workRpc(ctx.client, "project_import_record_counts", {
    p_workspace: ctx.workspaceId,
    p_provider: provider ?? null,
    p_run: run ?? null,
  });
}
const label: Record<ImportProvider, string> = {
  clockify: "Clockify",
  jibble: "Jibble",
  clickup: "ClickUp",
};
export async function loadJourneySources(
  ctx: JourneyContext,
  providers: ImportProvider[],
): Promise<JourneySource[]> {
  return Promise.all(
    providers.map(async (provider) => {
      const canManage = await workRpc<boolean>(ctx.client, "project_import_access", {
        p_ws: ctx.workspaceId,
        p_provider: provider,
        p_action: "manage",
        p_user: ctx.userId,
      });
      let configured = false,
        ready = false,
        sourceId: string | null = null,
        sourceName: string | null = null,
        error: string | null = null,
        connectionStatus = "not_configured";
      if (provider === "clockify") {
        const s = await import("@/lib/integrations/clockify/clockify-service.server");
        const c = (await s.getClockifyStatus(ctx)).connection;
        configured = c.configured;
        ready =
          c.status === "connected" &&
          !!c.source?.id &&
          ["owner", "admin"].includes(c.source.access ?? "");
        sourceId = c.source?.id ?? null;
        sourceName = c.source?.name ?? null;
        error = c.lastError;
        connectionStatus = c.status;
      } else if (provider === "jibble") {
        const s = await import("@/lib/integrations/jibble/jibble-service.server");
        const c = (await s.getJibbleStatus(ctx)).connection;
        configured = c.configured;
        ready =
          c.status === "connected" &&
          !!c.org?.id &&
          ["owner", "admin"].includes(c.org.access ?? "");
        sourceId = c.org?.id ?? null;
        sourceName = c.org?.name ?? null;
        error = c.lastError;
        connectionStatus = c.status;
      } else {
        const { data, error: failure } = await ctx.client
          .from("clickup_import_source_bindings" as never)
          .select("team_id,team_name")
          .eq("workspace_id", ctx.workspaceId)
          .order("team_id");
        if (failure) throw new Error(failure.message);
        const bindings = (data ?? []) as unknown as Array<{ team_id: string; team_name: string }>;
        const s = await import("@/lib/integrations/clickup/clickup-import.server");
        const connection = await s.getClickUpConnectionState(ctx);
        configured = connection.configured;
        error = connection.error ?? null;
        ready = configured && bindings.length > 0;
        sourceId = bindings.map((x) => x.team_id).join(",") || null;
        sourceName = bindings.map((x) => x.team_name).join(", ") || null;
        connectionStatus = ready ? "connected" : configured ? "source_required" : "not_configured";
      }
      const entities: Record<ImportProvider, Array<[string, string]>> = {
        clockify: [
          ["workspace", "Organização"],
          ["user", "Pessoas"],
          ["client", "Clientes"],
          ["project", "Projetos"],
          ["task", "Tarefas"],
          ["time_entry", "Lançamentos de horas"],
          ["catalogs", "Catálogos e relatórios"],
        ],
        jibble: [
          ["person", "Pessoas"],
          ["project", "Projetos"],
          ["activity", "Atividades"],
          ["time_entry", "Eventos de ponto"],
          ["hour_entry", "Ajustes e totais"],
          ["catalogs", "Catálogos e timesheets"],
        ],
        clickup: [
          ["hierarchy", "Estrutura e arquivados"],
          ["task", "Tarefas e subtarefas"],
          ["comment", "Comentários"],
          ["time_entry", "Horas próprias"],
          ["attachment", "Anexos"],
          ["document", "Documentos"],
        ],
      };
      const coverage: JourneyCoverage[] = entities[provider].map(([entity, name]) => ({
        entity,
        label: name,
        status: "unknown",
        count: null,
        reason: "A cobertura será comprovada durante a leitura da origem.",
      }));
      return {
        provider,
        label: label[provider],
        canView: true,
        canManage,
        configured,
        ready,
        sourceId,
        sourceName,
        connectionStatus,
        error,
        coverage,
      };
    }),
  );
}
export async function getJourneyStatus(
  ctx: JourneyContext,
  providers: ImportProvider[],
): Promise<JourneyStatus> {
  const [sources, runResult, summary] = await Promise.all([
    loadJourneySources(ctx, providers),
    ctx.client
      .from("project_import_journeys" as never)
      .select(
        "id,workspace_id,provider,source_id,source_name,requested_by,stage,status,native_run_id,preview_run_id,backfill_done,coverage,counts,error,created_at,finished_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .in("provider", providers)
      .order("created_at", { ascending: false })
      .limit(30),
    getCounts(ctx),
  ]);
  if (runResult.error) throw new Error(runResult.error.message);
  const runs = await Promise.all(
    ((runResult.data ?? []) as unknown as JourneyRow[]).map(async (r) => {
      const counts = r.counts ?? { received: 0, ready: 0, pending: 0, unclassified: 0 };
      return {
        id: r.id,
        provider: r.provider,
        sourceName: r.source_name,
        status: r.status,
        phase: !r.backfill_done
          ? "Organizando o histórico anterior"
          : r.stage === "collect"
            ? "Recebendo registros da origem"
            : r.stage === "apply"
              ? "Preparando registros para uso"
              : "Recebimento encerrado",
        received: counts.received,
        ready: counts.ready,
        pending: counts.pending,
        coverageComplete: r.coverage.complete === true,
        sourceLimited: r.coverage.sourceLimited === true,
        error: r.error,
        createdAt: r.created_at,
        finishedAt: r.finished_at,
        resumable:
          (r.stage !== "done" && r.status !== "complete") ||
          (r.status === "partial" && r.coverage.retryable !== false),
      } satisfies JourneyRun;
    }),
  );
  for (const source of sources) {
    source.latestRun = runs.find((r) => r.provider === source.provider);
    const row = (runResult.data as unknown as JourneyRow[]).find(
      (r) => r.provider === source.provider,
    );
    if (Array.isArray(row?.coverage.entities))
      source.coverage = row.coverage.entities as JourneyCoverage[];
  }
  const historyChecks = await Promise.all(
    providers.map(async (provider) => {
      if (
        ((runResult.data ?? []) as unknown as JourneyRow[]).some(
          (r) => r.provider === provider && r.backfill_done,
        )
      )
        return false;
      const table =
        provider === "clockify"
          ? "clockify_staging_records"
          : provider === "jibble"
            ? "time_import_staging"
            : "clickup_import_tasks";
      const found = await ctx.client
        .from(table as never)
        .select("external_id")
        .eq("workspace_id", ctx.workspaceId)
        .limit(1);
      if (found.error) throw new Error(found.error.message);
      return !!found.data?.length;
    }),
  );
  return {
    workspaceId: ctx.workspaceId,
    sources,
    runs,
    summary,
    legacyPending: historyChecks.some(Boolean),
  };
}
