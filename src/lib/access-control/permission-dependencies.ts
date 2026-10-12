// Dependências entre chaves: uma ação só faz sentido se a chave-base de leitura existir.
// Puro e client-safe: a mesma regra bloqueia a gravação no servidor e explica a tela.

const RP_VIEW = "techsales.role_profiles.view.workspace";

export const PERMISSION_DEPENDENCIES: Readonly<Record<string, string>> = {
  "techsales.role_profiles.create.workspace": RP_VIEW,
  "techsales.role_profiles.update.workspace": RP_VIEW,
  "techsales.role_profiles.approve.workspace": RP_VIEW,
  "techsales.role_profiles.manage.workspace": RP_VIEW,
  "techsales.role_profiles_commercial.view.workspace": RP_VIEW,
  "techsales.role_profiles_share.manage.workspace": RP_VIEW,
  "techsales.role_profiles_early.approve.workspace": RP_VIEW,
};

export type MissingDependency = { key: string; requires: string };

/** Chaves presentes cuja chave-base não está presente. */
export function missingDependencies(keys: Iterable<string>): MissingDependency[] {
  const set = new Set(keys);
  const out: MissingDependency[] = [];
  for (const k of set) {
    const req = PERMISSION_DEPENDENCIES[k];
    if (req && !set.has(req)) out.push({ key: k, requires: req });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Valida uma alteração em lote de um cargo: devolve as dependências que ficariam
 * quebradas *por causa* da alteração (inconsistências antigas não bloqueiam).
 */
export function dependencyViolations(
  current: Iterable<string>,
  keys: string[],
  granted: boolean,
): MissingDependency[] {
  const before = new Set(missingDependencies(current).map((m) => m.key));
  const next = new Set(current);
  for (const k of keys) {
    if (granted) next.add(k);
    else next.delete(k);
  }
  return missingDependencies(next).filter((m) => !before.has(m.key));
}
