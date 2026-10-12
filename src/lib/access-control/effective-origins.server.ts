// Carrega, com o cliente do próprio admin (RLS), a explicação da permissão efetiva de um membro.
// A lista efetiva vem da função do banco (fonte da verdade); as origens explicam cada chave.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all";
import {
  computeEffectiveOrigins,
  effectiveDependencyGaps,
  governanceWarnings,
  type KeyOrigin,
  type OriginInput,
} from "./effective-origins";

export type EffectiveOriginsResult = {
  user_id: string;
  is_active: boolean;
  is_admin_bypass: boolean;
  roles: { id: string; name: string }[];
  extra_sets: { id: string; name: string }[];
  origins: (KeyOrigin & { db_effective: boolean })[];
  warnings: { kind: string; message: string }[];
  dependency_gaps: { key: string; requires: string }[];
  mismatches: number;
};

async function setKeys(
  sb: SupabaseClient,
  setIds: string[],
  ws: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!setIds.length) return out;
  const { data: sets } = await sb
    .from("permission_sets")
    .select("id, workspace_id, module")
    .in("id", setIds);
  // Mesma regra do banco: global só vale se não for __bundle__; local só do próprio workspace.
  const valid = ((sets ?? []) as { id: string; workspace_id: string | null; module: string | null }[])
    .filter((s) => (s.workspace_id === null ? s.module !== "__bundle__" : s.workspace_id === ws))
    .map((s) => s.id);
  if (!valid.length) return out;
  const items = await fetchAllPages<{ set_id: string; permission_key: string }>((from, to) =>
    sb
      .from("permission_set_items")
      .select("set_id, permission_key")
      .in("set_id", valid)
      .order("set_id")
      .order("permission_key")
      .range(from, to),
  );
  for (const it of items) {
    const arr = out.get(it.set_id) ?? [];
    arr.push(it.permission_key);
    out.set(it.set_id, arr);
  }
  return out;
}

export async function loadEffectiveOrigins(
  sb: SupabaseClient,
  ws: string,
  targetUserId: string,
): Promise<EffectiveOriginsResult> {
  // Escopo idêntico a user_effective_permissions: workspace_id ou owner_id = workspace (nunca o criador).
  const ownerFilter = `workspace_id.eq.${ws},owner_id.eq.${ws}`;
  const [member, wsRow, ujr, ups, dbKeys] = await Promise.all([
    sb
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", ws)
      .eq("user_id", targetUserId)
      .maybeSingle(),
    sb.from("workspaces").select("created_by").eq("id", ws).maybeSingle(),
    sb
      .from("user_job_roles")
      .select("role_id, job_roles(id, name, workspace_id)")
      .eq("user_id", targetUserId)
      .or(ownerFilter),
    sb
      .from("user_permission_sets")
      .select("set_id, permission_sets(id, name)")
      .eq("user_id", targetUserId)
      .or(ownerFilter),
    // Array único (sem o corte de 1.000 linhas da API); a função exige admin do workspace.
    sb
      .rpc("effective_permissions_array", { _user_id: targetUserId, _workspace_id: ws })
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return ((r.data ?? []) as unknown as string[]).map(String);
      }),
  ]);
  const m = member.data as { role: string; status: string } | null;
  const isActive = m?.status === "active";
  const isAdminBypass =
    (m?.role === "admin" ||
      m?.role === "owner" ||
      (wsRow.data as { created_by?: string } | null)?.created_by === targetUserId) &&
    isActive;

  const roles = (
    (ujr.data ?? []) as unknown as {
      role_id: string;
      job_roles: { id: string; name: string; workspace_id: string | null } | null;
    }[]
  )
    // Cargo local de outro workspace não vale aqui (filtro da 0126).
    .filter((r) => !r.job_roles?.workspace_id || r.job_roles.workspace_id === ws)
    .map((r) => ({ id: r.role_id, name: r.job_roles?.name ?? "Cargo" }));
  const roleIds = roles.map((r) => r.id);
  const [links, overrides] = await Promise.all([
    roleIds.length
      ? sb.from("job_role_sets").select("role_id, set_id").in("role_id", roleIds)
      : Promise.resolve({ data: [] }),
    roleIds.length
      ? sb
          .from("job_role_permission_overrides")
          .select("role_id, permission_key, effect")
          .eq("workspace_id", ws)
          .in("role_id", roleIds)
      : Promise.resolve({ data: [] }),
  ]);
  // Mesma regra do banco: no workspace, o vínculo a um conjunto amplo pode valer como pacote local.
  const reps = roleIds.length
    ? await sb
        .from("job_role_set_replacements")
        .select("role_id, set_id, replacement_set_id")
        .eq("workspace_id", ws)
        .in("role_id", roleIds)
    : { data: [] };
  const repMap = new Map(
    ((reps.data ?? []) as { role_id: string; set_id: string; replacement_set_id: string }[]).map(
      (r) => [`${r.role_id}:${r.set_id}`, r.replacement_set_id],
    ),
  );
  // Substituto precisa ser pacote local deste workspace; senão o vínculo não concede nada (falha fechada).
  const repIds = [...new Set(repMap.values())];
  const repLocal = new Set<string>();
  if (repIds.length) {
    const { data: rs } = await sb.from("permission_sets").select("id, workspace_id").in("id", repIds);
    for (const r of (rs ?? []) as { id: string; workspace_id: string | null }[])
      if (r.workspace_id === ws) repLocal.add(r.id);
  }
  const linkRows = ((links.data ?? []) as { role_id: string; set_id: string }[]).flatMap((l) => {
    const rep = repMap.get(`${l.role_id}:${l.set_id}`);
    if (rep === undefined) return [{ role_id: l.role_id, set_id: l.set_id }];
    return repLocal.has(rep) ? [{ role_id: l.role_id, set_id: rep }] : [];
  });
  const extra = (
    (ups.data ?? []) as unknown as {
      set_id: string;
      permission_sets: { id: string; name: string } | null;
    }[]
  ).map((s) => ({ id: s.set_id, name: s.permission_sets?.name ?? "Conjunto" }));
  const keysBySet = await setKeys(
    sb,
    [...new Set([...linkRows.map((l) => l.set_id), ...extra.map((e) => e.id)])],
    ws,
  );
  const ovr = (overrides.data ?? []) as {
    role_id: string;
    permission_key: string;
    effect: string;
  }[];

  const input: OriginInput = {
    isActive,
    isAdminBypass,
    roles: roles.map((r) => ({
      ...r,
      setKeys: linkRows
        .filter((l) => l.role_id === r.id)
        .flatMap((l) => keysBySet.get(l.set_id) ?? []),
      grants: ovr
        .filter((o) => o.role_id === r.id && o.effect === "grant")
        .map((o) => o.permission_key),
      denies: ovr
        .filter((o) => o.role_id === r.id && o.effect === "deny")
        .map((o) => o.permission_key),
    })),
    extraSets: extra.map((e) => ({ ...e, keys: keysBySet.get(e.id) ?? [] })),
  };

  const db = new Set(dbKeys.map(String));
  let origins = computeEffectiveOrigins(input);
  // Chave efetiva no banco sem origem calculada: só é "admin" se a pessoa tem o bypass.
  const known = new Set(origins.map((o) => o.key));
  for (const k of db) {
    if (!known.has(k))
      origins.push({
        key: k,
        effective: true,
        sources: [isAdminBypass ? "Acesso de administrador" : "Origem não identificada"],
        deniedBy: [],
      });
  }
  origins = origins.map((o) =>
    isAdminBypass && o.effective && !o.sources.includes("Acesso de administrador")
      ? { ...o, sources: [...o.sources, "Acesso de administrador"] }
      : o,
  );
  const withDb = origins
    .map((o) => ({ ...o, db_effective: db.has(o.key) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return {
    user_id: targetUserId,
    is_active: isActive,
    is_admin_bypass: isAdminBypass,
    roles,
    extra_sets: extra,
    origins: withDb,
    warnings: governanceWarnings(input),
    dependency_gaps: effectiveDependencyGaps(origins),
    mismatches: withDb.filter((o) => o.effective !== o.db_effective).length,
  };
}
