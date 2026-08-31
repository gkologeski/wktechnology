// Server functions to manage a per-role "permission bundle".
// A role bundle is a dedicated permission_set (module='__bundle__') linked 1:1 to a
// job_role via job_role_sets. Toggling a permission for a role inserts/removes rows
// in permission_set_items and persists explicit workspace overrides so inherited
// system permissions can be disabled without being re-enabled on the next refetch.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const BUNDLE_MODULE = "__bundle__";

async function resolveActiveWorkspace(supabase: SupabaseClient, userId: string): Promise<string> {
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

async function assertWorkspaceAdmin(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  if (error) throw new Error(`Falha ao verificar administrador do workspace: ${error.message}`);
  if (!data) {
    throw new Error("Você não tem permissão para alterar cargos e permissões deste workspace.");
  }
}

async function upsertRoleOverride(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  roleId: string,
  permissionKey: string,
  effect: "grant" | "deny",
): Promise<void> {
  const { error } = await supabase.from("job_role_permission_overrides").upsert(
    {
      workspace_id: workspaceId,
      role_id: roleId,
      permission_key: permissionKey,
      effect,
      created_by: userId,
    },
    { onConflict: "workspace_id,role_id,permission_key" },
  );
  if (error) throw new Error(error.message);
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
      await supabase.from("job_role_sets").upsert({ role_id: roleId, set_id: q.data.id as string });
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

// Aplica concessão/revogação em massa de chaves para um cargo, mantendo o
// bundle e os overrides explícitos do workspace sincronizados.
async function applyBulkKeys(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  roleId: string,
  keys: string[],
  granted: boolean,
): Promise<string | null> {
  if (keys.length === 0) return null;
  let setId: string | null = null;
  if (granted) {
    const grantedSetId = await ensureBundle(supabase, userId, roleId);
    setId = grantedSetId;
    const rows = keys.map((k) => ({ set_id: grantedSetId, permission_key: k }));
    const { error } = await supabase
      .from("permission_set_items")
      .upsert(rows, { onConflict: "set_id,permission_key" });
    if (error) throw new Error(error.message);
  } else {
    const existing = await supabase
      .from("job_role_sets")
      .select("set_id, permission_sets!inner(id, module, owner_id)")
      .eq("role_id", roleId);
    if (existing.error) throw new Error(existing.error.message);
    for (const row of (existing.data ?? []) as unknown as Array<{
      set_id: string;
      permission_sets: { module: string; owner_id: string | null };
    }>) {
      if (row.permission_sets?.module !== BUNDLE_MODULE) continue;
      if (row.permission_sets?.owner_id !== userId) continue;
      const { error } = await supabase
        .from("permission_set_items")
        .delete()
        .eq("set_id", row.set_id)
        .in("permission_key", keys);
      if (error) throw new Error(error.message);
    }
  }
  const effect: "grant" | "deny" = granted ? "grant" : "deny";
  const overrideRows = keys.map((permissionKey) => ({
    workspace_id: workspaceId,
    role_id: roleId,
    permission_key: permissionKey,
    effect,
    created_by: userId,
  }));
  const { error: overrideErr } = await supabase
    .from("job_role_permission_overrides")
    .upsert(overrideRows, { onConflict: "workspace_id,role_id,permission_key" });
  if (overrideErr) throw new Error(overrideErr.message);
  return setId;
}

// Chaves efetivas de um cargo: itens dos permission_sets vinculados +
// overrides explícitos do workspace (grant adiciona, deny remove).
async function effectiveRoleKeys(
  supabase: SupabaseClient,
  workspaceId: string,
  roleId: string,
): Promise<Set<string>> {
  const links = await supabase.from("job_role_sets").select("set_id").eq("role_id", roleId);
  if (links.error) throw new Error(links.error.message);
  const setIds = ((links.data ?? []) as Array<{ set_id: string }>).map((r) => r.set_id);
  const keys = new Set<string>();
  if (setIds.length > 0) {
    const items = await fetchAllPages<{ permission_key: string }>((from, to) =>
      supabase
        .from("permission_set_items")
        .select("permission_key")
        .in("set_id", setIds)
        .order("permission_key")
        .range(from, to),
    );
    for (const it of items) keys.add(it.permission_key);
  }
  const overrides = await fetchAllPages<{ permission_key: string; effect: string }>((from, to) =>
    supabase
      .from("job_role_permission_overrides")
      .select("permission_key, effect")
      .eq("workspace_id", workspaceId)
      .eq("role_id", roleId)
      .order("permission_key")
      .range(from, to),
  );
  for (const o of overrides) {
    if (o.effect === "grant") keys.add(o.permission_key);
    else keys.delete(o.permission_key);
  }
  return keys;
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
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(supabase, userId, workspaceId);
    let setId: string | null = null;
    if (data.granted) {
      setId = await ensureBundle(supabase, userId, data.role_id);
      const { error } = await supabase
        .from("permission_set_items")
        .upsert(
          { set_id: setId, permission_key: data.permission_key },
          { onConflict: "set_id,permission_key" },
        );
      if (error) throw new Error(error.message);
      await upsertRoleOverride(
        supabase,
        workspaceId,
        userId,
        data.role_id,
        data.permission_key,
        "grant",
      );
    } else {
      const existing = await supabase
        .from("job_role_sets")
        .select("set_id, permission_sets!inner(id, module, owner_id)")
        .eq("role_id", data.role_id);
      if (existing.error) throw new Error(existing.error.message);
      for (const row of (existing.data ?? []) as unknown as Array<{
        set_id: string;
        permission_sets: { module: string; owner_id: string | null };
      }>) {
        if (row.permission_sets?.module !== BUNDLE_MODULE) continue;
        if (row.permission_sets?.owner_id !== userId) continue;
        const { error } = await supabase
          .from("permission_set_items")
          .delete()
          .eq("set_id", row.set_id)
          .eq("permission_key", data.permission_key);
        if (error) throw new Error(error.message);
      }
      await upsertRoleOverride(
        supabase,
        workspaceId,
        userId,
        data.role_id,
        data.permission_key,
        "deny",
      );
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
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(supabase, userId, workspaceId);
    let setId: string | null = null;
    if (data.granted) {
      const grantedSetId = await ensureBundle(supabase, userId, data.role_id);
      setId = grantedSetId;
      const rows = data.keys.map((k) => ({ set_id: grantedSetId, permission_key: k }));
      const { error } = await supabase
        .from("permission_set_items")
        .upsert(rows, { onConflict: "set_id,permission_key" });
      if (error) throw new Error(error.message);
    } else {
      const existing = await supabase
        .from("job_role_sets")
        .select("set_id, permission_sets!inner(id, module, owner_id)")
        .eq("role_id", data.role_id);
      if (existing.error) throw new Error(existing.error.message);
      for (const row of (existing.data ?? []) as unknown as Array<{
        set_id: string;
        permission_sets: { module: string; owner_id: string | null };
      }>) {
        if (row.permission_sets?.module !== BUNDLE_MODULE) continue;
        if (row.permission_sets?.owner_id !== userId) continue;
        const { error } = await supabase
          .from("permission_set_items")
          .delete()
          .eq("set_id", row.set_id)
          .in("permission_key", data.keys);
        if (error) throw new Error(error.message);
      }
    }
    const effect: "grant" | "deny" = data.granted ? "grant" : "deny";
    const overrideRows = data.keys.map((permissionKey) => ({
      workspace_id: workspaceId,
      role_id: data.role_id,
      permission_key: permissionKey,
      effect,
      created_by: userId,
    }));
    const { error: overrideErr } = await supabase
      .from("job_role_permission_overrides")
      .upsert(overrideRows, { onConflict: "workspace_id,role_id,permission_key" });
    if (overrideErr) throw new Error(overrideErr.message);
    return { ok: true, set_id: setId, count: data.keys.length };
  });

const CopyRoleInput = z.object({
  source_role_id: z.string().uuid(),
  target_role_id: z.string().uuid(),
  mode: z.enum(["replace", "merge"]),
  module: z.string().min(1).optional(),
});

/**
 * Copia as permissões de um cargo de origem para um cargo destino editável.
 * - mode "merge": mantém o que o destino já tem e adiciona o da origem.
 * - mode "replace": espelha a origem, revogando o que não existe nela.
 * - module: quando informado, restringe a operação às chaves daquele módulo.
 */
export const copyRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CopyRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.source_role_id === data.target_role_id) {
      throw new Error("Escolha um cargo de origem diferente do destino.");
    }
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(supabase, userId, workspaceId);
    await assertRoleEditable(supabase, data.target_role_id);

    const src = await supabase
      .from("job_roles")
      .select("id")
      .eq("id", data.source_role_id)
      .maybeSingle();
    if (src.error) throw new Error(src.error.message);
    if (!src.data) throw new Error("Cargo de origem não encontrado.");

    let allowed: Set<string> | null = null;
    if (data.module) {
      const perms = await fetchAllPages<{ key: string }>((from, to) =>
        supabase
          .from("permissions")
          .select("key")
          .eq("module", data.module as string)
          .order("key")
          .range(from, to),
      );
      allowed = new Set(perms.map((p) => p.key));
      if (allowed.size === 0) throw new Error("Nenhuma permissão encontrada para este módulo.");
    }

    const [sourceKeys, targetKeys] = await Promise.all([
      effectiveRoleKeys(supabase, workspaceId, data.source_role_id),
      effectiveRoleKeys(supabase, workspaceId, data.target_role_id),
    ]);

    const inScope = (k: string) => (allowed ? allowed.has(k) : true);
    const source = Array.from(sourceKeys).filter(inScope);
    const target = Array.from(targetKeys).filter(inScope);

    const grant = source.filter((k) => !targetKeys.has(k));
    const revoke = data.mode === "replace" ? target.filter((k) => !sourceKeys.has(k)) : [];

    if (revoke.length) {
      await applyBulkKeys(supabase, userId, workspaceId, data.target_role_id, revoke, false);
    }
    if (grant.length) {
      await applyBulkKeys(supabase, userId, workspaceId, data.target_role_id, grant, true);
    }
    return { ok: true, granted: grant.length, revoked: revoke.length };
  });

const RestoreInput = z.object({ role_id: z.string().uuid() });

export const restoreRoleDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RestoreInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    await assertWorkspaceAdmin(supabase, userId, workspaceId);
    const role = await supabase
      .from("job_roles")
      .select("id, is_system")
      .eq("id", data.role_id)
      .maybeSingle();
    if (role.error) throw new Error(role.error.message);
    if (!role.data) throw new Error("Cargo não encontrado.");
    if (!(role.data as { is_system: boolean }).is_system) {
      throw new Error("Restauração disponível apenas para cargos padrão.");
    }
    const defaults = await supabase
      .from("job_role_default_permissions")
      .select("permission_key")
      .eq("role_id", data.role_id);
    if (defaults.error) throw new Error(defaults.error.message);
    const keys = ((defaults.data ?? []) as Array<{ permission_key: string }>).map(
      (r) => r.permission_key,
    );
    const setId = await ensureBundle(supabase, userId, data.role_id);
    const del = await supabase.from("permission_set_items").delete().eq("set_id", setId);
    if (del.error) throw new Error(del.error.message);
    if (keys.length > 0) {
      const rows = keys.map((k) => ({ set_id: setId, permission_key: k }));
      const { error } = await supabase
        .from("permission_set_items")
        .upsert(rows, { onConflict: "set_id,permission_key" });
      if (error) throw new Error(error.message);
    }
    const overrides = await supabase
      .from("job_role_permission_overrides")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("role_id", data.role_id);
    if (overrides.error) throw new Error(overrides.error.message);
    return { ok: true, count: keys.length };
  });

export type RoleBundleMap = Record<string, Set<string>>;

/**
 * Returns, for each non-system role, the set of permission_keys granted to it
 * via any linked permission_set (bundle or otherwise). Used to render the matrix.
 */
export const getMatrixState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);

    // Lido em lotes e cruzado no servidor: `permission_set_items` passa de
    // 8.000 linhas e embeds/consultas sem paginação eram truncados em 1.000,
    // deixando os toggles da matriz desmarcados.
    const [links, items] = await Promise.all([
      fetchAllPages<{ role_id: string; set_id: string }>((from, to) =>
        supabase.from("job_role_sets").select("role_id, set_id").order("role_id").range(from, to),
      ),
      fetchAllPages<{ set_id: string; permission_key: string }>((from, to) =>
        supabase
          .from("permission_set_items")
          .select("set_id, permission_key")
          .order("set_id")
          .order("permission_key")
          .range(from, to),
      ),
    ]);

    const keysBySet = new Map<string, string[]>();
    for (const it of items) {
      const arr = keysBySet.get(it.set_id) ?? [];
      arr.push(it.permission_key);
      keysBySet.set(it.set_id, arr);
    }

    const map: Record<string, string[]> = {};
    for (const row of links) {
      if (!map[row.role_id]) map[row.role_id] = [];
      map[row.role_id].push(...(keysBySet.get(row.set_id) ?? []));
    }
    // Deduplicate.
    const out: Record<string, string[]> = {};
    for (const [rid, arr] of Object.entries(map)) out[rid] = Array.from(new Set(arr));

    const overrideRows = await fetchAllPages<{
      role_id: string;
      permission_key: string;
      effect: string;
    }>((from, to) =>
      supabase
        .from("job_role_permission_overrides")
        .select("role_id, permission_key, effect")
        .eq("workspace_id", workspaceId)
        .order("role_id")
        .order("permission_key")
        .range(from, to),
    );
    for (const row of overrideRows) {
      const cur = new Set(out[row.role_id] ?? []);
      if (row.effect === "grant") cur.add(row.permission_key);
      else cur.delete(row.permission_key);
      out[row.role_id] = Array.from(cur);
    }
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
    const bundleIds = (
      (links.data ?? []) as Array<{
        set_id: string;
        permission_sets: { module: string; owner_id: string | null };
      }>
    )
      .filter(
        (r) =>
          r.permission_sets?.module === BUNDLE_MODULE && r.permission_sets?.owner_id === userId,
      )
      .map((r) => r.set_id);

    // Remove all role-set links.
    const unlink = await supabase.from("job_role_sets").delete().eq("role_id", data.role_id);
    if (unlink.error) throw new Error(unlink.error.message);

    // Delete orphan bundle permission_sets (items cascade via RLS-scoped delete).
    for (const setId of bundleIds) {
      await supabase.from("permission_set_items").delete().eq("set_id", setId);
      await supabase.from("permission_sets").delete().eq("id", setId);
    }

    await deleteByIdGuarded(
      supabase,
      "job_roles",
      data.role_id,
      "Você não tem permissão para excluir este cargo.",
    );
    return { ok: true };
  });
