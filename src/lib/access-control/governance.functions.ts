// TechERP Access Control — Fase 6: Auditoria, Simulação e Governança.
// Read-only server functions used by /home/access → abas "Auditoria",
// "Simular usuário" e "Relatórios".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function resolveWorkspace(supabase: SB, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
}

async function assertOwnerOrAdmin(
  supabase: SB,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const { data: w } = await supabase
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .maybeSingle();
  if (w?.created_by === userId) return;
  const { data: m } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (m?.role === "owner" || m?.role === "admin") return;
  throw new Error("Apenas owner e administradores podem acessar governança.");
}

// -------------------- Audit log --------------------
export type AuditRow = {
  id: string;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  details: Record<string, string | number | boolean | null>;
  created_at: string;
};

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(100),
        action: z.string().max(60).nullish(),
        target_user_id: z.string().uuid().nullish(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<AuditRow[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) return [];
    await assertOwnerOrAdmin(supabase, userId, workspaceId);
    let q = supabase
      .from("access_audit_log")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.target_user_id) q = q.eq("target_user_id", data.target_user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AuditRow[];
  });

// -------------------- Simulation ("Impersonate") --------------------
// Returns the effective permissions, field rules and data scope for another user,
// as calculated by the same DB functions the real request path uses.
export type SimulationResult = {
  user_id: string;
  workspace_id: string;
  permissions: string[];
  data_scope: "own" | "team" | "workspace" | "custom";
  field_rules: Array<{
    resource: string;
    field: string;
    mode: "hidden" | "masked" | "readonly";
  }>;
};

export const simulateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) throw new Error("Workspace não encontrado.");
    await assertOwnerOrAdmin(supabase, userId, workspaceId);

    const [permsRes, scopeRes] = await Promise.all([
      supabase.rpc("user_effective_permissions", {
        _user_id: data.user_id,
        _workspace_id: workspaceId,
      }),
      supabase.rpc("user_data_scope", {
        _user_id: data.user_id,
        _workspace_id: workspaceId,
      }),
    ]);
    const permissions = ((permsRes.data ?? []) as Array<{ permission_key: string } | string>)
      .map((r) => (typeof r === "string" ? r : r.permission_key))
      .filter(Boolean);

    // Collect field rules matching the user's roles/sets
    const [rolesRes, setsRes] = await Promise.all([
      supabase
        .from("user_job_roles")
        .select("role_id")
        .eq("owner_id", workspaceId)
        .eq("user_id", data.user_id),
      supabase
        .from("user_permission_sets")
        .select("set_id")
        .eq("owner_id", workspaceId)
        .eq("user_id", data.user_id),
    ]);
    const roleIds = ((rolesRes.data ?? []) as Array<{ role_id: string }>).map((r) => r.role_id);
    const setIds = ((setsRes.data ?? []) as Array<{ set_id: string }>).map((r) => r.set_id);
    const { data: rules } = await supabase
      .from("field_permission_rules")
      .select("resource, field, mode, role_id, set_id");
    const applicable = ((rules ?? []) as Array<{
      resource: string;
      field: string;
      mode: "hidden" | "masked" | "readonly";
      role_id: string | null;
      set_id: string | null;
    }>).filter(
      (r) =>
        (r.role_id && roleIds.includes(r.role_id)) ||
        (r.set_id && setIds.includes(r.set_id)),
    );

    return {
      user_id: data.user_id,
      workspace_id: workspaceId,
      permissions,
      data_scope: (scopeRes.data as SimulationResult["data_scope"]) ?? "own",
      field_rules: applicable.map(({ resource, field, mode }) => ({ resource, field, mode })),
    };
  });

// -------------------- Governance report --------------------
export type GovernanceReport = {
  workspace_id: string;
  total_members: number;
  members_without_role: number;
  system_roles: number;
  custom_roles: number;
  system_sets: number;
  custom_sets: number;
  field_rules: number;
  scope_breakdown: Record<"own" | "team" | "workspace" | "custom", number>;
  members_by_role: Array<{ role_id: string; role_name: string; count: number }>;
};

export const getGovernanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GovernanceReport | null> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveWorkspace(supabase, userId);
    if (!workspaceId) return null;
    await assertOwnerOrAdmin(supabase, userId, workspaceId);

    const [membersRes, rolesRes, setsRes, rulesRes, ujrRes] = await Promise.all([
      supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId),
      supabase.from("job_roles").select("id, name, is_system, data_scope"),
      supabase.from("permission_sets").select("id, is_system"),
      supabase.from("field_permission_rules").select("id"),
      supabase
        .from("user_job_roles")
        .select("user_id, role_id")
        .eq("owner_id", workspaceId),
    ]);

    const members = (membersRes.data ?? []) as Array<{ user_id: string }>;
    const roles = (rolesRes.data ?? []) as Array<{
      id: string;
      name: string;
      is_system: boolean;
      data_scope: "own" | "team" | "workspace" | "custom";
    }>;
    const sets = (setsRes.data ?? []) as Array<{ id: string; is_system: boolean }>;
    const rules = (rulesRes.data ?? []) as Array<{ id: string }>;
    const ujr = (ujrRes.data ?? []) as Array<{ user_id: string; role_id: string }>;

    const assignedUserIds = new Set(ujr.map((r) => r.user_id));
    const membersWithoutRole = members.filter((m) => !assignedUserIds.has(m.user_id)).length;

    const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
    const scopeById = new Map(roles.map((r) => [r.id, r.data_scope]));
    const membersByRole = new Map<string, number>();
    const scopeBreakdown = { own: 0, team: 0, workspace: 0, custom: 0 } as GovernanceReport["scope_breakdown"];
    for (const r of ujr) {
      membersByRole.set(r.role_id, (membersByRole.get(r.role_id) ?? 0) + 1);
      const sc = scopeById.get(r.role_id);
      if (sc) scopeBreakdown[sc] += 1;
    }

    return {
      workspace_id: workspaceId,
      total_members: members.length,
      members_without_role: membersWithoutRole,
      system_roles: roles.filter((r) => r.is_system).length,
      custom_roles: roles.filter((r) => !r.is_system).length,
      system_sets: sets.filter((s) => s.is_system).length,
      custom_sets: sets.filter((s) => !s.is_system).length,
      field_rules: rules.length,
      scope_breakdown: scopeBreakdown,
      members_by_role: Array.from(membersByRole.entries())
        .map(([role_id, count]) => ({
          role_id,
          role_name: roleNameById.get(role_id) ?? role_id,
          count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  });
