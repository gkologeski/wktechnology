// Sprint D — Fase 4.2 parte 2:
// Dependências, checklists, tags e múltiplos assignees para project_tasks.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const depTypeEnum = z.enum([
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
  "start_to_finish",
]);

// ============= DEPENDENCIES =============

export const listDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_task_dependencies")
      .select(
        "id, task_id, depends_on_task_id, dep_type, created_at, project_tasks!project_task_dependencies_depends_on_task_id_fkey(id, title, status)",
      )
      .eq("task_id", data.taskId);
    if (error) throw error;
    return rows ?? [];
  });

export const addDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        dependsOnTaskId: z.string().uuid(),
        depType: depTypeEnum.default("finish_to_start"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.taskId === data.dependsOnTaskId) {
      throw new Error("Tarefa não pode depender de si mesma");
    }
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_task_dependencies")
      .insert({
        workspace_id: workspaceId,
        task_id: data.taskId,
        depends_on_task_id: data.dependsOnTaskId,
        dep_type: data.depType,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const removeDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_task_dependencies", data.id);
    return { ok: true };
  });

// ============= CHECKLIST =============

export const listChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_task_checklists")
      .select("*")
      .eq("task_id", data.taskId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const addChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        title: z.string().min(1).max(500),
        sortOrder: z.number().int().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_task_checklists")
      .insert({
        workspace_id: workspaceId,
        task_id: data.taskId,
        title: data.title,
        sort_order: data.sortOrder ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), isDone: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = {
      is_done: data.isDone,
      done_at: data.isDone ? new Date().toISOString() : null,
      done_by: data.isDone ? userId : null,
    };
    const { data: row, error } = await supabase
      .from("project_task_checklists")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        sortOrder: z.number().int().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { title?: string; sort_order?: number } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    const { data: row, error } = await supabase
      .from("project_task_checklists")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const removeChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_task_checklists", data.id);
    return { ok: true };
  });

// ============= TAGS & ASSIGNEES =============

export const updateTaskTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ taskId: z.string().uuid(), tags: z.array(z.string().min(1).max(50)) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const normalized = Array.from(new Set(data.tags.map((t) => t.trim()).filter(Boolean)));
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update({ tags: normalized })
      .eq("id", data.taskId)
      .select("id, tags")
      .single();
    if (error) throw error;
    return row;
  });

export const updateTaskAssignees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        assigneeIds: z.array(z.string().uuid()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ids = Array.from(new Set(data.assigneeIds));
    const patch: { assignee_ids: string[]; assignee_id?: string | null } = { assignee_ids: ids };
    if (ids.length > 0) patch.assignee_id = ids[0]!;
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update(patch)
      .eq("id", data.taskId)
      .select("id, assignee_ids, assignee_id")
      .single();
    if (error) throw error;
    return row;
  });

// Lista tags únicas usadas no workspace (para autocomplete).
export const listWorkspaceTaskTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.from("project_tasks").select("tags").limit(500);
    if (error) throw error;
    const set = new Set<string>();
    for (const r of rows ?? []) {
      for (const t of (r as { tags?: string[] }).tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  });
