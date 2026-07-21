// Single-host mode: a aplicação roda em um único domínio (canonical
// `app.wktechnology.com.br`). As funções deste módulo eram usadas para
// construir URLs cross-host em uma arquitetura antiga multi-subdomínio.
// Foram mantidas com a MESMA assinatura para não quebrar call sites, mas
// agora sempre devolvem paths relativos (SPA) — não há mais redirect
// cross-host, não há mais `HostRouterGuard`.
//
// Se em algum momento voltar a existir separação por subdomínio, este
// arquivo é o único ponto de mudança.

import type { ModuleId } from "./modules/registry";

export const CANONICAL_HOST = "app.wktechnology.com.br";
export const WORKSPACE_HOST = CANONICAL_HOST;

// Mantido apenas para retro-compat de imports. Todos apontam para o host único.
export const MODULE_HOSTS: Record<ModuleId, string> = {
  ats: CANONICAL_HOST,
  crm: CANONICAL_HOST,
  contracts: CANONICAL_HOST,
  services: CANONICAL_HOST,
  projects: CANONICAL_HOST,
  finance: CANONICAL_HOST,
  people: CANONICAL_HOST,
};

export type HostKind = "workspace" | ModuleId | "preview";

export function isProductionHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return h === CANONICAL_HOST || h.endsWith(".wktechnology.com.br");
}

export function getReachableHosts(): Set<string> {
  return new Set([CANONICAL_HOST]);
}

export function isReachableHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return hostname.toLowerCase() === CANONICAL_HOST;
}

// Sempre "workspace" no modelo single-host — nenhum host discrimina módulo.
export function getHostKind(_hostname: string | undefined | null): HostKind {
  return "workspace";
}

export function getCurrentHostKind(): HostKind {
  return "workspace";
}

/** Path relativo — não há mais navegação cross-host. */
export function buildModuleUrl(_moduleId: ModuleId, path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Path relativo — não há mais navegação cross-host. */
export function buildWorkspaceUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Sempre false no modelo single-host: `buildModuleUrl`/`buildWorkspaceUrl`
 *  devolvem path relativo. Mantido para retro-compat. */
export function isCrossHostUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
