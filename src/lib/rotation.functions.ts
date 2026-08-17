// Server functions para o módulo de Distribuição (rotação).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyRotation } from "@/lib/rotation/engine.server";

const EntityEnum = z.enum(["leads", "deals", "tickets"]);
const StrategyEnum = z.enum(["round_robin", "weighted"]);

const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "in", "contains", "gt", "lt", "changed_to", "is_empty", "is_not_empty"]),
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
      .select(
        "id, name, entity, enabled, strategy, filters, assignees, last_index, last_assigned_user_id, last_assigned_at, updated_at",
      )
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
    const { data: row, error } = await supabase
      .from("rotation_rules")
      .insert(payload)
      .select("id")
      .single();
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

/** Lista os membros do workspace ativo do usuário. Resolve nomes a partir de profiles. */
export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Descobre o workspace ativo do usuário (via profiles.active_workspace_id);
    // se não houver, usa o primeiro workspace do qual ele é membro.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();

    let activeWorkspaceId =
      (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;

    if (!activeWorkspaceId) {
      const { data: firstMembership } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      activeWorkspaceId = (firstMembership?.workspace_id as string | undefined) ?? null;
    }

    // Coleta IDs: membros do workspace ativo + legado (team_members) + o próprio usuário.
    const ids = new Set<string>([userId]);
    let workspaceOwnerId: string | null = null;

    if (activeWorkspaceId) {
      const { data: wsMembers } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", activeWorkspaceId);
      (wsMembers ?? []).forEach((m) => ids.add(m.user_id as string));

      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("created_by")
        .eq("id", activeWorkspaceId)
        .maybeSingle();
      workspaceOwnerId = (ws as { created_by: string | null } | null)?.created_by ?? null;
      if (workspaceOwnerId) ids.add(workspaceOwnerId);
    }

    // Fallback legado (estrutura antiga baseada em owner_id).
    const { data: legacyMembership } = await supabaseAdmin
      .from("team_members")
      .select("workspace_owner_id")
      .eq("member_user_id", userId)
      .limit(1)
      .maybeSingle();
    const legacyOwnerId = (legacyMembership?.workspace_owner_id as string | undefined) ?? userId;
    ids.add(legacyOwnerId);
    const { data: legacyMembers } = await supabaseAdmin
      .from("team_members")
      .select("member_user_id")
      .eq("workspace_owner_id", legacyOwnerId);
    (legacyMembers ?? []).forEach((m) => ids.add(m.member_user_id as string));

    const idList = Array.from(ids);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", idList);

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? "").trim()]),
    );

    // Fallback: buscar e-mail em auth.users apenas para IDs sem full_name.
    const missing = idList.filter((id) => !nameById.get(id));
    const emailById = new Map<string, string>();
    if (missing.length > 0) {
      const lookups = await Promise.all(
        missing.map((id) => supabaseAdmin.auth.admin.getUserById(id).catch(() => null)),
      );
      lookups.forEach((res, i) => {
        const email = res?.data?.user?.email;
        if (email) emailById.set(missing[i], email);
      });
    }

    return idList
      .map((id) => ({
        user_id: id,
        full_name:
          nameById.get(id) ||
          emailById.get(id) ||
          (id === workspaceOwnerId ? "Workspace (admin)" : `${id.slice(0, 8)}…`),
        is_owner: id === workspaceOwnerId || id === legacyOwnerId,
        is_me: id === userId,
      }))
      .sort((a, b) => {
        if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
        if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
        return a.full_name.localeCompare(b.full_name);
      });
  });

/** Aplica rotação manualmente em um registro (debug/uso pontual). */
export const rotateRecordNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        rule_id: z.string().uuid(),
        entity: EntityEnum,
        entity_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    return await applyRotation(context.supabase, data.rule_id, data.entity, data.entity_id);
  });
