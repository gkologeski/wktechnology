import { workRpc } from "./work-core.server";
// Fase 3 — Enforcement de permissões.
// Server functions para consultar/afirmar permissões do usuário atual.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveActiveWorkspace(
  supabase: Parameters<typeof workRpc>[0],
  _userId: string,
): Promise<string | null> {
  const c = await workRpc<{ workspace?: string }>(supabase, "work_access_context", {});
  return c?.workspace ?? null;
}

/**
 * Lê as permissões efetivas em um único payload agregado (jsonb).
 * Evita truncamento da API quando o catálogo tem milhares de chaves.
 * Normaliza aliases de macros no banco, respeitando denies em ambos os nomes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchEffectivePermissions(supabase: any, workspaceId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("shared_configuration_permission_keys", {
    p_workspace: workspaceId,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Permissões indisponíveis.");
  return data as string[];
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
    const keys = await fetchEffectivePermissions(supabase, workspaceId);
    if (keys.length === 0) return { workspace_id: workspaceId, items: [] };
    // Busca metadados em lotes: evita URL longa demais e o limite de linhas da API.
    const meta: Array<Record<string, string | null>> = [];
    for (let i = 0; i < keys.length; i += 200) {
      const chunk = keys.slice(i, i + 200);
      const { data, error: metaErr } = await supabase
        .from("permissions")
        .select("key, label_pt, description, module, resource, action, scope")
        .in("key", chunk);
      if (metaErr) throw new Error(metaErr.message);
      meta.push(...((data ?? []) as Array<Record<string, string | null>>));
    }
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
    const items = Array.from(byKey.values()).sort(
      (a, b) => (a.module ?? "").localeCompare(b.module ?? "") || a.key.localeCompare(b.key),
    );
    return { workspace_id: workspaceId, items };
  });
