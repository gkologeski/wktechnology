// Fase 3 — Enforcement de permissões.
// Server functions para consultar/afirmar permissões do usuário atual.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string | null> {
  // 1) workspace ativo escolhido pelo usuário (mesma fonte usada pelo seletor de workspace)
  const p = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (p.data?.active_workspace_id) return p.data.active_workspace_id as string;
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

/**
 * Lê as permissões efetivas em um único payload agregado (jsonb).
 * Evita truncamento da API quando o catálogo tem milhares de chaves.
 * Mantém fallback para o RPC antigo (linha por permissão).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchEffectivePermissions(supabase: any, workspaceId: string): Promise<string[]> {
  const agg = await supabase.rpc("current_user_permissions_json", {
    _workspace_id: workspaceId,
  });
  if (!agg.error && Array.isArray(agg.data)) return agg.data as string[];
  const { data, error } = await supabase.rpc("current_user_permissions", {
    _workspace_id: workspaceId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<string | { current_user_permissions: string }>).map((r) =>
    typeof r === "string" ? r : r.current_user_permissions,
  );
}

export type MyPermissionsResult = {
  workspace_id: string | null;
  permissions: string[];
};

/**
 * Retorna todas as permission_keys efetivas do usuário atual no workspace ativo.
 */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPermissionsResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    if (!workspaceId) return { workspace_id: null, permissions: [] };
    const perms = await fetchEffectivePermissions(supabase, workspaceId);
    return { workspace_id: workspaceId, permissions: perms };
  });


export type MyPermissionDetail = {
  key: string;
  label_pt: string | null;
  description: string | null;
  module: string | null;
  resource: string | null;
  action: string | null;
  scope: string | null;
};

export type MyPermissionsDetailed = {
  workspace_id: string | null;
  items: MyPermissionDetail[];
};

/**
 * Retorna as permissões efetivas do usuário atual com metadados (label, módulo, etc.).
 * Usado pela tela "Minhas permissões".
 */
export const getMyPermissionsDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPermissionsDetailed> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    if (!workspaceId) return { workspace_id: null, items: [] };
    const { data: keysData, error: keysErr } = await supabase.rpc(
      "current_user_permissions",
      { _workspace_id: workspaceId },
    );
    if (keysErr) throw new Error(keysErr.message);
    const keys = ((keysData ?? []) as Array<string | { current_user_permissions: string }>).map(
      (r) => (typeof r === "string" ? r : r.current_user_permissions),
    );
    if (keys.length === 0) return { workspace_id: workspaceId, items: [] };
    const { data: meta, error: metaErr } = await supabase
      .from("permissions")
      .select("key, label_pt, description, module, resource, action, scope")
      .in("key", keys);
    if (metaErr) throw new Error(metaErr.message);
    const byKey = new Map<string, MyPermissionDetail>();
    for (const k of keys) {
      byKey.set(k, {
        key: k,
        label_pt: null,
        description: null,
        module: null,
        resource: null,
        action: null,
        scope: null,
      });
    }
    for (const row of meta ?? []) {
      const r = row as Record<string, string | null>;
      const existing = byKey.get(r.key as string);
      if (existing) {
        existing.label_pt = r.label_pt ?? null;
        existing.description = r.description ?? null;
        existing.module = r.module ?? null;
        existing.resource = r.resource ?? null;
        existing.action = r.action ?? null;
        existing.scope = r.scope ?? null;
      }
    }
    const items = Array.from(byKey.values()).sort((a, b) =>
      (a.module ?? "").localeCompare(b.module ?? "") ||
      a.key.localeCompare(b.key),
    );
    return { workspace_id: workspaceId, items };
  });

