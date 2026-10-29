// Importador ClickUp -> TechProjects (servidor). Lê o ClickUp só com GET em api.clickup.com,
// grava staging e aplica/desfaz apenas pelas RPCs clickup_import_* (que reconferem a permissão).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isClosed,
  planGroup,
  taskPayload,
  type CuHierarchyList,
  type CuTask,
  type ErpRef,
} from "./clickup-plan";

export type ClickUpAction = "view" | "manage";

/** Exige `techprojects.clickup_import.<ação>.workspace` (membro ativo, deny prevalece) no banco. */
export async function assertClickUpImport(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
  action: ClickUpAction,
): Promise<void> {
  const { data, error } = await client.rpc(
    "clickup_import_access" as never,
    {
      p_ws: workspaceId,
      p_user: userId,
      p_action: action,
    } as never,
  );
  if (error || data !== true) throw new Error("Sem permissão para o importador do ClickUp.");
}

const CLICKUP_HOST = "https://api.clickup.com/api/v2";
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export class ClickUpRateLimited extends Error {
  constructor(public waitSeconds: number) {
    super("Limite de leitura do ClickUp atingido.");
  }
}

async function cuGet<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const token = process.env["CLICKUP_API_TOKEN"];
  if (!token) throw new Error("ClickUp não conectado: falta a chave no servidor.");
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${CLICKUP_HOST}${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    redirect: "error",
    headers: { Authorization: token, accept: "application/json" },
  });
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const wait = Number.isFinite(reset) && reset > 0 ? Math.max(5, reset - Date.now() / 1000) : 30;
    throw new ClickUpRateLimited(Math.min(90, Math.ceil(wait)));
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp respondeu ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function safeId(id: unknown): string {
  const s = String(id ?? "");
  if (!ID_RE.test(s)) throw new Error("Identificador do ClickUp inválido.");
  return s;
}

type Named = { id: string | number; name: string };

/** Hierarquia completa (workspaces, espaços, pastas e listas, sem arquivados). */
export async function readHierarchy(): Promise<CuHierarchyList[]> {
  const out: CuHierarchyList[] = [];
  const { teams } = await cuGet<{ teams: Named[] }>("/team");
  for (const t of teams) {
    const teamId = safeId(t.id);
    const { spaces } = await cuGet<{ spaces: Named[] }>(`/team/${teamId}/space`, {
      archived: "false",
    });
    for (const s of spaces) {
      const spaceId = safeId(s.id);
      const { folders } = await cuGet<{ folders: (Named & { lists?: Named[] })[] }>(
        `/space/${spaceId}/folder`,
        { archived: "false" },
      );
      for (const f of folders)
        for (const l of f.lists ?? [])
          out.push({
            teamId,
            teamName: t.name,
            spaceId,
            spaceName: s.name,
            folderId: safeId(f.id),
            folderName: f.name,
            listId: safeId(l.id),
            listName: l.name,
          });
      const { lists } = await cuGet<{ lists: Named[] }>(`/space/${spaceId}/list`, {
        archived: "false",
      });
      for (const l of lists)
        out.push({
          teamId,
          teamName: t.name,
          spaceId,
          spaceName: s.name,
          folderId: null,
          folderName: null,
          listId: safeId(l.id),
          listName: l.name,
        });
    }
  }
  return out;
}

export type CollectCursor = {
  lists: string[];
  index: number;
  page: number;
  counts: Record<string, { tasks: number; closed: number }>;
  people: Record<string, { username: string | null; email: string | null; tasks: number }>;
};

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

async function erpRefs(ctx: Ctx): Promise<{ projects: ErpRef[]; spaces: ErpRef[] }> {
  const [p, s] = await Promise.all([
    ctx.client.from("projects").select("id, name").eq("workspace_id", ctx.workspaceId).limit(5000),
    ctx.client
      .from("project_spaces")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .is("archived_at", null),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (s.error) throw new Error(s.error.message);
  return { projects: (p.data ?? []) as ErpRef[], spaces: (s.data ?? []) as ErpRef[] };
}

/** Passo 1: abre a execução, lê a hierarquia e grava a organização proposta. */
export async function startCollect(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const runId = await rpc<string>(ctx.client, "clickup_import_start", { p_ws: ctx.workspaceId });
  const lists = await readHierarchy();
  const erp = await erpRefs(ctx);
  const groups = lists.map((l) => planGroup(l, erp));
  for (let i = 0; i < groups.length; i += 400)
    await rpc(ctx.client, "clickup_import_stage", {
      p_run: runId,
      p_groups: groups.slice(i, i + 400),
      p_tasks: [],
      p_people: [],
    });
  const cursor: CollectCursor = {
    lists: groups.filter((g) => g.action === "import").map((g) => g.list_ext_id),
    index: 0,
    page: 0,
    counts: {},
    people: {},
  };
  return { runId, cursor, lists: groups.length };
}

const PAGES_PER_STEP = 3;

/** Passo 2..N: lê até 3 páginas de tarefas (100 por página) e grava no staging. */
export async function collectStep(ctx: Ctx, runId: string, cursor: CollectCursor) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const c: CollectCursor = structuredClone(cursor);
  let pages = 0;
  try {
    while (c.index < c.lists.length && pages < PAGES_PER_STEP) {
      const listId = safeId(c.lists[c.index]);
      const r = await cuGet<{ tasks: CuTask[]; last_page?: boolean }>(`/list/${listId}/task`, {
        archived: "false",
        include_closed: "true",
        subtasks: "true",
        page: String(c.page),
      });
      pages++;
      const tasks = (r.tasks ?? []).filter((t) => ID_RE.test(String(t.id)));
      const cnt = (c.counts[listId] ??= { tasks: 0, closed: 0 });
      for (const t of tasks) {
        cnt.tasks++;
        if (isClosed(t)) cnt.closed++;
        for (const a of t.assignees ?? []) {
          const p = (c.people[String(a.id)] ??= {
            username: a.username ?? null,
            email: a.email ?? null,
            tasks: 0,
          });
          p.tasks++;
        }
      }
      if (tasks.length)
        await rpc(ctx.client, "clickup_import_stage", {
          p_run: runId,
          p_groups: [],
          p_tasks: tasks.map((t) => ({
            id: String(t.id),
            list_ext_id: listId,
            parent: t.parent ?? null,
            payload: taskPayload(t),
          })),
          p_people: [],
        });
      if (r.last_page !== false || tasks.length === 0) {
        c.index++;
        c.page = 0;
      } else c.page++;
    }
  } catch (e) {
    if (e instanceof ClickUpRateLimited)
      return { cursor: c, done: false, waitSeconds: e.waitSeconds };
    throw e;
  }
  if (c.index < c.lists.length) return { cursor: c, done: false, waitSeconds: 0 };
  return { cursor: c, done: true, waitSeconds: 0 };
}

/** Fecha a leitura: totais por lista, responsáveis e sugestões de vínculo. */
export async function finishCollect(ctx: Ctx, runId: string, cursor: CollectCursor) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const { data: groups, error } = await ctx.client
    .from("clickup_import_groups" as never)
    .select("*")
    .eq("run_id", runId);
  if (error) throw new Error(error.message);
  const rows = (groups ?? []) as Record<string, unknown>[];
  const updated = rows.map((g) => {
    const k = String(g["list_ext_id"]);
    return {
      ...g,
      task_count: cursor.counts[k]?.tasks ?? 0,
      closed_count: cursor.counts[k]?.closed ?? 0,
    };
  });
  for (let i = 0; i < updated.length; i += 400)
    await rpc(ctx.client, "clickup_import_stage", {
      p_run: runId,
      p_groups: updated.slice(i, i + 400),
      p_tasks: [],
      p_people: [],
    });
  const people = Object.entries(cursor.people).map(([id, p]) => ({
    id,
    username: p.username,
    email: p.email,
    task_count: p.tasks,
  }));
  for (let i = 0; i < people.length; i += 400)
    await rpc(ctx.client, "clickup_import_stage", {
      p_run: runId,
      p_groups: [],
      p_tasks: [],
      p_people: people.slice(i, i + 400),
    });
  const totalTasks = Object.values(cursor.counts).reduce((s, x) => s + x.tasks, 0);
  return rpc(ctx.client, "clickup_import_finish_collect", {
    p_run: runId,
    p_counts: {
      lists: rows.length,
      tasks: totalTasks,
      people: Object.keys(cursor.people).length,
    },
  });
}

export type ClickUpRun = {
  id: string;
  status: string;
  counts: Record<string, number>;
  applied_at: string | null;
  created_at: string;
};
export type ClickUpGroupRow = {
  id: string;
  team_name: string;
  space_name: string;
  folder_name: string | null;
  list_name: string;
  task_count: number;
  closed_count: number;
  action: "import" | "skip";
  reason: string | null;
  target_space_id: string | null;
  new_space_name: string | null;
  target_project_id: string | null;
  new_project_name: string | null;
  new_project_status: string | null;
  erp_list_name: string;
  erp_project_id: string | null;
  erp_list_id: string | null;
};
export type ClickUpPersonRow = {
  clickup_user_id: number;
  username: string | null;
  email: string | null;
  task_count: number;
  user_id: string | null;
  status: "confirmed" | "suggested" | "unmatched" | "ignored";
  match_reason: string | null;
};
export type StepResult = Record<string, number | boolean | null>;

export async function getStatus(ctx: Ctx): Promise<{
  configured: boolean;
  canManage: boolean;
  run: ClickUpRun | null;
  groups: ClickUpGroupRow[];
  people: ClickUpPersonRow[];
  linkedTasks: number;
}> {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const canManage = await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage")
    .then(() => true)
    .catch(() => false);
  const { data: runs, error } = await ctx.client
    .from("clickup_import_runs" as never)
    .select("id, status, counts, applied_at, created_at")
    .eq("workspace_id", ctx.workspaceId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const run = ((runs ?? []) as unknown as ClickUpRun[])[0] ?? null;
  let groups: ClickUpGroupRow[] = [];
  if (run) {
    const g = await ctx.client
      .from("clickup_import_groups" as never)
      .select(
        "id, team_name, space_name, folder_name, list_name, task_count, closed_count, action, reason, target_space_id, new_space_name, target_project_id, new_project_name, new_project_status, erp_list_name, erp_project_id, erp_list_id",
      )
      .eq("run_id", run.id)
      .order("team_name")
      .order("space_name")
      .order("folder_name", { nullsFirst: true })
      .order("list_name");
    if (g.error) throw new Error(g.error.message);
    groups = (g.data ?? []) as unknown as ClickUpGroupRow[];
  }
  const people = await ctx.client
    .from("clickup_import_people" as never)
    .select("clickup_user_id, username, email, task_count, user_id, status, match_reason")
    .eq("workspace_id", ctx.workspaceId)
    .order("task_count", { ascending: false });
  if (people.error) throw new Error(people.error.message);
  let linkedTasks = Number(run?.counts?.["tasks_created"] ?? 0);
  if (run && !linkedTasks && ["applying", "rolling_back"].includes(run.status)) {
    const l = await ctx.client
      .from("clickup_import_links" as never)
      .select("external_id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("created_run_id", run.id)
      .eq("entity_type", "task");
    linkedTasks = l.count ?? 0;
  }
  return {
    configured: Boolean(process.env["CLICKUP_API_TOKEN"]),
    canManage,
    run,
    groups,
    people: (people.data ?? []) as unknown as ClickUpPersonRow[],
    linkedTasks,
  };
}

export async function listTargets(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const erp = await erpRefs(ctx);
  const { data: members, error } = await ctx.client
    .from("workspace_members")
    .select("user_id, status")
    .eq("workspace_id", ctx.workspaceId);
  if (error) throw new Error(error.message);
  const ids = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await ctx.client.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return {
    projects: erp.projects.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    spaces: erp.spaces.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    members: (members ?? [])
      .map((m) => ({
        id: m.user_id as string,
        name: name.get(m.user_id as string) ?? "Sem nome",
        active: m.status === "active",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function setGroup(
  ctx: Ctx,
  d: {
    groupId: string;
    action: "import" | "skip";
    spaceId: string | null;
    newSpace: string | null;
    projectId: string | null;
    newProject: string | null;
    listName: string | null;
  },
) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  await rpc(ctx.client, "clickup_import_set_group", {
    p_group: d.groupId,
    p_action: d.action,
    p_space: d.spaceId,
    p_new_space: d.newSpace,
    p_project: d.projectId,
    p_new_project: d.newProject,
    p_list_name: d.listName,
  });
  return { ok: true };
}

export async function setPerson(
  ctx: Ctx,
  d: {
    clickupUserId: number;
    userId: string | null;
    status: "confirmed" | "ignored" | "unmatched";
  },
) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  await rpc(ctx.client, "clickup_import_set_person", {
    p_ws: ctx.workspaceId,
    p_clickup_user: d.clickupUserId,
    p_user: d.userId,
    p_status: d.status,
  });
  return { ok: true };
}

/**
 * Identidade histórica (mesmo modelo de HubSpot/Clockify): conta com login bloqueado +
 * membro inativo, só por ação explícita de quem pode gerenciar a importação E os membros.
 * Não envia convite, não ativa acesso e não concede cargo.
 */
export async function createHistoricalPerson(ctx: Ctx, clickupUserId: number) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const { assertPermission } = await import("@/lib/access-control/enforce.server");
  await assertPermission(
    ctx.client,
    ctx.userId,
    ctx.workspaceId,
    "system.members.manage.workspace",
  );
  const { data: row, error } = await ctx.client
    .from("clickup_import_people" as never)
    .select("clickup_user_id, username, email, user_id, status")
    .eq("workspace_id", ctx.workspaceId)
    .eq("clickup_user_id", clickupUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const person = row as unknown as ClickUpPersonRow | null;
  if (!person) throw new Error("Responsável do ClickUp não encontrado.");
  if (person.user_id && person.status === "confirmed") return { ok: true, userId: person.user_id };
  const { normalizeEmailAddress } = await import("@/lib/email-address");
  const email = normalizeEmailAddress(person.email);
  if (!email) throw new Error("A pessoa não tem e-mail no ClickUp; escolha alguém manualmente.");
  const fullName = person.username?.trim() || email;

  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    ban_duration: "876000h",
    user_metadata: { full_name: fullName, source: "clickup" },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      "Não foi possível cadastrar (o e-mail já pode estar em uso na plataforma). Escolha a pessoa existente.",
    );
  }
  const newId = created.data.user.id;
  await db.from("profiles").upsert({ id: newId, full_name: fullName }, { onConflict: "id" });
  const { error: mErr } = await db
    .from("workspace_members")
    .insert({ workspace_id: ctx.workspaceId, user_id: newId, role: "member", status: "inactive" });
  if (mErr) throw new Error(mErr.message);
  // O vínculo volta pelo cliente do usuário (RPC reconfere a permissão).
  await rpc(ctx.client, "clickup_import_set_person", {
    p_ws: ctx.workspaceId,
    p_clickup_user: clickupUserId,
    p_user: newId,
    p_status: "confirmed",
  });
  return { ok: true, userId: newId };
}

export async function runStep(ctx: Ctx, kind: "apply" | "assignees" | "rollback", runId: string) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const fn =
    kind === "apply"
      ? "clickup_import_apply_step"
      : kind === "assignees"
        ? "clickup_import_sync_assignees"
        : "clickup_import_rollback_step";
  return rpc<StepResult>(ctx.client, fn, { p_run: runId, p_limit: 300 });
}
