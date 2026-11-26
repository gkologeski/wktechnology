// Importador ClickUp -> TechProjects (servidor). Lê o ClickUp só com GET em api.clickup.com,
// grava staging e aplica/desfaz apenas pelas RPCs clickup_import_* (que reconferem a permissão).
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ErpRef } from "./clickup-plan";

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

import {
  clickUpGetForWorkspace as cuGet,
  clickUpId as safeId,
  ClickUpRateLimited,
} from "./clickup-api.server";
import {
  initialCollectCursor,
  type CollectCursor,
  type ClickUpTeam,
  type CoverageGap,
} from "./clickup-collection";
export { ClickUpRateLimited } from "./clickup-api.server";
export type { CollectCursor } from "./clickup-collection";

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

async function allRows<T>(read: (from: number, to: number) => PromiseLike<unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = (await read(from, from + 999)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (result.error) throw new Error(result.error.message);
    out.push(...(result.data ?? []));
    if (!result.data || result.data.length < 1000) return out;
  }
}

async function erpRefs(ctx: Ctx): Promise<{ projects: ErpRef[]; spaces: ErpRef[] }> {
  const [projects, spaces] = await Promise.all([
    allRows<ErpRef>((from, to) =>
      ctx.client
        .from("projects")
        .select("id,name")
        .eq("workspace_id", ctx.workspaceId)
        .order("id")
        .range(from, to),
    ),
    allRows<ErpRef>((from, to) =>
      ctx.client
        .from("project_spaces")
        .select("id,name")
        .eq("workspace_id", ctx.workspaceId)
        .is("archived_at", null)
        .order("id")
        .range(from, to),
    ),
  ]);
  return { projects, spaces };
}

/** Fontes visíveis à credencial; nenhuma é incluída sem vínculo explícito com o workspace. */
export async function getSources(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const { teams } = await cuGet<{ teams: ClickUpTeam[] }>(ctx, "/team");
  if (!Array.isArray(teams)) throw new Error("A origem não informou as organizações autorizadas.");
  const bindings = await ctx.client
    .from("clickup_import_source_bindings" as never)
    .select("team_id")
    .eq("workspace_id", ctx.workspaceId)
    .order("team_id");
  if (bindings.error) throw new Error(bindings.error.message);
  return {
    available: teams.map((t) => ({ id: safeId(t.id), name: t.name })),
    selectedIds: ((bindings.data ?? []) as { team_id: string }[]).map((t) => t.team_id),
  };
}

export async function saveSources(ctx: Ctx, sourceTeamIds: string[]) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const selected = new Set(sourceTeamIds.map(safeId));
  if (!selected.size) throw new Error("Escolha uma organização autorizada para este workspace.");
  const { teams } = await cuGet<{ teams: ClickUpTeam[] }>(ctx, "/team");
  const sources = teams
    .filter((t) => selected.has(String(t.id)))
    .map((t) => ({ id: String(t.id), name: t.name }));
  if (sources.length !== selected.size)
    throw new Error("Uma das organizações não está disponível nesta credencial.");
  await rpc(ctx.client, "clickup_import_sources_set", {
    p_ws: ctx.workspaceId,
    p_sources: sources,
  });
  return { selectedIds: sources.map((s) => s.id) };
}

type CollectionRun = {
  id: string;
  collect_cursor: CollectCursor | null;
  collect_revision: number;
  source_team_ids: string[];
  collect_error: string | null;
  collect_coverage: Record<string, unknown>;
  status: string;
};
export async function loadCollection(ctx: Ctx, runId: string): Promise<CollectionRun> {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const result = await ctx.client
    .from("clickup_import_runs" as never)
    .select(
      "id,collect_cursor,collect_revision,source_team_ids,collect_error,collect_coverage,status",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", runId)
    .maybeSingle();
  if (result.error || !result.data) throw new Error("Importação não encontrada neste workspace.");
  const run = result.data as unknown as CollectionRun;
  if (run.source_team_ids.length) {
    const bindings = await ctx.client
      .from("clickup_import_source_bindings" as never)
      .select("team_id")
      .eq("workspace_id", ctx.workspaceId);
    if (
      bindings.error ||
      run.source_team_ids.some(
        (id) => !((bindings.data ?? []) as { team_id: string }[]).some((b) => b.team_id === id),
      )
    )
      throw new Error("Uma origem desta execução deixou de estar autorizada para o workspace.");
  }
  return run;
}

async function saveCheckpoint(
  ctx: Ctx,
  runId: string,
  revision: number,
  cursor: CollectCursor,
  error: string | null = null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return rpc<number>(supabaseAdmin, "clickup_import_checkpoint", {
    p_actor: ctx.userId,
    p_run: runId,
    p_expected: revision,
    p_cursor: cursor,
    p_error: error,
  });
}

/** A coleta é retomada pelo checkpoint do servidor; fechar a aba não elimina o progresso. */
export async function startCollect(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const sources = await getSources(ctx);
  if (!sources.selectedIds.length)
    throw new Error(
      "Confirme as organizações do ClickUp que pertencem a este workspace antes de importar.",
    );
  const existing = await ctx.client
    .from("clickup_import_runs" as never)
    .select("id,collect_cursor")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "collecting")
    .order("created_at", { ascending: false })
    .limit(1);
  if (existing.error) throw new Error(existing.error.message);
  const active = existing.data?.[0] as unknown as
    | { id: string; collect_cursor: CollectCursor }
    | undefined;
  if (active?.collect_cursor?.version === 2) {
    const run = await loadCollection(ctx, active.id);
    return {
      runId: active.id,
      cursor: run.collect_cursor!,
      lists: run.collect_cursor!.lists.length,
      resumed: true,
    };
  }
  const { teams } = await cuGet<{ teams: ClickUpTeam[] }>(ctx, "/team");
  const allowed = teams.filter((t) => sources.selectedIds.includes(String(t.id)));
  if (allowed.length !== sources.selectedIds.length)
    throw new Error("Uma organização selecionada não está mais disponível; confira a conexão.");
  const cursor = initialCollectCursor(allowed);
  const runId = await rpc<string>(ctx.client, "clickup_import_start", { p_ws: ctx.workspaceId });
  await saveCheckpoint(ctx, runId, 0, cursor);
  // Organization/member originals are the first resumable collector unit. Returning
  // or losing this start response cannot advance past their preservation.
  return { runId, cursor, lists: 0, resumed: false };
}

/** Uma unidade GET por chamada, checkpoint depois da preservação. O cursor do navegador não é autoridade. */
export async function collectStep(ctx: Ctx, runId: string, _cursor?: CollectCursor) {
  const run = await loadCollection(ctx, runId);
  if (!run.collect_cursor)
    throw new Error("A execução antiga não possui checkpoint; inicie uma nova leitura integral.");
  const c = structuredClone(run.collect_cursor);
  if (c.phase === "done")
    return { cursor: c, done: true, waitSeconds: 0, coverageComplete: !c.gaps?.length };
  try {
    const { collectClickUpPage } = await import("./clickup-collection.server");
    await collectClickUpPage(ctx, runId, c);
    await saveCheckpoint(ctx, runId, run.collect_revision, c);
  } catch (error) {
    // A última unidade concluída continua persistida. Repetir uma página não duplica originais.
    if (error instanceof ClickUpRateLimited)
      return {
        cursor: run.collect_cursor,
        done: false,
        waitSeconds: error.waitSeconds,
        coverageComplete: false,
      };
    const message =
      error instanceof Error && !/https?:|pk_/i.test(error.message)
        ? error.message.slice(0, 400)
        : "A leitura foi interrompida. Retome sem perder os registros recebidos.";
    await saveCheckpoint(ctx, runId, run.collect_revision, run.collect_cursor, message).catch(
      () => undefined,
    );
    throw new Error(message);
  }
  const done = (c as CollectCursor).phase === "done";
  return { cursor: c, done, waitSeconds: 0, coverageComplete: done && !c.gaps?.length };
}

/** Fecha a leitura: totais por lista, responsáveis e sugestões de vínculo. */
export async function finishCollect(ctx: Ctx, runId: string, _cursor?: CollectCursor) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const current = await loadCollection(ctx, runId);
  if (current.collect_cursor?.phase !== "done")
    throw new Error("A coleta ainda não terminou. Retome a importação.");
  if (current.status !== "collecting") return { status: current.status };
  const cursor = current.collect_cursor;
  const rows = await allRows<Record<string, unknown>>((from, to) =>
    ctx.client
      .from("clickup_import_groups" as never)
      .select("*")
      .eq("run_id", runId)
      .eq("workspace_id", ctx.workspaceId)
      .order("id")
      .range(from, to),
  );
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
  const total = await ctx.client
    .from("clickup_import_tasks" as never)
    .select("external_id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("workspace_id", ctx.workspaceId);
  if (total.error) throw new Error(total.error.message);
  const totalTasks = total.count ?? 0;
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
  collect_cursor?: CollectCursor | null;
  collect_error?: string | null;
  collect_coverage?: {
    complete?: boolean;
    gaps?: CoverageGap[];
    capabilities?: Record<string, string>;
  };
  source_team_ids?: string[];
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
  sources: { id: string; name: string }[];
  needsSourceSelection: boolean;
}> {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const canManage = await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage")
    .then(() => true)
    .catch(() => false);
  const { data: runs, error } = await ctx.client
    .from("clickup_import_runs" as never)
    .select(
      "id,status,counts,applied_at,created_at,collect_cursor,collect_error,collect_coverage,source_team_ids",
    )
    .eq("workspace_id", ctx.workspaceId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const run = ((runs ?? []) as unknown as ClickUpRun[])[0] ?? null;
  let groups: ClickUpGroupRow[] = [];
  if (run) {
    groups = await allRows<ClickUpGroupRow>((from, to) =>
      ctx.client
        .from("clickup_import_groups" as never)
        .select(
          "id,team_name,space_name,folder_name,list_name,task_count,closed_count,action,reason,target_space_id,new_space_name,target_project_id,new_project_name,new_project_status,erp_list_name,erp_project_id,erp_list_id",
        )
        .eq("run_id", run.id)
        .eq("workspace_id", ctx.workspaceId)
        .order("team_name")
        .order("space_name")
        .order("folder_name", { nullsFirst: true })
        .order("list_name")
        .order("id")
        .range(from, to),
    );
  }
  const people = await allRows<ClickUpPersonRow>((from, to) =>
    ctx.client
      .from("clickup_import_people" as never)
      .select("clickup_user_id,username,email,task_count,user_id,status,match_reason")
      .eq("workspace_id", ctx.workspaceId)
      .order("task_count", { ascending: false })
      .order("clickup_user_id")
      .range(from, to),
  );

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
  const bindings = await ctx.client
    .from("clickup_import_source_bindings" as never)
    .select("team_id,team_name")
    .eq("workspace_id", ctx.workspaceId)
    .order("team_name");
  if (bindings.error) throw new Error(bindings.error.message);
  const sources = ((bindings.data ?? []) as { team_id: string; team_name: string }[]).map((b) => ({
    id: b.team_id,
    name: b.team_name,
  }));
  const { getClickUpConnectionState } = await import("./clickup-connection.server");
  const connection = await getClickUpConnectionState(ctx);
  return {
    sources,
    needsSourceSelection: !sources.length,
    configured: connection.configured,
    canManage,
    run,
    groups,
    people,
    linkedTasks,
  };
}

export async function listTargets(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const erp = await erpRefs(ctx);
  const members = await allRows<{ user_id: string; status: string }>((from, to) =>
    ctx.client
      .from("workspace_members")
      .select("user_id,status")
      .eq("workspace_id", ctx.workspaceId)
      .order("user_id")
      .range(from, to),
  );
  const ids = members.map((m) => m.user_id);
  const profiles: { id: string; full_name: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await ctx.client
      .from("profiles")
      .select("id,full_name")
      .in("id", ids.slice(offset, offset + 100));
    if (result.error) throw new Error(result.error.message);
    profiles.push(...(result.data ?? []));
  }
  const name = new Map(profiles.map((p) => [p.id, p.full_name]));
  return {
    projects: erp.projects.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    spaces: erp.spaces.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    members: members
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

export { getClickUpConnectionState } from "./clickup-connection.server";
