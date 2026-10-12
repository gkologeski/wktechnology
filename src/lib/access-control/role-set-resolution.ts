// Espelho puro da regra do banco (user_effective_permissions, 0127) para os
// vínculos cargo → pacote: substituição local por workspace + escopo do pacote.
// Usado pelas telas para não divergirem do que o banco realmente concede.

export type RoleSetLink = { role_id: string; set_id: string };
export type SetReplacement = { role_id: string; set_id: string; replacement_set_id: string };
export type SetScopeMeta = { id: string; workspace_id: string | null; module: string };

/** Pacote vale no workspace? Local do próprio WS, ou global que não seja `__bundle__`. */
export function setUsableInWorkspace(meta: SetScopeMeta | undefined, workspaceId: string): boolean {
  if (!meta) return false;
  if (meta.workspace_id === workspaceId) return true;
  return meta.workspace_id === null && meta.module !== "__bundle__";
}

/**
 * Retorna, por cargo, os pacotes efetivos no workspace. Substituto precisa ser
 * pacote local do mesmo workspace; caso contrário o vínculo não concede nada.
 */
export function resolveRoleSets(
  links: RoleSetLink[],
  replacements: SetReplacement[],
  sets: Map<string, SetScopeMeta>,
  workspaceId: string,
): Map<string, string[]> {
  const rep = new Map(replacements.map((r) => [`${r.role_id}:${r.set_id}`, r.replacement_set_id]));
  const out = new Map<string, string[]>();
  for (const l of links) {
    const replaced = rep.get(`${l.role_id}:${l.set_id}`);
    const target = replaced ?? l.set_id;
    const meta = sets.get(target);
    if (replaced !== undefined && meta?.workspace_id !== workspaceId) continue;
    if (!setUsableInWorkspace(meta, workspaceId)) continue;
    const arr = out.get(l.role_id) ?? [];
    if (!arr.includes(target)) arr.push(target);
    out.set(l.role_id, arr);
  }
  return out;
}
