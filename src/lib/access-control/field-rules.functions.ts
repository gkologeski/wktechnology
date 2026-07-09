// Fase 4 — Field-level access rules.
// Retorna, para o usuário atual, o modo efetivo (hidden|masked|readonly) por campo/recurso.
// Owner/admin do workspace não recebem restrições.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FieldMode = "hidden" | "masked" | "readonly";
export type FieldRulesMap = Record<string, Record<string, FieldMode>>;
// { [resource]: { [field]: mode } }

const PRIORITY: Record<FieldMode, number> = { readonly: 1, masked: 2, hidden: 3 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
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
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
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
        .eq("owner_id", workspaceId)
        .eq("user_id", userId),
      supabase
        .from("user_permission_sets")
        .select("set_id")
        .eq("owner_id", workspaceId)
        .eq("user_id", userId),
    ]);
    const roleIds = ((rolesRes.data ?? []) as Array<{ role_id: string }>).map((r) => r.role_id);
    let setIds = ((setsRes.data ?? []) as Array<{ set_id: string }>).map((s) => s.set_id);

    // Conjuntos herdados por cargos.
    if (roleIds.length) {
      const jrs = await supabase
        .from("job_role_sets")
        .select("set_id")
        .in("role_id", roleIds);
      const inherited = ((jrs.data ?? []) as Array<{ set_id: string }>).map((r) => r.set_id);
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
