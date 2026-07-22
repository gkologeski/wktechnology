// Server functions to manage a per-role "permission bundle".
// A role bundle is a dedicated permission_set (module='__bundle__') linked 1:1 to a
// job_role via job_role_sets. Toggling a permission for a role inserts/removes rows
// in permission_set_items on the bundle. System roles are read-only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUNDLE_MODULE = "__bundle__";

async function resolveActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const wsId =
    (m.data as { workspace_id?: string } | null)?.workspace_id ??
    (
      (
        await supabase
          .from("workspaces")
          .select("id")
          .eq("created_by", userId)
          .limit(1)
          .maybeSingle()
      ).data as { id?: string } | null
    )?.id;
  if (!wsId) throw new Error("Workspace ativo não encontrado");
  return wsId;
}

async function assertRoleEditable(supabase: SupabaseClient, roleId: string) {
  const { data, error } = await supabase
    .from("job_roles")
    .select("id, is_system, owner_id")
    .eq("id", roleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cargo não encontrado.");
  if ((data as { is_system: boolean }).is_system) {
    throw new Error("Cargos do sistema não podem ser editados.");
  }
  return data as { id: string; owner_id: string | null };
}

async function ensureBundle(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
): Promise<string> {
  // Try to find an existing bundle linked to this role owned by the current user.
  const existing = await supabase
    .from("job_role_sets")
    .select("set_id, permission_sets!inner(id, module, owner_id)")
    .eq("role_id", roleId);
  if (existing.error) throw new Error(existing.error.message);
  const rows = (existing.data ?? []) as unknown as Array<{
    set_id: string;
    permission_sets: { id: string; module: string; owner_id: string | null };
  }>;
  const found = rows.find(
    (r) => r.permission_sets?.module === BUNDLE_MODULE && r.permission_sets?.owner_id === userId,
  );
  if (found) return found.set_id;

  // Create a new bundle set + link it.
  const name = `__role_bundle:${roleId}`;
  const { data: ins, error: insErr } = await supabase
    .from("permission_sets")
    .insert({
      owner_id: userId,
      module: BUNDLE_MODULE,
      name,
      description: "Bundle gerado automaticamente para o cargo.",
      is_system: false,
    })
    .select("id")
    .single();
  if (insErr) {
    // Race / already exists: try to fetch
    const q = await supabase
      .from("permission_sets")
      .select("id")
      .eq("owner_id", userId)
      .eq("module", BUNDLE_MODULE)
      .eq("name", name)
      .maybeSingle();
    if (q.data?.id) {
      // Ensure link
      await supabase
        .from("job_role_sets")
        .upsert({ role_id: roleId, set_id: q.data.id as string });
      return q.data.id as string;
    }
    throw new Error(insErr.message);
  }
  const setId = (ins as { id: string }).id;
  const { error: linkErr } = await supabase
    .from("job_role_sets")
    .upsert({ role_id: roleId, set_id: setId });
  if (linkErr) throw new Error(linkErr.message);
  return setId;
}

const SetPermInput = z.object({
  role_id: z.string().uuid(),
  permission_key: z.string().min(1),
  granted: z.boolean(),
});

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetPermInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await resolveActiveWorkspace(supabase, userId);
    await assertRoleEditable(supabase, data.role_id);
    const setId = await ensureBundle(supabase, userId, data.role_id);
    if (data.granted) {
      const { error } = await supabase
        .from("permission_set_items")
        .upsert(
          { set_id: setId, permission_key: data.permission_key },
          { onConflict: "set_id,permission_key" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("permission_set_items")
        .delete()
        .eq("set_id", setId)
        .eq("permission_key", data.permission_key);
      if (error) throw new Error(error.message);
    }
    return { ok: true, set_id: setId };
  });

const BulkInput = z.object({
  role_id: z.string().uuid(),
  keys: z.array(z.string().min(1)).min(1),
  granted: z.boolean(),
});

export const bulkSetRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BulkInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await resolveActiveWorkspace(supabase, userId);
    await assertRoleEditable(supabase, data.role_id);
    const setId = await ensureBundle(supabase, userId, data.role_id);
    if (data.granted) {
      const rows = data.keys.map((k) => ({ set_id: setId, permission_key: k }));
      const { error } = await supabase
        .from("permission_set_items")
        .upsert(rows, { onConflict: "set_id,permission_key" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("permission_set_items")
        .delete()
        .eq("set_id", setId)
        .in("permission_key", data.keys);
      if (error) throw new Error(error.message);
    }
    return { ok: true, set_id: setId, count: data.keys.length };
  });

export type RoleBundleMap = Record<string, Set<string>>;

/**
 * Returns, for each non-system role, the set of permission_keys granted to it
 * via any linked permission_set (bundle or otherwise). Used to render the matrix.
 */
export const getMatrixState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const links = await supabase
      .from("job_role_sets")
      .select("role_id, set_id, permission_sets!inner(permission_set_items(permission_key))");
    if (links.error) throw new Error(links.error.message);
    const map: Record<string, string[]> = {};
    for (const row of (links.data ?? []) as Array<{
      role_id: string;
      permission_sets: { permission_set_items: Array<{ permission_key: string }> };
    }>) {
      const keys = (row.permission_sets?.permission_set_items ?? []).map(
        (i) => i.permission_key,
      );
      if (!map[row.role_id]) map[row.role_id] = [];
      map[row.role_id].push(...keys);
    }
    // Deduplicate.
    const out: Record<string, string[]> = {};
    for (const [rid, arr] of Object.entries(map)) out[rid] = Array.from(new Set(arr));
    return out;
  });
