// Host-aware URL helpers para a arquitetura multi-host:
//   app.wktechnology.com.br  → Workspace Hub (config geral)
//   ats.wktechnology.com.br  → módulo ATS (TechHire)
//   crm.wktechnology.com.br  → módulo CRM (TechSales)
//
// Em preview Lovable / localhost tudo roda no mesmo host: as funções degradam
// para path relativo (SPA) e o "guard" de host fica inerte.

import type { ModuleId } from "./modules/registry";

export const WORKSPACE_HOST = "app.wktechnology.com.br";

export const MODULE_HOSTS: Record<ModuleId, string> = {
  ats: "ats.wktechnology.com.br",
  crm: "crm.wktechnology.com.br",
  // Módulos sem subdomínio próprio ainda — reutilizam o host do CRM.
  contracts: "crm.wktechnology.com.br",
  services: "crm.wktechnology.com.br",
  projects: "crm.wktechnology.com.br",
  finance: "crm.wktechnology.com.br",
};

export type HostKind = "workspace" | ModuleId | "preview";

const PRODUCTION_HOSTS = new Set<string>([
  WORKSPACE_HOST,
  ...Object.values(MODULE_HOSTS),
]);

export function isProductionHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

/**
 * Hosts considerados "alcançáveis" — i.e., realmente servidos por este
 * projeto em produção. Permite desligar redirects cross-host quando um
 * subdomínio ainda não está configurado (SSL/DNS), evitando loops.
 *
 * Default conservador: sem `VITE_REACHABLE_HOSTS`, apenas o host atual é
 * considerado alcançável — assim cross-host redirect só ocorre após
 * opt-in explícito (ex.: VITE_REACHABLE_HOSTS="app.x,crm.x,ats.x").
 */
export function getReachableHosts(): Set<string> {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_REACHABLE_HOSTS;
  if (raw) {
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  if (typeof window !== "undefined") {
    return new Set([window.location.hostname.toLowerCase()]);
  }
  return new Set();
}

export function isReachableHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return getReachableHosts().has(hostname.toLowerCase());
}

export function getHostKind(hostname: string | undefined | null): HostKind {
  if (!hostname) return "preview";
  const h = hostname.toLowerCase();
  if (h === WORKSPACE_HOST) return "workspace";
  for (const [id, host] of Object.entries(MODULE_HOSTS) as Array<[ModuleId, string]>) {
    if (h === host) return id;
  }
  return "preview";
}

export function getCurrentHostKind(): HostKind {
  if (typeof window === "undefined") return "preview";
  return getHostKind(window.location.hostname);
}

/** URL para uma rota de módulo. Em produção, devolve URL absoluta no host
 *  do módulo. Em preview/localhost, devolve o próprio path (SPA). */
export function buildModuleUrl(moduleId: ModuleId, path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return safePath;
  if (!isProductionHost(window.location.hostname)) return safePath;
  return `https://${MODULE_HOSTS[moduleId]}${safePath}`;
}

/** URL para uma rota do Workspace Hub. Sempre alvo: `app.`. */
export function buildWorkspaceUrl(path: string): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return safePath;
  if (!isProductionHost(window.location.hostname)) return safePath;
  return `https://${WORKSPACE_HOST}${safePath}`;
}

/** True quando o link deve ser cross-host (target externo). */
export function isCrossHostUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
