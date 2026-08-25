// Refinos Sprint E: Custom Fields por lista + List Templates.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const fieldTypeEnum = z.enum(["text", "number", "date", "select", "checkbox", "url"]);

// ============ CUSTOM FIELDS ============
export const listCustomFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("project_list_custom_fields").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const updateTaskCustomFieldValues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
    const [statusesRes, fieldsRes] = await Promise.all([
      supabase
        .from("project_task_statuses")
        .select("name, color, category, sort_order, is_default")
        .eq("list_id", data.listId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("project_list_custom_fields")
        .select("key, label, type, options, sort_order")
        .eq("list_id", data.listId)
        .order("sort_order", { ascending: true }),
    ]);
    if (statusesRes.error) throw statusesRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    const { data: row, error } = await supabase
      .from("project_list_templates")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description ?? null,
        statuses: statusesRes.data ?? [],
        custom_fields: fieldsRes.data ?? [],
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("project_list_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const createListFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: tpl, error: tplErr } = await supabase
      .from("project_list_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) throw new Error("Template não encontrado");

    // Cria a lista
    const { data: list, error: listErr } = await supabase
      .from("project_lists")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        space_id: data.spaceId,
        folder_id: data.folderId ?? null,
        project_id: data.projectId ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (listErr) throw listErr;

    // Statuses do template
    const tplStatuses = Array.isArray(tpl.statuses) ? tpl.statuses : [];
    if (tplStatuses.length > 0) {
      await supabase.from("project_task_statuses").insert(
        tplStatuses.map((s: any, i: number) => ({
          workspace_id: workspaceId,
          list_id: list.id,
          name: s.name,
          color: s.color ?? "#94a3b8",
          category: s.category ?? "todo",
          sort_order: s.sort_order ?? i,
          is_default: !!s.is_default,
        })),
      );
    }

    // Custom fields do template
    const tplFields = Array.isArray(tpl.custom_fields) ? tpl.custom_fields : [];
    if (tplFields.length > 0) {
      await supabase.from("project_list_custom_fields").insert(
        tplFields.map((f: any, i: number) => ({
          workspace_id: workspaceId,
          list_id: list.id,
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options ?? null,
          sort_order: f.sort_order ?? i,
        })),
      );
    }

    return list;
  });
