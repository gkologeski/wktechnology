import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { Database } from "@/integrations/supabase/types";
// Refinos Sprint E: Custom Fields por lista + List Templates.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const fieldTypeEnum = z.enum(["text", "number", "date", "select", "checkbox", "url"]);

// ============ CUSTOM FIELDS ============
export const listCustomFields = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.custom_fields", "view")])
  .inputValidator((input) => z.object({ listId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_list_custom_fields")
      .select("*")
      .eq("list_id", data.listId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const createCustomField = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.custom_fields", "manage")])
  .inputValidator((input) =>
    z
      .object({
        listId: z.string().uuid(),
        key: z
          .string()
          .min(1)
          .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
        label: z.string().min(1),
        type: fieldTypeEnum,
        options: z.array(z.string()).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { count } = await supabase
      .from("project_list_custom_fields")
      .select("id", { count: "exact", head: true })
      .eq("list_id", data.listId);
    const { data: row, error } = await supabase
      .from("project_list_custom_fields")
      .insert({
        workspace_id: workspaceId,
        list_id: data.listId,
        key: data.key,
        label: data.label,
        type: data.type,
        options: data.options ?? null,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteCustomField = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.custom_fields", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_list_custom_fields", data.id);
    return { ok: true };
  });

export const updateTaskCustomFieldValues = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "update")])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        values: z.record(z.string(), z.any()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update({ custom_field_values: data.values })
      .eq("id", data.taskId)
      .select("id, custom_field_values")
      .single();
    if (error) throw error;
    return row;
  });

// ============ LIST TEMPLATES ============
export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.list_templates", "view")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("project_list_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const saveListAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.list_templates", "manage")])
  .inputValidator((input) =>
    z
      .object({
        listId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const refs = await workRpc<{
      statuses: Database["public"]["Tables"]["project_task_statuses"]["Row"][];
      fields: Database["public"]["Tables"]["project_list_custom_fields"]["Row"][];
    }>(supabase, "project_list_runtime_references", { p_list: data.listId, p_task: null });
    const { data: row, error } = await supabase
      .from("project_list_templates")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description ?? null,
        statuses: refs.statuses,
        custom_fields: refs.fields,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.list_templates", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_list_templates", data.id);
    return { ok: true };
  });

export const createListFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.lists", "create")])
  .inputValidator((input) =>
    z
      .object({
        templateId: z.string().uuid(),
        name: z.string().min(1),
        spaceId: z.string().uuid(),
        folderId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return workRpc<Database["public"]["Tables"]["project_lists"]["Row"]>(
      context.supabase,
      "project_list_create_checked",
      { p_data: data, p_template: data.templateId },
    );
  });

/** Minimal field schema for an already visible task; no configuration mutation. */
export const listTaskFieldReferences = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.tasks", "view")])
  .inputValidator((i) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const refs = await workRpc<{
      fields: Array<
        Pick<
          Database["public"]["Tables"]["project_list_custom_fields"]["Row"],
          "id" | "key" | "label" | "type" | "options" | "sort_order"
        >
      >;
    }>(context.supabase, "project_list_runtime_references", { p_task: data.taskId, p_list: null });
    return refs.fields;
  });
