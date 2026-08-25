// Diagnóstico de RBAC — leitura das permissões efetivas do usuário atual
// (ou de outro membro do workspace, quando o solicitante é admin/owner).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermissionCatalogRow } from "@/lib/access-control/action-matrix";

export type RbacRoleInfo = { id: string; name: string; is_primary: boolean };
export type RbacSetInfo = { id: string; name: string; module: string };

export type RbacWarning = {
  kind: "broad_permission" | "multiple_roles";
  severity: "high" | "medium";
  title: string;
  detail: string;
  keys: string[];
};

export type RbacDiagnostics = {
  workspace_id: string | null;
  workspace_name: string | null;
  user_id: string;
  full_name: string | null;
  member_role: string | null;
  is_workspace_owner: boolean;
  is_workspace_admin: boolean;
  is_platform_admin: boolean;
  job_roles: RbacRoleInfo[];
  permission_sets: RbacSetInfo[];
  permissions: string[];
  permission_labels: Record<string, string>;
  warnings: RbacWarning[];
};

/**
 * Permissões "amplas": ações que alcançam registros de outros usuários.
 * `manage` engloba todas as ações do recurso; escopos workspace/org/all
 * ignoram o vínculo de responsável.
 */
function computeWarnings(permissions: string[], roles: RbacRoleInfo[]): RbacWarning[] {
  const warnings: RbacWarning[] = [];
  const broad = permissions.filter((key) => {
    const parts = key.split(".");
    const action = parts[parts.length - 2];
    const scope = parts[parts.length - 1];
    const wide = scope === "workspace" || scope === "org" || scope === "all";
    return action === "manage" || (wide && (action === "delete" || action === "update"));
  });
  if (broad.length > 0) {
    warnings.push({
      kind: "broad_permission",
      severity: "high",
      title: `${broad.length} permissão(ões) ampla(s) detectada(s)`,
      detail:
        "Estas permissões permitem editar/excluir registros de outros usuários, ignorando o escopo de responsável. Revise em Configurações › Permissões.",
      keys: broad.sort(),
    });
  }
  if (roles.length > 1) {
    warnings.push({
      kind: "multiple_roles",
      severity: "medium",
      title: `Usuário acumula ${roles.length} cargos`,
      detail:
        "As permissões são somadas entre os cargos: o escopo mais amplo prevalece. Mantenha apenas o cargo necessário para que restrições de escopo próprio tenham efeito.",
      keys: roles.map((r) => r.name),
    });
  }
  return warnings;
}

export type WorkspaceMemberOption = { user_id: string; full_name: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveWorkspace(supabase: any, userId: string) {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) {
    const w = await supabase
      .from("workspaces")
      .select("id, name, created_by")
      .eq("id", m.data.workspace_id)
      .maybeSingle();
    return {
      workspaceId: m.data.workspace_id as string,
      name: (w.data?.name as string) ?? null,
      createdBy: (w.data?.created_by as string) ?? null,
      role: (m.data.role as string) ?? null,
    };
  }
  const w = await supabase
    .from("workspaces")
    .select("id, name, created_by")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return {
    workspaceId: (w.data?.id as string) ?? null,
    name: (w.data?.name as string) ?? null,
    createdBy: (w.data?.created_by as string) ?? null,
    role: w.data ? "owner" : null,
  };
}

/** Membros do workspace ativo — usado pelo seletor "inspecionar outro usuário". */
export const listWorkspaceMembersForDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceMemberOption[]> => {
    const { supabase, userId } = context;
    const ws = await resolveWorkspace(supabase, userId);
    if (!ws.workspaceId) return [];
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ws.workspaceId);
    const ids = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
    if (ws.createdBy && !ids.includes(ws.createdBy)) ids.push(ws.createdBy);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const byId = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
        p.id,
        p.full_name,
      ]),
    );
    return ids
      .map((id) => ({ user_id: id, full_name: byId.get(id) ?? null }))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  });

/** Catálogo global de permissões (sem dados sensíveis) para montar a matriz de ações. */
export const listPermissionCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PermissionCatalogRow[]> => {
    const { data } = await context.supabase
      .from("permissions")
      .select("key, module, resource, action, scope, label_pt");
    return (data ?? []) as PermissionCatalogRow[];
  });

export const getRbacDiagnostics = createServerFn({ method: "GET" })
  .inputValidator((input: { userId?: string } | undefined) => input ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<RbacDiagnostics> => {
    const { supabase, userId } = context;
    const ws = await resolveWorkspace(supabase, userId);

    // Somente admin/owner pode inspecionar outro usuário.
    let targetId = userId;
    if (data.userId && data.userId !== userId) {
      const isOwner = ws.createdBy === userId;
      let isAdmin = isOwner;
      if (!isAdmin && ws.workspaceId) {
        const { data: adminOk } = await supabase.rpc("is_workspace_admin_v2", {
          _workspace: ws.workspaceId,
          _user: userId,
        });
        isAdmin = !!adminOk;
      }
      if (!isAdmin) {
        throw new Error(
          "Permissão negada: apenas administradores do workspace podem inspecionar outros usuários.",
        );
      }
      targetId = data.userId;
    }

    const empty: RbacDiagnostics = {
      workspace_id: ws.workspaceId,
      workspace_name: ws.name,
      user_id: targetId,
      full_name: null,
      member_role: null,
      is_workspace_owner: ws.createdBy === targetId,
      is_workspace_admin: false,
      is_platform_admin: false,
      job_roles: [],
      permission_sets: [],
      permissions: [],
      permission_labels: {},
      warnings: [],
    };
    if (!ws.workspaceId) return empty;

    const [profRes, memberRes, adminRes, platformRes, permsRes, ujrRes, upsRes] = await Promise.all(
      [
        supabase.from("profiles").select("full_name").eq("id", targetId).maybeSingle(),
        supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", ws.workspaceId)
          .eq("user_id", targetId)
          .maybeSingle(),
        supabase.rpc("is_workspace_admin_v2", { _workspace: ws.workspaceId, _user: targetId }),
        supabase.rpc("is_platform_admin", { _user: targetId }),
        supabase.rpc("user_effective_permissions", {
          _user_id: targetId,
          _workspace_id: ws.workspaceId,
        }),
        supabase
          .from("user_job_roles")
          .select("role_id, is_primary, job_roles(id, name)")
          .eq("user_id", targetId),
        supabase
          .from("user_permission_sets")
          .select("set_id, permission_sets(id, name, module)")
          .eq("user_id", targetId),
      ],
    );

    const permissions = ((permsRes.data ?? []) as Array<string | Record<string, string>>).map(
      (r) => (typeof r === "string" ? r : (Object.values(r)[0] as string)),
    );

    const labels: Record<string, string> = {};
    if (permissions.length > 0) {
      const { data: meta } = await supabase
        .from("permissions")
        .select("key, label_pt")
        .in("key", permissions);
      for (const row of (meta ?? []) as Array<{ key: string; label_pt: string }>) {
        labels[row.key] = row.label_pt;
      }
    }

    type UjrRow = {
      role_id: string;
      is_primary: boolean;
      job_roles: { id: string; name: string } | null;
    };
    type UpsRow = {
      set_id: string;
      permission_sets: { id: string; name: string; module: string } | null;
    };

    const jobRoles: RbacRoleInfo[] = ((ujrRes.data ?? []) as UjrRow[]).map((r) => ({
      id: r.role_id,
      name: r.job_roles?.name ?? r.role_id,
      is_primary: r.is_primary,
    }));

    return {
      ...empty,
      full_name: (profRes.data?.full_name as string) ?? null,
      member_role: (memberRes.data?.role as string) ?? (ws.createdBy === targetId ? "owner" : null),
      is_workspace_admin: !!adminRes.data,
      is_platform_admin: !!platformRes.data,
      job_roles: jobRoles,
      permission_sets: ((upsRes.data ?? []) as UpsRow[]).map((r) => ({
        id: r.set_id,
        name: r.permission_sets?.name ?? r.set_id,
        module: r.permission_sets?.module ?? "—",
      })),
      permissions: permissions.sort(),
      permission_labels: labels,
      warnings: computeWarnings(permissions, jobRoles),
    };
  });
