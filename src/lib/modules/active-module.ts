// Detecta o módulo ativo a partir do host e/ou da rota atual.
//
// Estratégia:
// 1) Em produção, cada módulo do ERP é servido em um subdomínio próprio
//    (ex.: ats.wktechnology.com.br). O hostname é a fonte de verdade.
// 2) Em preview/local (sandbox Lovable, localhost, etc.) o subdomínio não
//    existe; aí caímos no fallback por path: rotas que começam com `/ats`
//    são consideradas do módulo ATS.
// 3) O default é o módulo CRM (TechSales) — preserva o comportamento atual.

import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { MODULES, type ModuleId } from "./registry";
import { ATS_ROUTE_PREFIXES } from "@/lib/menu-config-ats";

const HOST_MATCHERS: Array<{ id: ModuleId; pattern: RegExp }> = [
  { id: "ats", pattern: /^ats\./i },
  { id: "crm", pattern: /^crm\./i },
];

export function detectModuleFromHost(hostname: string | undefined | null): ModuleId | null {
  if (!hostname) return null;
  for (const m of HOST_MATCHERS) {
    if (m.pattern.test(hostname)) return m.id;
  }
  return null;
}

// Paths que pertencem exclusivamente ao módulo ATS. Derivado de
// `ATS_ROUTE_PREFIXES` em `menu-config-ats.ts` — fonte única de verdade.
// Inclui fallback estático para o caso de import circular em SSR.
const MODULE_PATH_MATCHERS: Array<{ id: ModuleId; prefixes: string[] }> = [
  { id: "contracts", prefixes: ["/contracts"] },
  { id: "services", prefixes: ["/services"] },
  { id: "projects", prefixes: ["/projects"] },
  { id: "finance", prefixes: ["/finance"] },
];

export function detectModuleFromPath(pathname: string): ModuleId | null {
  for (const p of ATS_ROUTE_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/")) return "ats";
  }
  for (const { id, prefixes } of MODULE_PATH_MATCHERS) {
    for (const p of prefixes) {
      if (pathname === p || pathname.startsWith(p + "/")) return id;
    }
  }
  return null;
}


/**
 * Hook React: retorna o módulo ativo levando em conta host primeiro,
 * depois caminho. Default = `crm`.
 */
export function useActiveModule(): ModuleId {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return useMemo(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : null;
    // Path-first quando indica claramente outro módulo (ex.: /jobs em crm.*),
    // senão cai no host, senão default.
    return (
      detectModuleFromPath(path) ??
      detectModuleFromHost(hostname) ??
      "crm"
    );
  }, [path]);
}

/**
 * Retorna a definição completa do módulo ativo (cor, nome, rota inicial, etc.).
 */
export function useActiveModuleDefinition() {
  const id = useActiveModule();
  return MODULES[id];
}
