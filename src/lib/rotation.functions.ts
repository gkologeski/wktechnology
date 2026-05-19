// Server functions para o módulo de Distribuição (rotação).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyRotation } from "@/lib/rotation/engine.server";

const EntityEnum = z.enum(["leads", "deals"]);
const StrategyEnum = z.enum(["round_robin", "weighted"]);

const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq","neq","in","contains","gt","lt","changed_to","is_empty","is_not_empty"]),
  value: z.unknown().optional(),
});

const AssigneeSchema = z.object({
  user_id: z.string().uuid(),
  weight: z.number().int().min(1).max(100).default(1),
});

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: EntityEnum,
  enabled: z.boolean(),
  strategy: StrategyEnum,
  filters: z.array(FilterSchema).max(20).default([]),
  assignees: z.array(AssigneeSchema).min(1).max(50),
});

export const listRotationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rotation_rules")
      .select("id, name, entity, enabled, strategy, filters, assignees, last_index, last_assigned_user_id, last_assigned_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveRotationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      strategy: data.strategy,
      filters: data.filters,
      assignees: data.assignees,
    } as never;
    if (data.id) {
      const { error } = await supabase.from("rotation_rules").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("rotation_rules").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRotationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rotation_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista os membros do workspace (o dono + team_members). */
export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members } = await supabase
      .from("team_members")
      .select("member_user_id, role")
      .eq("workspace_owner_id", userId);

    const ids = Array.from(new Set([userId, ...((members ?? []).map((m) => m.member_user_id as string))]));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
    return ids.map((id) => ({
      user_id: id,
      full_name: nameById.get(id) || (id === userId ? "Você (admin)" : id.slice(0, 8)),
      is_owner: id === userId,
    }));
  });

/** Aplica rotação manualmente em um registro (debug/uso pontual). */
export const rotateRecordNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    rule_id: z.string().uuid(),
    entity: EntityEnum,
    entity_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    return await applyRotation(context.supabase, data.rule_id, data.entity, data.entity_id);
  });
