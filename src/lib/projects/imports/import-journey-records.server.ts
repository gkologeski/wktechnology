import { workRpc } from "@/lib/access-control/work-core.server";
import { authorizeImportJourney, type JourneyContext } from "./import-journey-access.server";
import type {
  ImportProvider,
  JourneyRecord,
  JourneyRecordDetail,
  JourneyRecordFilters,
  JourneyRecordPage,
} from "./import-journey";
import { sanitizeImportPayload } from "./import-preservation.server";
import { listJourneyEvidence, resolveImportSourceName } from "./import-journey-evidence.server";

type Row = {
  id: string;
  workspace_id: string;
  provider: ImportProvider;
  source_id: string;
  entity_type: string;
  external_id: string;
  label: string;
  status: JourneyRecord["status"];
  issues: string[];
  last_seen_at: string;
  version_count: number;
  current_version_number: number;
  payload: unknown;
  target_id: string | null;
  target_type: JourneyRecordDetail["targetType"] | null;
  review_assignee_id: string | null;
};
const recordColumns =
  "id,workspace_id,provider,source_id,entity_type,external_id,label,status,issues,last_seen_at,version_count,current_version_number,target_id,target_type,review_assignee_id";
const mapRecord = (r: Row): JourneyRecord => ({
  id: r.id,
  provider: r.provider,
  entity: r.entity_type,
  label: r.label,
  externalId: r.external_id,
  sourceName: r.source_id,
  status: r.status,
  issues: r.issues,
  receivedAt: r.last_seen_at,
  versionCount: r.version_count,
  reviewAssigneeId: r.review_assignee_id,
});
async function loadRecord(ctx: JourneyContext, id: string, write = false) {
  const { data, error } = await ctx.client
    .from("project_import_records" as never)
    .select(`${recordColumns},payload`)
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Registro indisponível ou sem permissão.");
  const row = data as unknown as Row;
  await authorizeImportJourney(ctx.client, ctx.userId, row.provider, write);
  return row;
}
export async function listJourneyRecords(
  ctx: JourneyContext,
  providers: ImportProvider[],
  filters: JourneyRecordFilters,
): Promise<JourneyRecordPage> {
  const page = filters.page ?? 0,
    pageSize = 50;
  if (filters.provider && !providers.includes(filters.provider))
    throw new Error("Origem indisponível.");
  const result = await workRpc<{ rows: Row[]; total: number }>(
    ctx.client,
    "project_import_records_page",
    {
      p_workspace: ctx.workspaceId,
      p_provider: filters.provider ?? null,
      p_status: filters.issuesOnly ? "pending" : (filters.status ?? null),
      p_query: filters.q ?? "",
      p_page: page,
      p_assignee: filters.assigneeId ?? null,
    },
  );
  return { records: result.rows.map(mapRecord), total: result.total, page, pageSize };
}
function linkInfo(r: Row): Pick<JourneyRecordDetail, "targetType" | "linkExternalId"> {
  const p = (r.payload && typeof r.payload === "object" ? r.payload : {}) as Record<
    string,
    unknown
  >;
  if (["user", "person"].includes(r.entity_type))
    return { targetType: "member", linkExternalId: r.external_id };
  if (r.entity_type === "project") return { targetType: "project", linkExternalId: r.external_id };
  if (r.provider === "clockify" && r.entity_type === "time_entry") {
    if (r.issues.some((x) => /user|person|identity/.test(x)) && typeof p.userId === "string")
      return { targetType: "member", linkExternalId: p.userId };
    if (typeof p.projectId === "string")
      return { targetType: "project", linkExternalId: p.projectId };
  }
  if (
    r.provider === "jibble" &&
    typeof p.personId === "string" &&
    r.issues.some((x) => /user|person|identity/.test(x))
  )
    return { targetType: "member", linkExternalId: p.personId };
  if (r.provider === "clickup" && ["task", "list"].includes(r.entity_type))
    return {
      targetType: "project",
      linkExternalId: r.entity_type === "list" ? r.external_id : undefined,
    };
  return {};
}
export async function getJourneyRecord(
  ctx: JourneyContext,
  id: string,
  versionId?: string,
): Promise<JourneyRecordDetail> {
  const r = await loadRecord(ctx, id);
  const [versions, history, canManage, current, sourceName, files, reviewer] = await Promise.all([
    listJourneyEvidence(ctx, { id, kind: "versions" }),
    listJourneyEvidence(ctx, { id, kind: "history" }),
    workRpc<boolean>(ctx.client, "project_import_access", {
      p_ws: ctx.workspaceId,
      p_provider: r.provider,
      p_action: "manage",
      p_user: ctx.userId,
    }),
    ctx.client
      .from("project_import_record_versions" as never)
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("record_id", id)
      .eq("version_number", r.current_version_number)
      .maybeSingle(),
    resolveImportSourceName(ctx, { provider: r.provider, sourceId: r.source_id }),
    recordFiles(ctx, r),
    r.review_assignee_id
      ? ctx.client
          .from("profiles")
          .select("id,full_name")
          .eq("id", r.review_assignee_id)
          .maybeSingle()
      : null,
  ]);
  if (current.error || !current.data)
    throw new Error("Não foi possível confirmar a versão do registro original.");
  if (reviewer?.error)
    throw new Error("Não foi possível consultar o responsável pela conferência.");
  let original = r.payload;
  if (versionId) {
    const v = await ctx.client
      .from("project_import_record_versions" as never)
      .select("payload")
      .eq("workspace_id", ctx.workspaceId)
      .eq("record_id", id)
      .eq("id", versionId)
      .maybeSingle();
    if (v.error || !v.data) throw new Error("Versão indisponível.");
    original = (v.data as unknown as { payload: unknown }).payload;
  }
  return {
    ...mapRecord(r),
    sourceName,
    original: sanitizeImportPayload(original),
    versions: versions.versions,
    history: history.history,
    currentVersionId: (current.data as unknown as { id: string }).id,
    versionsCursor: versions.nextCursor,
    historyCursor: history.nextCursor,
    targetId: r.target_id,
    ...linkInfo(r),
    canManage,
    files,
    reviewAssignee: r.review_assignee_id
      ? {
          id: r.review_assignee_id,
          label: reviewer?.data?.full_name || `Identidade histórica (${r.review_assignee_id})`,
        }
      : null,
  };
}
async function recordFiles(
  ctx: JourneyContext,
  r: Row,
): Promise<NonNullable<JourneyRecordDetail["files"]>> {
  if (r.provider === "clickup" && r.entity_type === "attachment") {
    const f = await import("@/lib/integrations/clickup/clickup-files.server");
    return f.listClickUpSourceFiles(ctx, { sourceId: r.source_id, externalId: r.external_id });
  }
  if (r.provider === "jibble" && r.entity_type === "screenshot") {
    const f = await import("@/lib/integrations/jibble/jibble-files.server");
    const rows = await f.listJibbleSourceFiles(ctx, {
      sourceId: r.source_id,
      externalId: r.external_id,
    });
    return rows.map((file) => ({
      ...file,
      status: file.status === "preserved" ? "preserved" : "pending",
    }));
  }
  return [];
}
export async function getJourneyFile(ctx: JourneyContext, id: string, fileId: string) {
  const r = await loadRecord(ctx, id),
    files = await recordFiles(ctx, r);
  if (!files.some((f) => f.id === fileId && f.status === "preserved"))
    throw new Error("Arquivo indisponível ou sem permissão.");
  if (r.provider === "clickup") {
    const f = await import("@/lib/integrations/clickup/clickup-files.server");
    return f.getClickUpSourceFileUrl(ctx, { id: fileId });
  }
  const f = await import("@/lib/integrations/jibble/jibble-files.server");
  return f.getJibbleSourceFileUrl(ctx, { id: fileId });
}
export async function listJourneyTargets(
  ctx: JourneyContext,
  id: string,
  q: string,
  purpose: "link" | "review" = "link",
) {
  const r = await loadRecord(ctx, id),
    { targetType } = linkInfo(r);
  if (purpose === "review")
    return {
      options: await workRpc<Array<{ id: string; label: string }>>(
        ctx.client,
        "project_import_member_targets",
        { p_workspace: ctx.workspaceId, p_provider: r.provider, p_query: q, p_review: true },
      ),
    };
  if (!targetType) return { options: [] };
  if (targetType === "project") {
    const { workCanRead } = await import("@/lib/access-control/work-read-gate.server");
    if (!(await workCanRead(ctx.client, "techprojects.projects"))) return { options: [] };
    const result = await ctx.client
      .from("projects")
      .select("id,name")
      .eq("workspace_id", ctx.workspaceId)
      .ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`)
      .order("name")
      .limit(50);
    if (result.error) throw new Error(result.error.message);
    return { options: (result.data ?? []).map((p) => ({ id: p.id, label: p.name })) };
  }
  const result = await workRpc<Array<{ id: string; label: string }>>(
    ctx.client,
    "project_import_member_targets",
    { p_workspace: ctx.workspaceId, p_provider: r.provider, p_query: q, p_review: false },
  );
  return { options: result };
}
export async function reviewJourneyRecord(
  ctx: JourneyContext,
  input: {
    id: string;
    action: "review" | "link";
    note: string;
    versionId: string;
    targetId?: string;
    assigneeId?: string;
  },
) {
  const r = await loadRecord(ctx, input.id, true),
    info = linkInfo(r);
  if (input.action === "link" && (!info.targetType || !input.targetId))
    throw new Error("Escolha um vínculo válido.");
  await workRpc(ctx.client, "project_import_record_review", {
    p_workspace: ctx.workspaceId,
    p_id: r.id,
    p_note: input.note,
    p_action: input.action,
    p_target: input.targetId ?? null,
    p_target_type: info.targetType ?? null,
    p_assignee: input.assigneeId ?? null,
    p_version: input.versionId,
  });
  return getJourneyRecord(ctx, r.id);
}
