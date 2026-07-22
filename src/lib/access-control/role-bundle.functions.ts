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

// -------- Role management (custom, non-system) --------

const CreateRoleInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

export const createJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("job_roles")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        is_system: false,
        data_scope: "workspace",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

const DuplicateRoleInput = z.object({
  source_role_id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
});

export const duplicateJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DuplicateRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const src = await supabase
      .from("job_roles")
      .select("id, name, description, color, data_scope")
      .eq("id", data.source_role_id)
      .maybeSingle();
    if (src.error) throw new Error(src.error.message);
    if (!src.data) throw new Error("Cargo de origem não encontrado.");
    const source = src.data as {
      name: string;
      description: string | null;
      color: string | null;
      data_scope: string;
    };
    const newName = data.name?.trim() || `${source.name} (cópia)`;

    const ins = await supabase
      .from("job_roles")
      .insert({
        owner_id: userId,
        name: newName,
        description: source.description,
        color: source.color,
        is_system: false,
        data_scope: (source.data_scope as "own" | "team" | "workspace" | "custom") ?? "workspace",
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    const newRoleId = (ins.data as { id: string }).id;

    // Copy granted keys from source into a new bundle for the new role.
    const links = await supabase
      .from("job_role_sets")
      .select("permission_sets!inner(permission_set_items(permission_key))")
      .eq("role_id", data.source_role_id);
    if (links.error) throw new Error(links.error.message);
    const keys = new Set<string>();
    for (const row of (links.data ?? []) as Array<{
      permission_sets: { permission_set_items: Array<{ permission_key: string }> };
    }>) {
      for (const it of row.permission_sets?.permission_set_items ?? []) {
        keys.add(it.permission_key);
      }
    }
    if (keys.size > 0) {
      const setId = await ensureBundle(supabase, userId, newRoleId);
      const rows = Array.from(keys).map((k) => ({ set_id: setId, permission_key: k }));
      const { error: e } = await supabase
        .from("permission_set_items")
        .upsert(rows, { onConflict: "set_id,permission_key" });
      if (e) throw new Error(e.message);
    }

    return { id: newRoleId, copied: keys.size };
  });

const RenameRoleInput = z.object({
  role_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
});

export const renameJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RenameRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertRoleEditable(supabase, data.role_id);
    const patch: { name: string; description?: string | null; color?: string | null } = {
      name: data.name,
    };
    if (data.description !== undefined) patch.description = data.description;
    if (data.color !== undefined) patch.color = data.color;
    const { error } = await supabase.from("job_roles").update(patch).eq("id", data.role_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteRoleInput = z.object({ role_id: z.string().uuid() });

export const deleteJobRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRoleEditable(supabase, data.role_id);
    // Collect bundles owned by the caller linked to this role, so we can clean them up.
    const links = await supabase
      .from("job_role_sets")
      .select("set_id, permission_sets!inner(id, module, owner_id)")
      .eq("role_id", data.role_id);
    if (links.error) throw new Error(links.error.message);
    const bundleIds = ((links.data ?? []) as Array<{
      set_id: string;
      permission_sets: { module: string; owner_id: string | null };
    }>)
      .filter((r) => r.permission_sets?.module === BUNDLE_MODULE && r.permission_sets?.owner_id === userId)
      .map((r) => r.set_id);

    // Remove all role-set links.
    const unlink = await supabase.from("job_role_sets").delete().eq("role_id", data.role_id);
    if (unlink.error) throw new Error(unlink.error.message);

    // Delete orphan bundle permission_sets (items cascade via RLS-scoped delete).
    for (const setId of bundleIds) {
      await supabase.from("permission_set_items").delete().eq("set_id", setId);
      await supabase.from("permission_sets").delete().eq("id", setId);
    }

    const del = await supabase.from("job_roles").delete().eq("id", data.role_id);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });
