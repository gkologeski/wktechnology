// Explica a permissão EFETIVA de uma pessoa e de onde ela vem. Espelha a regra do banco
// (`user_effective_permissions`): membro ativo; bypass de admin/criador OU pacotes dos cargos
// OU conjuntos extras OU grants do workspace; qualquer deny de um cargo prevalece.
// Puro: a verdade continua sendo o banco; aqui só se monta a explicação.
import { missingDependencies, type MissingDependency } from "./permission-dependencies";

export type RoleOriginInput = {
  id: string;
  name: string;
  setKeys: string[];
  grants: string[];
  denies: string[];
};

export type OriginInput = {
  isActive: boolean;
  isAdminBypass: boolean;
  roles: RoleOriginInput[];
  extraSets: { id: string; name: string; keys: string[] }[];
};

export type KeyOrigin = {
  key: string;
  effective: boolean;
  sources: string[];
  deniedBy: string[];
};

const WRITE_ACTIONS = new Set(["create", "update", "delete", "manage", "approve", "assign"]);

function actionOf(key: string): string {
  const parts = key.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

export function computeEffectiveOrigins(input: OriginInput): KeyOrigin[] {
  const map = new Map<string, KeyOrigin>();
  const at = (k: string) => {
    let o = map.get(k);
    if (!o) map.set(k, (o = { key: k, effective: false, sources: [], deniedBy: [] }));
    return o;
  };
  for (const r of input.roles) {
    for (const k of r.setKeys) at(k).sources.push(`Cargo: ${r.name}`);
    for (const k of r.grants) at(k).sources.push(`Concessão no cargo: ${r.name}`);
    for (const k of r.denies) at(k).deniedBy.push(r.name);
  }
  for (const s of input.extraSets)
    for (const k of s.keys) at(k).sources.push(`Conjunto extra: ${s.name}`);
  for (const o of map.values()) {
    o.sources = Array.from(new Set(o.sources));
    o.effective =
      input.isActive && o.deniedBy.length === 0 && (o.sources.length > 0 || input.isAdminBypass);
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** Cargo cujas chaves efetivas são só leitura/exportação. */
export function isReadOnlyRole(r: RoleOriginInput): boolean {
  const denied = new Set(r.denies);
  const keys = [...r.setKeys, ...r.grants].filter((k) => !denied.has(k));
  return keys.length > 0 && keys.every((k) => !WRITE_ACTIONS.has(actionOf(k)));
}

export type GovernanceWarning = {
  kind: "admin_readonly_role" | "inactive" | "multi_role";
  message: string;
};

export function governanceWarnings(input: OriginInput): GovernanceWarning[] {
  const out: GovernanceWarning[] = [];
  if (!input.isActive)
    out.push({
      kind: "inactive",
      message: "Membro inativo: nenhuma permissão vale enquanto estiver inativo.",
    });
  const ro = input.roles.filter(isReadOnlyRole);
  if (input.isAdminBypass && ro.length)
    out.push({
      kind: "admin_readonly_role",
      message: `Administrador com cargo somente leitura (${ro.map((r) => r.name).join(", ")}): o acesso de administrador continua valendo. Rebaixar a pessoa é decisão nominal da governança.`,
    });
  if (input.roles.length > 1)
    out.push({
      kind: "multi_role",
      message: `Acumula ${input.roles.length} cargos (${input.roles.map((r) => r.name).join(" + ")}): as permissões somam e qualquer proibição de um deles prevalece.`,
    });
  return out;
}

export function effectiveDependencyGaps(origins: KeyOrigin[]): MissingDependency[] {
  return missingDependencies(origins.filter((o) => o.effective).map((o) => o.key));
}
