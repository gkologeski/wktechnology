// Mapa ModuleId (front) ↔ prefixo de módulo no catálogo de permissões.
// Client-safe: sem imports server-only.
import type { ModuleId } from "./registry";

export const MODULE_PERMISSION_PREFIX: Record<ModuleId, string> = {
  crm: "techsales",
  ats: "techhire",
  contracts: "techcontracts",
  services: "techcontracts",
  projects: "techprojects",
  finance: "techfinance",
  people: "techpeople",
};

/** Módulos cujo acesso é derivado de ao menos uma permissão do módulo. */
export function deriveAllowedModules(permissionKeys: Iterable<string>): ModuleId[] {
  const prefixes = new Set<string>();
  for (const key of permissionKeys) {
    const dot = key.indexOf(".");
    if (dot > 0) prefixes.add(key.slice(0, dot));
  }
  return (Object.keys(MODULE_PERMISSION_PREFIX) as ModuleId[]).filter((id) =>
    prefixes.has(MODULE_PERMISSION_PREFIX[id]),
  );
}
