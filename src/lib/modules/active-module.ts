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

// Paths que pertencem exclusivamente ao módulo ATS (fallback usado em
// preview/local quando o subdomínio `ats.*` não está disponível).
const ATS_PATH_PREFIXES = ["/jobs", "/candidates", "/ats"];

export function detectModuleFromPath(pathname: string): ModuleId | null {
  for (const p of ATS_PATH_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/")) return "ats";
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
    return (
      detectModuleFromHost(hostname) ??
      detectModuleFromPath(path) ??
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
