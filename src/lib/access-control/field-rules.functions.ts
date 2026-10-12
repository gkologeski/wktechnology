// Fase 4 — Field-level access rules.
// Retorna, para o usuário atual, o modo efetivo (hidden|masked|readonly) por campo/recurso.
// Owner/admin do workspace não recebem restrições.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FieldMode = "hidden" | "masked" | "readonly";
export type FieldRulesMap = Record<string, Record<string, FieldMode>>;
// { [resource]: { [field]: mode } }

const PRIORITY: Record<FieldMode, number> = { readonly: 1, masked: 2, hidden: 3 };

// Resolvedor canônico (perfil ativo + membership ativa); nunca a primeira membership.
async function resolveActiveWorkspaceOrNull(userId: string): Promise<string | null> {
  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  try {
    return await resolveActiveWorkspace(userId);
  } catch {
    return null;
  }
}

export type MyFieldRulesResult = {
  workspace_id: string | null;
  is_privileged: boolean;
  rules: FieldRulesMap;
};

/**
 * Retorna todas as regras de campo efetivas do usuário atual no workspace ativo.
 * Owner do workspace (created_by) e membros com role owner/admin recebem is_privileged=true
 * e mapa vazio — nada é escondido/mascarado para eles.
 */
export const getMyFieldRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyFieldRulesResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspaceOrNull(userId);
    if (!workspaceId) return { workspace_id: null, is_privileged: false, rules: {} };

    // Privilégio: owner do workspace ou member com role owner/admin.
    const [wRes, memRes] = await Promise.all([
      supabase.from("workspaces").select("created_by").eq("id", workspaceId).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const isPrivileged =
      wRes.data?.created_by === userId ||
      memRes.data?.role === "owner" ||
      memRes.data?.role === "admin";
    if (isPrivileged) {
      return { workspace_id: workspaceId, is_privileged: true, rules: {} };
    }

    // Cargos e conjuntos do usuário.
    const [rolesRes, setsRes] = await Promise.all([
      supabase
        .from("user_job_roles")
        .select("role_id")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId),
      supabase
        .from("user_permission_sets")
        .select("set_id")
        .eq("user_id", userId)
        .eq("workspace_id", workspaceId),
    ]);
    const roleIds = ((rolesRes.data ?? []) as Array<{ role_id: string }>).map((r) => r.role_id);
    let setIds = ((setsRes.data ?? []) as Array<{ set_id: string }>).map((s) => s.set_id);

    // Conjuntos herdados por cargos.
    if (roleIds.length) {
      // Mesma regra do banco: substituição local do workspace + escopo do pacote.
      const { loadResolvedRoleSets } = await import("./role-set-resolution.server");
      const byRole = await loadResolvedRoleSets(supabase, workspaceId, roleIds);
      const inherited = [...byRole.values()].flat();
      setIds = Array.from(new Set([...setIds, ...inherited]));
    }

    // Regras aplicáveis: role_id em roleIds OU set_id em setIds.
    if (!roleIds.length && !setIds.length) {
      return { workspace_id: workspaceId, is_privileged: false, rules: {} };
    }
    const filters: string[] = [];
    if (roleIds.length) filters.push(`role_id.in.(${roleIds.join(",")})`);
    if (setIds.length) filters.push(`set_id.in.(${setIds.join(",")})`);
    const rulesRes = await supabase
      .from("field_permission_rules")
      .select("resource, field, mode")
      .or(filters.join(","));

    const map: FieldRulesMap = {};
    for (const r of (rulesRes.data ?? []) as Array<{
      resource: string;
      field: string;
      mode: FieldMode;
    }>) {
      const bucket = map[r.resource] ?? {};
      const current = bucket[r.field];
      if (!current || PRIORITY[r.mode] > PRIORITY[current]) bucket[r.field] = r.mode;
      map[r.resource] = bucket;
    }

    return { workspace_id: workspaceId, is_privileged: false, rules: map };
  });
