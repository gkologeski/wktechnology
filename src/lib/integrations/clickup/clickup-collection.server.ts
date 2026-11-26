import type { SupabaseClient } from "@supabase/supabase-js";
import {
  prepareImportRecords,
  preserveImportRecords,
} from "@/lib/projects/imports/import-preservation.server";
import {
  clickUpGetForWorkspace as clickUpGet,
  clickUpId,
  ClickUpReadError,
} from "./clickup-api.server";
import {
  addCoverageGap,
  taskPageComplete,
  clickUpTaskIssues,
  flattenClickUpPages,
  mergeClickUpTaskObservation,
  clickUpTimeRanges,
  contextualClickUpObservation,
  initialCollectCursor,
  type ClickUpTeam,
  type CollectCursor,
  type HierarchyJob,
} from "./clickup-collection";
import {
  isClosed,
  planGroup,
  taskPayload,
  type CuHierarchyList,
  type CuTask,
  type ErpRef,
} from "./clickup-plan";
import { preserveClickUpFile } from "./clickup-files.server";
import { assertClickUpImport } from "./clickup-import.server";

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };
type Obj = Record<string, unknown>;
type Named = Obj & { id: string; name: string; archived?: boolean };
async function rpc(ctx: Ctx, fn: string, args: Obj) {
  const result = await ctx.client.rpc(fn as never, args as never);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function preserve(
  ctx: Ctx,
  runId: string,
  teamId: string,
  entity: string,
  items: unknown[],
  context?: string,
  issues: string[] = [],
  status?: "received" | "pending" | "ready",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await preserveImportRecords(supabaseAdmin, {
    workspaceId: ctx.workspaceId,
    provider: "clickup",
    sourceId: teamId,
    runId,
    records: items.map((payload, index) => {
      const row = payload && typeof payload === "object" ? (payload as Obj) : {};
      return {
        entity,
        externalId: row["id"] == null ? null : String(row["id"]),
        payload,
        observationKey: `${context ?? entity}:${index}`,
        issues: [
          ...issues,
          ...(entity === "task" || entity === "task_detail" ? clickUpTaskIssues(row) : []),
          ...(row["id"] == null ? ["missing_external_id"] : []),
        ],
        status:
          issues.length ||
          row["id"] == null ||
          ((entity === "task" || entity === "task_detail") && clickUpTaskIssues(row).length)
            ? ("pending" as const)
            : (status ?? ("received" as const)),
      };
    }),
  });
}

async function targets(ctx: Ctx): Promise<{ projects: ErpRef[]; spaces: ErpRef[] }> {
  async function all(table: "projects" | "project_spaces") {
    const out: ErpRef[] = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await ctx.client
        .from(table)
        .select("id,name")
        .eq("workspace_id", ctx.workspaceId)
        .order("id")
        .range(offset, offset + 999);
      if (r.error) throw new Error(r.error.message);
      out.push(...(r.data as ErpRef[]));
      if (r.data.length < 1000) return out;
    }
  }
  const [projects, spaces] = await Promise.all([all("projects"), all("project_spaces")]);
  return { projects, spaces };
}

function jobPath(job: HierarchyJob) {
  if (job.kind === "spaces") return `/team/${clickUpId(job.teamId)}/space`;
  if (job.kind === "folders") return `/space/${clickUpId(job.spaceId)}/folder`;
  if (job.kind === "folder_lists") return `/folder/${clickUpId(job.folderId)}/list`;
  return `/space/${clickUpId(job.spaceId)}/list`;
}

/** Initialization is a checkpointed unit too: losing the start response cannot skip source people. */
async function organizationsPage(ctx: Ctx, runId: string, c: CollectCursor) {
  const index = c.organizationIndex ?? 0;
  const selected = c.teams?.[index];
  if (!selected) {
    c.phase = "hierarchy";
    return;
  }
  const result = await clickUpGet<{ teams: ClickUpTeam[] }>(ctx, "/team");
  if (!Array.isArray(result.teams)) throw new Error("A origem não informou as organizações.");
  const team = result.teams.find((item) => String(item.id) === selected.id);
  if (!team) throw new ClickUpReadError(403);
  await preserve(ctx, runId, selected.id, "organization", [team], `team:${selected.id}`);
  if (Array.isArray(team.members)) {
    await preserve(
      ctx,
      runId,
      selected.id,
      "person",
      team.members.map((member) => member?.user ?? member),
      `team:${selected.id}:member`,
    );
  } else {
    addCoverageGap(c, {
      entity: "person",
      sourceId: selected.id,
      reason: "A origem não forneceu o catálogo de pessoas desta organização.",
    });
  }
  // Only resumable DTO fields enter the cursor. Complete originals were saved above.
  c.teams![index] = initialCollectCursor([team]).teams![0]!;
  c.organizationIndex = index + 1;
  if (c.organizationIndex >= c.teams!.length) c.phase = "hierarchy";
}

async function hierarchyPage(ctx: Ctx, runId: string, c: CollectCursor) {
  const job = c.jobs?.[0];
  if (!job) {
    c.phase = "tasks";
    return;
  }
  const key = job.kind === "spaces" ? "spaces" : job.kind === "folders" ? "folders" : "lists";
  const result = await clickUpGet<Obj>(ctx, jobPath(job), {
    archived: String(job.archived),
    include_subfolders: "true",
  });
  if (!Array.isArray(result[key]))
    throw new Error("Resposta incompleta da hierarquia ClickUp. Retome a leitura.");
  const rows = result[key] as Named[];
  await preserve(
    ctx,
    runId,
    job.teamId,
    key === "lists" ? "list" : key === "folders" ? "folder" : "space",
    rows,
    `${job.kind}:${job.spaceId ?? job.teamId}:${job.folderId ?? ""}:${job.archived}`,
  );
  const children: HierarchyJob[] = [];
  const valid = rows.filter((r) => /^[A-Za-z0-9_-]{1,40}$/.test(String(r?.id ?? "")));
  if (job.kind === "spaces") {
    for (const row of valid)
      for (const archived of [false, true]) {
        children.push({
          kind: "folders",
          teamId: job.teamId,
          teamName: job.teamName,
          spaceId: String(row.id),
          spaceName: row.name,
          archived,
        });
        children.push({
          kind: "space_lists",
          teamId: job.teamId,
          teamName: job.teamName,
          spaceId: String(row.id),
          spaceName: row.name,
          archived,
        });
      }
  } else if (job.kind === "folders") {
    for (const row of valid)
      for (const archived of [false, true])
        children.push({
          ...job,
          kind: "folder_lists",
          folderId: String(row.id),
          folderName: row.name,
          archived,
        });
  } else if (valid.length) {
    const erp = await targets(ctx);
    const links = await ctx.client
      .from("clickup_import_list_targets" as never)
      .select("list_id,target_project_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("team_id", job.teamId);
    if (links.error) throw new Error(links.error.message);
    const confirmed = new Map(
      ((links.data ?? []) as { list_id: string; target_project_id: string }[]).map((link) => [
        link.list_id,
        link.target_project_id,
      ]),
    );
    const groups = valid.map((row) => {
      const list: CuHierarchyList = {
        teamId: job.teamId,
        teamName: job.teamName,
        spaceId: job.spaceId!,
        spaceName: job.spaceName ?? "(sem nome)",
        folderId: job.folderId ?? null,
        folderName: job.folderName ?? null,
        listId: String(row.id),
        listName: row.name || "(sem nome)",
        archived: row.archived ?? job.archived,
      };
      (c.listTeams ??= {})[list.listId] = list.teamId;
      if (!c.lists.includes(list.listId)) c.lists.push(list.listId);
      const planned = planGroup(list, erp);
      const projectId = confirmed.get(list.listId);
      if (projectId) {
        planned.target_project_id = projectId;
        planned.new_project_name = null;
        planned.new_project_status = null;
      }
      return planned;
    });
    for (let offset = 0; offset < groups.length; offset += 400)
      await rpc(ctx, "clickup_import_stage", {
        p_run: runId,
        p_groups: groups.slice(offset, offset + 400),
        p_tasks: [],
        p_people: [],
      });
  }
  c.jobs = [...(c.jobs ?? []).slice(1), ...children];
  if (!c.jobs.length) c.phase = "tasks";
}

async function taskPayloads(ctx: Ctx, teamId: string, ids: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!ids.length) return new Map<string, unknown>();
  const result = await supabaseAdmin
    .from("project_import_records" as never)
    .select("external_id,payload")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "clickup")
    .eq("source_id", teamId)
    .eq("entity_type", "task")
    .in("external_id", ids);
  if (result.error) throw new Error(result.error.message);
  return new Map(
    ((result.data ?? []) as { external_id: string; payload: unknown }[]).map((row) => [
      row.external_id,
      row.payload,
    ]),
  );
}

async function tasksPage(ctx: Ctx, runId: string, c: CollectCursor) {
  if (c.index >= c.lists.length) {
    c.phase = "related";
    return;
  }
  const listId = clickUpId(c.lists[c.index]);
  const teamId = c.listTeams?.[listId];
  if (!teamId)
    throw new Error("Lista sem organização autorizada. Refaça a conferência das origens.");
  const result = await clickUpGet<{ tasks: CuTask[]; last_page?: boolean }>(
    ctx,
    `/list/${listId}/task`,
    {
      archived: String(c.archived ?? false),
      include_closed: "true",
      subtasks: "true",
      include_timl: "true",
      include_markdown_description: "true",
      page: String(c.page),
      order_by: "id",
    },
  );
  if (!Array.isArray(result.tasks)) throw new Error("A origem não informou a página de tarefas.");
  const ids = result.tasks
    .filter((t) => t?.id != null && /^[A-Za-z0-9_-]{1,40}$/.test(String(t.id)))
    .map((t) => String(t.id));
  const previous = await taskPayloads(ctx, teamId, ids);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await preserveImportRecords(supabaseAdmin, {
    workspaceId: ctx.workspaceId,
    provider: "clickup",
    sourceId: teamId,
    runId,
    records: result.tasks.map((task, index) => {
      const raw = task && typeof task === "object" ? (task as unknown as Obj) : {};
      const home = task?.list?.id == null ? "" : String(task.list.id);
      const homeAuthorized = c.listTeams?.[home] === teamId && c.lists.includes(home);
      const issues = [
        ...clickUpTaskIssues(raw),
        ...(!homeAuthorized ? ["home_list_not_collected"] : []),
      ];
      return {
        entity: "task",
        externalId: task?.id == null ? null : String(task.id),
        payload: mergeClickUpTaskObservation(previous.get(String(task?.id)), raw, "list", listId),
        observationKey: `list:${listId}:${c.archived}:${c.page}:${index}`,
        status: issues.length ? "pending" : "received",
        issues,
      };
    }),
  });
  // Relações de múltiplas listas não somem quando a representação operacional usa uma lista principal.
  await preserve(
    ctx,
    runId,
    teamId,
    "task_list_membership",
    result.tasks
      .filter((t) => t?.id)
      .map((t) => ({
        id: `${t.id}:${listId}`,
        task_id: t.id,
        list_id: listId,
      })),
    `membership:${listId}:${c.page}`,
  );
  const tasks = result.tasks.filter(
    (t) =>
      t?.id != null &&
      /^[A-Za-z0-9_-]{1,40}$/.test(String(t.id)) &&
      t.list?.id != null &&
      c.lists.includes(String(t.list.id)) &&
      c.listTeams?.[String(t.list.id)] === teamId,
  );
  if (tasks.length)
    await rpc(ctx, "clickup_import_stage", {
      p_run: runId,
      p_groups: [],
      p_tasks: tasks.map((t) => ({
        id: String(t.id),
        list_ext_id: String(t.list!.id),
        parent: /^[A-Za-z0-9_-]{1,40}$/.test(t.parent ?? "") ? t.parent : null,
        payload: taskPayload(t),
      })),
      p_people: [],
    });
  const cnt = (c.counts[listId] ??= { tasks: 0, closed: 0 });
  for (const task of tasks) {
    cnt.tasks++;
    if (isClosed(task)) cnt.closed++;
    for (const person of Array.isArray(task.assignees) ? task.assignees : []) {
      if (!person || !Number.isSafeInteger(person.id) || person.id <= 0) continue;
      const previous = (c.people[String(person.id)] ??= {
        username: person.username ?? null,
        email: person.email ?? null,
        tasks: 0,
      });
      previous.tasks++;
      const personTeams = ((c.personTeams ??= {})[String(person.id)] ??= []);
      if (!personTeams.includes(teamId)) personTeams.push(teamId);
    }
  }
  if (taskPageComplete(result.tasks.length, result.last_page)) {
    if (!c.archived) c.archived = true;
    else {
      c.index++;
      c.archived = false;
    }
    c.page = 0;
  } else c.page++;
}

async function relatedPage(ctx: Ctx, runId: string, c: CollectCursor) {
  const thread = c.pendingCommentReplies?.[0];
  if (thread) {
    const reply = await clickUpGet<{ comments: Obj[] }>(
      ctx,
      `/comment/${clickUpId(thread.id)}/reply`,
    );
    if (!Array.isArray(reply.comments))
      throw new Error("Resposta de comentários encadeados incompleta.");
    await preserve(
      ctx,
      runId,
      thread.teamId,
      "comment_reply",
      reply.comments.map((x) =>
        contextualClickUpObservation(x, { taskId: thread.taskId, parentCommentId: thread.id }),
      ),
      `reply:${thread.id}`,
    );
    c.pendingCommentReplies = c.pendingCommentReplies!.slice(1);
    return;
  }
  if (!c.relatedTask) {
    let query = ctx.client
      .from("project_import_records" as never)
      .select("external_id,source_id")
      .eq("last_run_id", runId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "clickup")
      .eq("entity_type", "task")
      .in(
        "source_id",
        c.teams!.map((t) => t.id),
      )
      .order("external_id")
      .limit(1);
    if (c.lastTaskId) query = query.gt("external_id", c.lastTaskId);
    const next = await query;
    if (next.error) throw new Error(next.error.message);
    const task = (next.data?.[0] ?? null) as { external_id: string; source_id: string } | null;
    if (!task) {
      c.phase = "time";
      return;
    }
    const teamId = task.source_id;
    if (!teamId) throw new Error("Tarefa sem organização de origem autorizada.");
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(task.external_id)) {
      c.lastTaskId = task.external_id;
      addCoverageGap(c, {
        entity: "task_detail",
        sourceId: teamId,
        subjectId: task.external_id,
        reason:
          "Registro sem identificador utilizável para consultar detalhes; original preservado.",
      });
      return;
    }
    c.relatedTask = { id: task.external_id, teamId };
    c.relatedStage = "detail";
  }
  const { id, teamId } = c.relatedTask;
  if (c.relatedStage === "detail") {
    const detail = await clickUpGet<Obj>(ctx, `/task/${clickUpId(id)}`, {
      include_subtasks: "true",
      include_markdown_description: "true",
    });
    const previous = await taskPayloads(ctx, teamId, [id]);
    await preserve(
      ctx,
      runId,
      teamId,
      "task",
      [mergeClickUpTaskObservation(previous.get(id), detail, "detail")],
      `task:${id}`,
    );
    c.relatedStage = "comments";
  } else if (c.relatedStage === "comments") {
    const result = await clickUpGet<{ comments: Obj[] }>(
      ctx,
      `/task/${clickUpId(id)}/comment`,
      c.commentStart ? { start: c.commentStart.date, start_id: c.commentStart.id } : {},
    );
    if (!Array.isArray(result.comments)) throw new Error("Resposta de comentários incompleta.");
    await preserve(
      ctx,
      runId,
      teamId,
      "comment",
      result.comments.map((x) => contextualClickUpObservation(x, { taskId: id })),
      `task:${id}:comments:${c.commentStart?.id ?? "first"}`,
    );
    c.pendingCommentReplies = result.comments
      .filter((comment) => Number(comment["reply_count"]) > 0 && comment["id"] != null)
      .map((comment) => ({ id: String(comment["id"]), teamId, taskId: id }));
    if (result.comments.length < 25) {
      c.commentStart = undefined;
      c.relatedStage = "attachments";
    } else {
      const last = result.comments.at(-1)!;
      const marker = { id: String(last["id"] ?? ""), date: String(last["date"] ?? "") };
      if (!marker.id || !marker.date || marker.id === c.commentStart?.id)
        throw new Error(
          "A paginação de comentários não avançou. Retome para conferir a cobertura.",
        );
      c.commentStart = marker;
    }
  } else {
    const result = await clickUpGet<{ data: Obj[]; next_cursor?: string }>(
      ctx,
      `/workspaces/${clickUpId(teamId)}/attachments/${clickUpId(id)}/attachments`,
      {
        limit: "1",
        ...(c.attachmentCursor ? { cursor: c.attachmentCursor } : {}),
      },
      3,
    );
    if (!Array.isArray(result.data)) throw new Error("Resposta de arquivos incompleta.");
    for (const [attachmentIndex, attachment] of result.data.entries()) {
      const observation = `task:${id}:attachment:${c.attachmentCursor ?? "first"}:${attachmentIndex}`;
      // The singleton preserve call adds :0 to its observation key. Reuse the
      // exact ledger identity, including page cursor, without modifying raw data.
      const externalId = prepareImportRecords([
        {
          entity: "attachment",
          externalId: attachment["id"] == null ? null : String(attachment["id"]),
          payload: attachment,
          observationKey: `${observation}:0`,
        },
      ])[0]!.external_id;
      // Metadata survives a timeout/crash during binary transfer. File manifest is a separate private record.
      await preserve(ctx, runId, teamId, "attachment", [attachment], observation);
      const file = await preserveClickUpFile(ctx, runId, teamId, attachment, externalId);
      await preserve(
        ctx,
        runId,
        teamId,
        "attachment",
        [attachment],
        observation,
        file.issue ? ["attachment_content_pending"] : [],
        file.issue ? "pending" : "ready",
      );
      if (file.issue)
        addCoverageGap(c, {
          entity: "attachment",
          sourceId: teamId,
          subjectId: String(attachment["id"] ?? id),
          reason: file.issue,
        });
    }
    if (result.next_cursor) {
      if (result.next_cursor === c.attachmentCursor)
        throw new Error("A paginação de arquivos não avançou.");
      c.attachmentCursor = result.next_cursor;
    } else {
      c.lastTaskId = id;
      c.relatedTask = undefined;
      c.relatedStage = undefined;
      c.attachmentCursor = undefined;
    }
  }
}

async function timePage(ctx: Ctx, runId: string, c: CollectCursor) {
  const history = c.pendingTimeHistory?.[0];
  if (history) {
    const result = await clickUpGet<Obj>(
      ctx,
      `/team/${clickUpId(history.teamId)}/time_entries/${clickUpId(history.id)}/history`,
    );
    await preserve(
      ctx,
      runId,
      history.teamId,
      "time_entry_history",
      [{ ...result, id: `${history.id}:history`, time_entry_id: history.id }],
      `time-history:${history.id}`,
    );
    c.pendingTimeHistory = c.pendingTimeHistory!.slice(1);
    return;
  }
  const team = c.teams?.[c.timeTeam ?? 0];
  if (!team) {
    c.phase = "docs";
    return;
  }
  const members = (team.members ?? [])
    .map((m) => m.user?.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  const observed = Object.entries(c.personTeams ?? {})
    .filter(([, teams]) => teams.includes(team.id))
    .map(([id]) => Number(id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const people = [...new Set([...members, ...observed])].sort((a, b) => a - b);
  if (!people.length) {
    addCoverageGap(c, {
      entity: "time_entry",
      sourceId: team.id,
      reason:
        "A origem não informou os participantes; não é possível comprovar horas de todos os usuários.",
    });
    c.timeTeam = (c.timeTeam ?? 0) + 1;
    c.timeAssignee = 0;
    return;
  }
  if ((c.timeAssignee ?? 0) >= people.length) {
    c.timeTeam = (c.timeTeam ?? 0) + 1;
    c.timeAssignee = 0;
    c.timeRangeIndex = undefined;
    return;
  }
  const assignees = people.slice(c.timeAssignee ?? 0, (c.timeAssignee ?? 0) + 1);
  const rangeIndex = c.timeRangeIndex ?? c.timeAcceptedRanges?.[team.id] ?? 0;
  const range = clickUpTimeRanges(c.timeUntil ?? Date.now())[rangeIndex]!;
  const result = await clickUpGet<{ data: Obj[] }>(
    ctx,
    `/team/${clickUpId(team.id)}/time_entries`,
    {
      start_date: String(range.start),
      end_date: String(range.end),
      assignee: assignees.join(","),
      include_task_tags: "true",
      include_location_names: "true",
      include_approval_details: "true",
      include_approval_history: "true",
    },
  );
  if (!Array.isArray(result.data)) throw new Error("A origem não informou o histórico de horas.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await preserveImportRecords(supabaseAdmin, {
    workspaceId: ctx.workspaceId,
    provider: "clickup",
    sourceId: team.id,
    runId,
    records: result.data.map((item, index) => ({
      entity: "time_entry",
      externalId: item["id"] == null ? null : String(item["id"]),
      payload: item,
      observationKey: `time:${assignees.join(",")}:${index}`,
      sourcePersonId:
        item["user"] && typeof item["user"] === "object" && (item["user"] as Obj)["id"] != null
          ? String((item["user"] as Obj)["id"])
          : String(assignees[0]),
      status: "pending",
      issues:
        Number(item["duration"]) <= 0
          ? ["invalid_or_running_duration"]
          : ["clickup_time_requires_reconciliation"],
    })),
  });
  c.pendingTimeHistory = result.data
    .filter((item) => item["id"] != null)
    .map((item) => ({ id: String(item["id"]), teamId: team.id }));
  (c.timeAcceptedRanges ??= {})[team.id] = rangeIndex;
  c.timeRangeIndex = undefined;
  c.timeAssignee = (c.timeAssignee ?? 0) + assignees.length;
  if (c.timeAssignee >= people.length) {
    c.timeTeam = (c.timeTeam ?? 0) + 1;
    c.timeAssignee = 0;
  }
}

async function docsPage(ctx: Ctx, runId: string, c: CollectCursor) {
  const pending = c.pendingDocs?.[0];
  if (pending) {
    const pages = await clickUpGet<Obj[]>(
      ctx,
      `/workspaces/${clickUpId(pending.teamId)}/docs/${clickUpId(pending.id)}/pages`,
      { max_page_depth: "-1", content_format: "text/md" },
      3,
    );
    if (!Array.isArray(pages)) throw new Error("A origem não forneceu as páginas do documento.");
    await preserve(
      ctx,
      runId,
      pending.teamId,
      "document_page",
      flattenClickUpPages(pages).map((page) =>
        contextualClickUpObservation(page, { documentId: pending.id }),
      ),
      `doc:${pending.id}:pages`,
    );
    c.pendingDocs = c.pendingDocs!.slice(1);
    return;
  }
  const team = c.teams?.[c.docsTeam ?? 0];
  if (!team) {
    c.phase = "done";
    return;
  }
  const result = await clickUpGet<{ docs: Obj[]; next_cursor?: string }>(
    ctx,
    `/workspaces/${clickUpId(team.id)}/docs`,
    {
      limit: "100",
      archived: String(c.docsArchived ?? false),
      deleted: String(c.docsDeleted ?? false),
      ...(c.docsCursor ? { cursor: c.docsCursor } : {}),
    },
    3,
  );
  if (!Array.isArray(result.docs))
    throw new Error("A origem não informou o catálogo de documentos.");
  await preserve(
    ctx,
    runId,
    team.id,
    "document",
    result.docs,
    `docs:${c.docsArchived}:${c.docsDeleted}:${c.docsCursor ?? "first"}`,
  );
  c.pendingDocs = result.docs
    .filter((d) => d["id"] != null)
    .map((d) => ({ id: String(d["id"]), teamId: team.id }));
  if (result.next_cursor) {
    if (result.next_cursor === c.docsCursor)
      throw new Error("A paginação de documentos não avançou.");
    c.docsCursor = result.next_cursor;
  } else {
    c.docsCursor = undefined;
    if (!c.docsArchived) c.docsArchived = true;
    else if (!c.docsDeleted) {
      c.docsArchived = false;
      c.docsDeleted = true;
    } else {
      c.docsTeam = (c.docsTeam ?? 0) + 1;
      c.docsArchived = false;
      c.docsDeleted = false;
    }
  }
}

/** Uma unidade curta e retomável. Falhas de capacidade são lacunas, não conjuntos vazios. */
export async function collectClickUpPage(ctx: Ctx, runId: string, c: CollectCursor) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  try {
    switch (c.phase) {
      case "organizations":
        return await organizationsPage(ctx, runId, c);
      case "hierarchy":
        return await hierarchyPage(ctx, runId, c);
      case "tasks":
        return await tasksPage(ctx, runId, c);
      case "related":
        return await relatedPage(ctx, runId, c);
      case "time":
        return await timePage(ctx, runId, c);
      case "docs":
        return await docsPage(ctx, runId, c);
      case "done":
        return;
      default:
        throw new Error(
          "Checkpoint anterior à jornada unificada. Inicie uma nova leitura para comprovar toda a cobertura.",
        );
    }
  } catch (error) {
    if (!(error instanceof ClickUpReadError) || ![400, 401, 403, 404].includes(error.status))
      throw error;
    const phase = c.phase ?? "hierarchy";
    const sourceId =
      phase === "organizations"
        ? (c.teams?.[c.organizationIndex ?? 0]?.id ?? "")
        : phase === "hierarchy"
          ? (c.jobs?.[0]?.teamId ?? "")
          : phase === "tasks"
            ? (c.listTeams?.[c.lists[c.index]] ?? "")
            : (c.pendingCommentReplies?.[0]?.teamId ??
              c.relatedTask?.teamId ??
              c.pendingTimeHistory?.[0]?.teamId ??
              c.pendingDocs?.[0]?.teamId ??
              c.teams?.[phase === "time" ? (c.timeTeam ?? 0) : (c.docsTeam ?? 0)]?.id ??
              "");
    addCoverageGap(c, {
      entity:
        phase === "related"
          ? c.pendingCommentReplies?.length
            ? "comment_reply"
            : (c.relatedStage ?? "task")
          : phase,
      sourceId,
      subjectId:
        c.pendingCommentReplies?.[0]?.id ??
        c.relatedTask?.id ??
        c.pendingTimeHistory?.[0]?.id ??
        c.pendingDocs?.[0]?.id,
      reason: `Acesso ou capacidade indisponível na origem (HTTP ${error.status}); os dados não foram considerados vazios.`,
    });
    if (phase === "organizations") {
      c.organizationIndex = (c.organizationIndex ?? 0) + 1;
      if (c.organizationIndex >= (c.teams?.length ?? 0)) c.phase = "hierarchy";
    } else if (phase === "related" && c.pendingCommentReplies?.length)
      c.pendingCommentReplies = c.pendingCommentReplies.slice(1);
    else if (phase === "related") {
      if (c.relatedStage === "detail") c.relatedStage = "comments";
      else if (c.relatedStage === "comments") {
        c.relatedStage = "attachments";
        c.commentStart = undefined;
      } else {
        c.lastTaskId = c.relatedTask?.id;
        c.relatedTask = undefined;
        c.attachmentCursor = undefined;
      }
    } else if (phase === "time" && c.pendingTimeHistory?.length)
      c.pendingTimeHistory = c.pendingTimeHistory.slice(1);
    else if (phase === "time") {
      const current = c.timeRangeIndex ?? c.timeAcceptedRanges?.[sourceId] ?? 0;
      if (
        error.status === 400 &&
        current < clickUpTimeRanges(c.timeUntil ?? Date.now()).length - 1
      ) {
        c.timeRangeIndex = current + 1;
        addCoverageGap(c, {
          entity: "time_entry_date_range",
          sourceId,
          reason:
            "A origem recusou a faixa integral, incluindo datas anteriores a 1970 e futuras. Uma faixa menor será consultada, sem comprovar integralidade.",
        });
      } else {
        c.timeAssignee = (c.timeAssignee ?? 0) + 1;
        c.timeRangeIndex = undefined;
      }
    } else if (phase === "docs" && c.pendingDocs?.length) c.pendingDocs = c.pendingDocs.slice(1);
    else if (phase === "docs") {
      c.docsTeam = (c.docsTeam ?? 0) + 1;
      c.docsCursor = undefined;
      c.docsArchived = false;
      c.docsDeleted = false;
    } else if (phase === "tasks") {
      if (!c.archived) c.archived = true;
      else {
        c.index++;
        c.archived = false;
      }
      c.page = 0;
    } else c.jobs = c.jobs?.slice(1);
  }
}
