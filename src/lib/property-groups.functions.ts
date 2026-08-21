// Server fns para gerenciar "grupos de propriedades" — derivados de custom_properties.group_name.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CUSTOM_ENTITIES, type CustomEntity } from "@/lib/custom-properties.functions";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const listPropertyGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ entity: z.enum(CUSTOM_ENTITIES) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("custom_properties")
      .select("group_name, position, enabled")
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity);
    if (error) throw new Error(error.message);

    const map = new Map<string, { name: string; count: number; min_position: number }>();
    for (const r of (rows ?? []) as Array<{ group_name: string | null; position: number | null }>) {
      const name = (r.group_name ?? "").trim() || "Sem grupo";
      const cur = map.get(name) ?? { name, count: 0, min_position: Number.MAX_SAFE_INTEGER };
      cur.count += 1;
      cur.min_position = Math.min(cur.min_position, r.position ?? 0);
      map.set(name, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => a.min_position - b.min_position || a.name.localeCompare(b.name),
    );
  });

export const renamePropertyGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(CUSTOM_ENTITIES),
        from: z.string().min(1).max(80),
        to: z.string().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("custom_properties")
      .update({ group_name: data.to.trim() } as never)
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity)
      .eq("group_name", data.from);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePropertyGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(CUSTOM_ENTITIES),
        name: z.string().min(1).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // Não exclui as propriedades; apenas remove o agrupamento.
    const { error } = await supabase
      .from("custom_properties")
      .update({ group_name: null } as never)
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity)
      .eq("group_name", data.name);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderPropertyGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(CUSTOM_ENTITIES),
        name: z.string().min(1).max(80),
        base_position: z.number().int().min(0).max(100000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("custom_properties")
      .select("id, position")
      .eq("workspace_id", workspaceId)
      .eq("entity", data.entity)
      .eq("group_name", data.name)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; position: number | null }>;
    let i = 0;
    for (const r of list) {
      const newPos = data.base_position + i;
      const { error: uErr } = await supabase
        .from("custom_properties")
        .update({ position: newPos } as never)
        .eq("id", r.id);
      if (uErr) throw new Error(uErr.message);
      i += 1;
    }
    return { ok: true, updated: list.length };
  });

export type PropertyGroupSummary = { name: string; count: number; min_position: number };
export type { CustomEntity };
