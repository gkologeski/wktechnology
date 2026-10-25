import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { Database } from "@/integrations/supabase/types";
// Sprint C - Fase 4.2 parte 1
// Hierarquia ClickUp para TechProjects: Espaço → Pasta → Lista → Tarefa (+ Subtarefa).
// Status customizados por lista.
import { DEFAULT_RECORD_COLOR } from "@/lib/ui/default-colors";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const categoryEnum = z.enum(["todo", "doing", "done"]);
const priorityEnum = z.enum(["low", "normal", "high", "urgent"]);

// ============ SPACES ============
export const listSpaces = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.spaces", "view")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("project_spaces")
      .select("*")
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const createSpace = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.spaces", "create")])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_spaces")
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateSpace = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.spaces", "update")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.color !== undefined) patch.color = data.color;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.archived !== undefined)
      patch.archived_at = data.archived ? new Date().toISOString() : null;
    const { data: row, error } = await supabase
      .from("project_spaces")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteSpace = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.spaces", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_spaces", data.id);
    return { ok: true };
  });

// ============ FOLDERS ============
export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.folders", "create")])
  .inputValidator((input) =>
    z
      .object({
        spaceId: z.string().uuid(),
        name: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_folders")
      .insert({
        workspace_id: workspaceId,
        space_id: data.spaceId,
        name: data.name,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.folders", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_folders", data.id);
    return { ok: true };
  });

// ============ LISTS ============
export const listSpaceTree = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.spaces", "view")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [spacesRes, foldersRes, listsRes] = await Promise.all([
      supabase
        .from("project_spaces")
        .select("*")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("project_folders")
        .select("*")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("project_lists")
        .select("*, projects(id, name)")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
    ]);
    if (spacesRes.error) throw spacesRes.error;
    if (foldersRes.error) throw foldersRes.error;
    if (listsRes.error) throw listsRes.error;
    return {
      spaces: spacesRes.data ?? [],
      folders: foldersRes.data ?? [],
      lists: listsRes.data ?? [],
    };
  });

export const createList = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.lists", "create")])
  .inputValidator((input) =>
    z
      .object({
        spaceId: z.string().uuid(),
        folderId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return workRpc<Database["public"]["Tables"]["project_lists"]["Row"]>(
      context.supabase,
      "project_list_create_checked",
      { p_data: data, p_template: null },
    );
  });

export const updateList = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.lists", "update")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        folderId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.color !== undefined) patch.color = data.color;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.folderId !== undefined) patch.folder_id = data.folderId;
    if (data.projectId !== undefined) patch.project_id = data.projectId;
    if (data.archived !== undefined)
      patch.archived_at = data.archived ? new Date().toISOString() : null;
    const { data: row, error } = await supabase
      .from("project_lists")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.lists", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_lists", data.id);
    return { ok: true };
  });

export const getList = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.lists", "view")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [listRes, statusesRes, tasksRes] = await Promise.all([
      supabase
        .from("project_lists")
        .select("*, project_spaces(id, name, color), project_folders(id, name), projects(id, name)")
        .eq("id", data.id)
        .maybeSingle(),
      workRpc<{
        statuses: Array<
          Pick<
            Database["public"]["Tables"]["project_task_statuses"]["Row"],
            "id" | "list_id" | "name" | "color" | "category" | "sort_order" | "is_default"
          >
        >;
      }>(supabase, "project_list_runtime_references", { p_list: data.id, p_task: null }).then(
        (r) => ({ data: r.statuses, error: null }),
      ),
      supabase
        .from("project_tasks")
        .select("*")
        .eq("list_id", data.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (listRes.error) throw listRes.error;
    if (statusesRes.error) throw statusesRes.error;
    if (tasksRes.error) throw tasksRes.error;
    return {
      list: listRes.data,
      statuses: statusesRes.data ?? [],
      tasks: tasksRes.data ?? [],
    };
  });

// ============ STATUSES ============
export const createStatus = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.statuses", "manage")])
  .inputValidator((input) =>
    z
      .object({
        listId: z.string().uuid(),
        name: z.string().min(1),
        color: z.string().nullable().optional(),
        category: categoryEnum.default("todo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { count } = await supabase
      .from("project_task_statuses")
      .select("id", { count: "exact", head: true })
      .eq("list_id", data.listId);
    const { data: row, error } = await supabase
      .from("project_task_statuses")
      .insert({
        workspace_id: workspaceId,
        list_id: data.listId,
        name: data.name,
        color: data.color ?? DEFAULT_RECORD_COLOR,
        category: data.category,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateStatus = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.statuses", "manage")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        color: z.string().nullable().optional(),
        category: categoryEnum.optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.color !== undefined) patch.color = data.color;
    if (data.category !== undefined) patch.category = data.category;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    const { data: row, error } = await supabase
      .from("project_task_statuses")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteStatus = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.statuses", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_task_statuses", data.id);
    return { ok: true };
  });

// ============ LIST TASKS ============
export const createListTask = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "create")])
  .inputValidator((input) =>
    z
      .object({
        listId: z.string().uuid(),
        title: z.string().min(1),
        customStatusId: z.string().uuid().nullable().optional(),
        parentTaskId: z.string().uuid().nullable().optional(),
        priority: priorityEnum.optional(),
        dueAt: z.string().nullable().optional(),
        estimatedHours: z.number().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    // Descobre o projeto vinculado à lista (ou cria dependência mínima: lista sem projeto usa placeholder?)
    const { data: list, error: listErr } = await supabase
      .from("project_lists")
      .select("project_id, workspace_id")
      .eq("id", data.listId)
      .maybeSingle();
    if (listErr) throw listErr;
    if (!list) throw new Error("Lista não encontrada");

    if (!list.project_id) {
      throw new Error(
        "Esta lista ainda não está vinculada a um projeto. Vincule um projeto à lista para criar tarefas.",
      );
    }

    // status default se não veio
    let statusId = data.customStatusId ?? null;
    if (!statusId) {
      const refs = await workRpc<{ statuses: Array<{ id: string; is_default: boolean }> }>(
        supabase,
        "project_list_runtime_references",
        { p_list: data.listId, p_task: null },
      );
      statusId = refs.statuses.find((s) => s.is_default)?.id ?? null;
    }

    const { data: row, error } = await supabase
      .from("project_tasks")
      .insert({
        workspace_id: workspaceId,
        project_id: list.project_id,
        assignee_id: userId,
        list_id: data.listId,
        title: data.title,
        custom_status_id: statusId,
        parent_task_id: data.parentTaskId ?? null,
        priority: data.priority ?? "normal",
        due_at: data.dueAt ?? null,
        estimated_hours: data.estimatedHours ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const moveTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "update")])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        customStatusId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Reflete category no status legado para relatórios existentes
    const refs = await workRpc<{ statuses: Array<{ id: string; category: string }> }>(
      supabase,
      "project_list_runtime_references",
      { p_task: data.taskId, p_list: null },
    );
    const st = refs.statuses.find((s) => s.id === data.customStatusId);
    if (!st) throw new Error("Status indisponível para esta tarefa.");
    const legacy = st?.category === "done" ? "done" : st?.category === "doing" ? "doing" : "todo";
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update({ custom_status_id: data.customStatusId, status: legacy })
      .eq("id", data.taskId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateListTask = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "update")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        priority: priorityEnum.optional(),
        dueAt: z.string().nullable().optional(),
        startAt: z.string().nullable().optional(),
        estimatedHours: z.number().nonnegative().nullable().optional(),
        customStatusId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueAt !== undefined) patch.due_at = data.dueAt;
    if (data.startAt !== undefined) patch.start_at = data.startAt;
    if (data.estimatedHours !== undefined) patch.estimated_hours = data.estimatedHours;
    if (data.customStatusId !== undefined) patch.custom_status_id = data.customStatusId;
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteListTask = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_tasks", data.id);
    return { ok: true };
  });
