// Cálculo puro das chaves que "Restaurar padrões" grava no pacote do cargo.
// Remove chaves retiradas pela baseline do workspace e as que cada substituição
// local de conjunto (job_role_set_replacements) excluiu do conjunto original.

export interface SetReplacementItems {
  original: string[];
  local: string[];
}

export function keysRemovedByReplacements(reps: SetReplacementItems[]): Set<string> {
  const out = new Set<string>();
  for (const rep of reps) {
    const kept = new Set(rep.local);
    for (const k of rep.original) if (!kept.has(k)) out.add(k);
  }
  return out;
}

export function computeRestoreKeys(
  defaults: string[],
  baselineRemoved: Set<string>,
  reps: SetReplacementItems[],
): string[] {
  const replacedOut = keysRemovedByReplacements(reps);
  return defaults.filter((k) => !baselineRemoved.has(k) && !replacedOut.has(k));
}
