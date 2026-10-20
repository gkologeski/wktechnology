// Central de conciliação do TechProjects (server-only). Leituras usam o cliente do
// usuário (RLS); ações gravam só por funções do banco que conferem admin ativo,
// workspace ativo e bloqueiam o modo "Ver como". Nada aqui altera a origem.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_TYPE_LABEL,
  PROVIDER_LABEL,
  toCsv,
  type IssueStatus,
  type IssueType,
  type ReconProvider,
} from "./reconciliation-labels";

type Db = SupabaseClient<Database>;
export type ReconCtx = { workspaceId: string; userId: string };

export async function requireReconAdmin(
  supabase: Db,
  userId: string,
  opts: { write: boolean },
): Promise<ReconCtx> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data, error } = await supabase.rpc("is_active_workspace_admin", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error || data !== true) {
    throw new Error("Apenas administradores ativos do workspace podem usar a conciliação.");
  }
  if (opts.write) await assertNotReadOnlyView(supabase);
  return { workspaceId, userId };
}

function fail(prefix: string, error: { message: string } | null): never {
  throw new Error(`${prefix}: ${error?.message ?? "erro desconhecido"}`);
}

/** Estado das conexões sem expor segredo: só se existe chave, situação e último teste. */
async function connectionStatus(workspaceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [ck, jb] = await Promise.all([
    supabaseAdmin
      .from("clockify_connections")
      .select("status, source_access, last_tested_at, source_verified_at, key_last4")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from("time_import_connections")
      .select("status, source_access, last_tested_at, source_verified_at, secret_last4")
      .eq("workspace_id", workspaceId)
      .eq("provider", "jibble")
      .maybeSingle(),
  ]);
  const view = (
    r: {
      status: string;
      source_access: string | null;
      last_tested_at: string | null;
      source_verified_at: string | null;
      hasKey: boolean;
    } | null,
  ) =>
    r
      ? {
          status: r.status,
          access: r.source_access,
          lastTestedAt: r.last_tested_at,
          verifiedAt: r.source_verified_at,
          hasKey: r.hasKey,
        }
      : null;
  return {
    clockify: view(ck.data ? { ...ck.data, hasKey: Boolean(ck.data.key_last4) } : null),
    jibble: view(jb.data ? { ...jb.data, hasKey: Boolean(jb.data.secret_last4) } : null),
  };
}

export async function loadOverview(supabase: Db, ctx: ReconCtx) {
  const [{ data, error }, connections] = await Promise.all([
    supabase.rpc("project_reconciliation_overview", { p_ws: ctx.workspaceId }),
    connectionStatus(ctx.workspaceId),
  ]);
  if (error) fail("Não foi possível carregar a conciliação", error);
  return { overview: (data ?? {}) as { [key: string]: Json }, connections };
}

export type BreakdownInput = {
  provider: ReconProvider;
  from: string;
  to: string;
  group: "month" | "person" | "project";
  userId?: string | null;
  projectId?: string | null;
  page: number;
  pageSize: number;
};

export async function loadBreakdown(supabase: Db, ctx: ReconCtx, input: BreakdownInput) {
  const { data, error } = await supabase.rpc("project_reconciliation_breakdown", {
    p_ws: ctx.workspaceId,
    p_provider: input.provider,
    p_from: input.from,
    p_to: input.to,
    p_group: input.group,
    p_user: input.userId ?? undefined,
    p_project: input.projectId ?? undefined,
    p_limit: input.pageSize,
    p_offset: (input.page - 1) * input.pageSize,
  });
  if (error) fail("Não foi possível carregar a conferência", error);
  const rows = (data ?? []).map((r) => ({
    key: r.group_key,
    label: r.label,
    erpRows: Number(r.erp_rows),
    erpSeconds: Number(r.erp_seconds ?? 0),
    linkedRows: Number(r.linked_rows),
    linkedErpSeconds: r.linked_erp_seconds === null ? null : Number(r.linked_erp_seconds),
    sourceSeconds: r.source_seconds === null ? null : Number(r.source_seconds),
    diffSeconds: r.diff_seconds === null ? null : Number(r.diff_seconds),
    rowsWithOpenIssues: Number(r.rows_with_open_issues),
  }));
  return { rows, total: Number(data?.[0]?.total_groups ?? 0) };
}

export type IssueFilters = {
  provider?: ReconProvider;
  type?: IssueType | null;
  status?: IssueStatus | "pending" | "all";
  from?: string | null;
  to?: string | null;
  userId?: string | null;
  projectId?: string | null;
};

const ISSUE_COLUMNS =
  "id, issue_type, provider, time_entry_id, staging_table, staging_id, source_external_id, user_id, project_id, entry_date, seconds_impact, detail, status, resolution_note, resolved_at, last_detected_at";

function issueQuery(supabase: Db, ctx: ReconCtx, f: IssueFilters, withCount: boolean) {
  let q = supabase
    .from("project_reconciliation_issues")
    .select(ISSUE_COLUMNS, withCount ? { count: "exact" } : undefined)
    .eq("workspace_id", ctx.workspaceId)
    .eq("present", true);
  if (f.provider && f.provider !== "all") q = q.eq("provider", f.provider);
  if (f.type) q = q.eq("issue_type", f.type);
  const st = f.status ?? "pending";
  if (st === "pending") q = q.in("status", ["open", "deferred"]);
  else if (st !== "all") q = q.eq("status", st);
  if (f.from) q = q.gte("entry_date", f.from);
  if (f.to) q = q.lte("entry_date", f.to);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.projectId) q = q.eq("project_id", f.projectId);
  return q.order("entry_date", { ascending: false, nullsFirst: false }).order("id");
}

async function labelsFor(supabase: Db, userIds: string[], projectIds: string[]) {
  const [u, p] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  return {
    users: new Map((u.data ?? []).map((r) => [r.id, r.full_name])),
    projects: new Map((p.data ?? []).map((r) => [r.id, r.name])),
  };
}

export async function listIssues(
  supabase: Db,
  ctx: ReconCtx,
  f: IssueFilters & { page: number; pageSize: number },
) {
  const start = (f.page - 1) * f.pageSize;
  const { data, error, count } = await issueQuery(supabase, ctx, f, true).range(
    start,
    start + f.pageSize - 1,
  );
  if (error) fail("Não foi possível carregar a fila", error);
  const rows = data ?? [];
  const labels = await labelsFor(
    supabase,
    [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))],
    [...new Set(rows.map((r) => r.project_id).filter((v): v is string => Boolean(v)))],
  );
  return {
    total: count ?? 0,
    rows: rows.map((r) => ({
      ...r,
      seconds_impact: Number(r.seconds_impact),
      user_name: r.user_id ? (labels.users.get(r.user_id) ?? null) : null,
      project_name: r.project_id ? (labels.projects.get(r.project_id) ?? null) : null,
    })),
  };
}

export const EXPORT_LIMIT = 20_000;

/** Exportação síncrona limitada; acima do limite pede filtro (sem job em segundo plano). */
export async function exportIssuesCsv(supabase: Db, ctx: ReconCtx, f: IssueFilters) {
  const head = await issueQuery(supabase, ctx, f, true).range(0, 0);
  if (head.error) fail("Não foi possível exportar", head.error);
  const total = head.count ?? 0;
  if (total > EXPORT_LIMIT) {
    throw new Error(
      `A seleção tem ${total.toLocaleString("pt-BR")} alertas. Filtre para até ${EXPORT_LIMIT.toLocaleString("pt-BR")} antes de exportar.`,
    );
  }
  const out: Array<Array<string | number | null>> = [];
  for (let start = 0; start < total; start += 1000) {
    const { data, error } = await issueQuery(supabase, ctx, f, false).range(start, start + 999);
    if (error) fail("Não foi possível exportar", error);
    for (const r of data ?? []) {
      out.push([
        r.id,
        ISSUE_TYPE_LABEL[r.issue_type as IssueType] ?? r.issue_type,
        PROVIDER_LABEL[r.provider as ReconProvider] ?? r.provider,
        r.entry_date,
        Number(r.seconds_impact),
        ISSUE_STATUS_LABEL[r.status as IssueStatus] ?? r.status,
        r.time_entry_id,
        r.source_external_id,
        r.resolution_note,
      ]);
    }
  }
  return {
    rows: out.length,
    csv: toCsv(
      [
        "id",
        "alerta",
        "fonte",
        "data",
        "segundos_impacto",
        "situacao",
        "apontamento",
        "id_origem",
        "justificativa",
      ],
      out,
    ),
  };
}

export async function refreshIssues(supabase: Db, ctx: ReconCtx) {
  const { data, error } = await supabase.rpc("project_reconciliation_refresh", {
    p_ws: ctx.workspaceId,
  });
  if (error) fail("Não foi possível atualizar a fila", error);
  return data as { [key: string]: Json };
}

export async function decideIssues(
  supabase: Db,
  ctx: ReconCtx,
  input: { ids: string[]; action: string; note: string | null },
) {
  const { data, error } = await supabase.rpc("project_reconciliation_decide", {
    p_ws: ctx.workspaceId,
    p_ids: input.ids,
    p_action: input.action,
    p_note: input.note ?? "",
  });
  if (error) fail("Não foi possível registrar a decisão", error);
  return data as { updated: number };
}

export async function applyExactLinks(supabase: Db, ctx: ReconCtx) {
  const { data, error } = await supabase.rpc("project_links_apply_exact", {
    p_ws: ctx.workspaceId,
  });
  if (error) fail("Não foi possível aplicar os vínculos", error);
  return data as Record<string, number | string>;
}

export async function loadLinks(supabase: Db, ctx: ReconCtx) {
  const [people, sugg, projects, batches] = await Promise.all([
    supabase.rpc("project_link_people_overview", { p_ws: ctx.workspaceId }),
    supabase
      .from("project_link_suggestions")
      .select("id, kind, provider, subject_id, candidate_id, criterion, status, note, decided_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("projects")
      .select("id, name, company_id, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .order("name")
      .limit(2000),
    supabase
      .from("project_link_batches")
      .select("id, kind, counts, created_at, actor")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const err = people.error ?? sugg.error ?? projects.error ?? batches.error;
  if (err) fail("Não foi possível carregar os vínculos", err);
  const personIds = new Set<string>();
  const companyIds = new Set<string>();
  for (const s of sugg.data ?? [])
    (s.kind === "person" ? personIds : companyIds).add(s.candidate_id);
  for (const p of people.data ?? []) for (const id of p.person_ids ?? []) personIds.add(id);
  for (const p of projects.data ?? []) if (p.company_id) companyIds.add(p.company_id);
  const [pe, co] = await Promise.all([
    personIds.size
      ? supabase
          .from("people")
          .select("id, full_name, email")
          .in("id", [...personIds])
      : Promise.resolve({
          data: [] as Array<{ id: string; full_name: string; email: string | null }>,
        }),
    companyIds.size
      ? supabase
          .from("companies")
          .select("id, name")
          .in("id", [...companyIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const personName = new Map((pe.data ?? []).map((r) => [r.id, r.full_name]));
  const companyName = new Map((co.data ?? []).map((r) => [r.id, r.name]));
  const userName = new Map((people.data ?? []).map((r) => [r.user_id, r.user_name]));
  const projectName = new Map((projects.data ?? []).map((r) => [r.id, r.name]));
  const sourceOf = (meta: unknown) => {
    const m = (meta ?? {}) as Record<string, unknown>;
    return m.clockify ? "clockify" : m.jibble ? "jibble" : "erp";
  };
  return {
    people: (people.data ?? []).map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      memberStatus: r.member_status,
      entries: Number(r.entries),
      entriesWithPerson: Number(r.entries_with_person),
      persons: (r.person_ids ?? []).map((id) => ({ id, name: personName.get(id) ?? null })),
      suggestions: Number(r.suggestions),
      linkedByTrace: Number(r.linked_by_trace),
    })),
    projects: (projects.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      source: sourceOf(p.metadata),
      companyId: p.company_id,
      companyName: p.company_id ? (companyName.get(p.company_id) ?? null) : null,
    })),
    suggestions: (sugg.data ?? []).map((s) => ({
      ...s,
      subjectName:
        s.kind === "person"
          ? (userName.get(s.subject_id) ?? null)
          : (projectName.get(s.subject_id) ?? null),
      candidateName:
        s.kind === "person"
          ? (personName.get(s.candidate_id) ?? null)
          : (companyName.get(s.candidate_id) ?? null),
    })),
    batches: batches.data ?? [],
  };
}

export async function decideSuggestions(
  supabase: Db,
  ctx: ReconCtx,
  input: { ids: string[]; action: "confirm" | "reject"; note: string | null },
) {
  const { data, error } = await supabase.rpc("project_link_suggestions_decide", {
    p_ws: ctx.workspaceId,
    p_ids: input.ids,
    p_action: input.action,
    p_note: input.note ?? "",
  });
  if (error) fail("Não foi possível registrar a decisão", error);
  return data as Record<string, number | string>;
}

export async function revertLinks(
  supabase: Db,
  ctx: ReconCtx,
  input: { kind: "company" | "person"; subjectIds: string[] },
) {
  const { data, error } = await supabase.rpc("project_links_revert", {
    p_ws: ctx.workspaceId,
    p_kind: input.kind,
    p_subject_ids: input.subjectIds,
  });
  if (error) fail("Não foi possível desvincular", error);
  return data as Record<string, number | string>;
}
