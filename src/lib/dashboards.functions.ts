import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const WidgetTypeSchema = z.enum(["report", "kpi", "note"]);

export const listDashboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dashboards")
      .select("*")
      .order("is_default", { ascending: false })
      .order("is_favorite", { ascending: false })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        is_default: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.is_default) {
      await supabase.from("dashboards").update({ is_default: false }).eq("workspace_id", workspaceId);
    }
    const { data: row, error } = await supabase
      .from("dashboards")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
        name: data.name,
        description: data.description ?? null,
        is_default: data.is_default,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        is_default: z.boolean().optional(),
        is_favorite: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.is_default) {
      await supabase
        .from("dashboards")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId)
        .neq("id", data.id);
    }
    const patch: {
      name?: string;
      description?: string | null;
      is_default?: boolean;
      is_favorite?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_default !== undefined) patch.is_default = data.is_default;
    if (data.is_favorite !== undefined) patch.is_favorite = data.is_favorite;
    const { error } = await supabase.from("dashboards").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dashboards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dashboard_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("dashboard_widgets")
      .select("*")
      .eq("dashboard_id", data.dashboard_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        dashboard_id: z.string().uuid(),
        title: z.string().min(1).max(120),
        widget_type: WidgetTypeSchema.default("report"),
        report_id: z.string().uuid().nullable().optional(),
        config: z.record(z.string(), z.any()).default({}),
        position: z.number().int().min(0).max(999).default(0),
        width: z.number().int().min(3).max(12).default(6),
        height: z.number().int().min(1).max(4).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const payload = {
      dashboard_id: data.dashboard_id,
      title: data.title,
      widget_type: data.widget_type,
      report_id: data.report_id ?? null,
      config: data.config,
      position: data.position,
      width: data.width,
      height: data.height,
    };
    if (data.id) {
      const { error } = await supabase.from("dashboard_widgets").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("dashboard_widgets")
      .insert({ ...payload, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dashboard_widgets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderWidgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0).max(999) }))
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("dashboard_widgets")
        .update({ position: it.position })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
