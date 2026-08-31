// Sprint C - Fase 4.2 parte 1
// Hierarquia ClickUp para TechProjects: Espaço → Pasta → Lista → Tarefa (+ Subtarefa).
// Status customizados por lista.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const categoryEnum = z.enum(["todo", "doing", "done"]);
const priorityEnum = z.enum(["low", "normal", "high", "urgent"]);

// Statuses padrão criados junto de uma nova lista.
const DEFAULT_STATUSES: Array<{
  name: string;
  color: string;
  category: "todo" | "doing" | "done";
  is_default?: boolean;
}> = [
  { name: "A fazer", color: "#94a3b8", category: "todo", is_default: true },
  { name: "Em execução", color: "#0ea5e9", category: "doing" },
  { name: "Em revisão", color: "#f59e0b", category: "doing" },
  { name: "Concluída", color: "#10b981", category: "done" },
];

// ============ SPACES ============
export const listSpaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_spaces", data.id);
    return { ok: true };
  });

// ============ FOLDERS ============
export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_folders", data.id);
    return { ok: true };
  });

// ============ LISTS ============
export const listSpaceTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_lists")
      .insert({
        workspace_id: workspaceId,
        space_id: data.spaceId,
        folder_id: data.folderId ?? null,
        project_id: data.projectId ?? null,
        name: data.name,
        color: data.color ?? null,
        icon: data.icon ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Seed default statuses
    const statusesToInsert = DEFAULT_STATUSES.map((s, i) => ({
      workspace_id: workspaceId,
      list_id: row.id,
      name: s.name,
      color: s.color,
      category: s.category,
      sort_order: i,
      is_default: s.is_default ?? false,
    }));
    await supabase.from("project_task_statuses").insert(statusesToInsert);

    return row;
  });

export const updateList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_lists", data.id);
    return { ok: true };
  });

export const getList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [listRes, statusesRes, tasksRes] = await Promise.all([
      supabase
        .from("project_lists")
        .select("*, project_spaces(id, name, color), project_folders(id, name), projects(id, name)")
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("project_task_statuses")
        .select("*")
        .eq("list_id", data.id)
        .order("sort_order", { ascending: true }),
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
  .middleware([requireSupabaseAuth])
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
        color: data.color ?? "#94a3b8",
        category: data.category,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_task_statuses", data.id);
    return { ok: true };
  });

// ============ LIST TASKS ============
export const createListTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      const { data: def } = await supabase
        .from("project_task_statuses")
        .select("id")
        .eq("list_id", data.listId)
        .eq("is_default", true)
        .maybeSingle();
      statusId = def?.id ?? null;
    }

    const { data: row, error } = await supabase
      .from("project_tasks")
      .insert({
        workspace_id: workspaceId,
        project_id: list.project_id,
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
  .middleware([requireSupabaseAuth])
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
    const { data: st } = await supabase
      .from("project_task_statuses")
      .select("category")
      .eq("id", data.customStatusId)
      .maybeSingle();
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_tasks", data.id);
    return { ok: true };
  });
