// Detecta o módulo ativo do ERP.
//
// Ordem de resolução (do maior para o menor peso):
// 1. Host de produção com subdomínio explícito do módulo (ex.: `ats.…`).
//    Em produção, cada módulo pode ser servido em seu próprio subdomínio;
//    o hostname é fonte de verdade e vence sempre.
// 2. `localStorage.activeModule` — preferência persistida do usuário.
//    Alterada explicitamente pelo `ModuleSwitcher` e pelo grid da /home.
//    Isso mantém o sidebar do módulo escolhido mesmo quando o usuário
//    abre uma tela pertencente a outro módulo (mostra banner cross-module).
// 3. `detectModuleFromPath(pathname)` — fallback quando não há preferência.
// 4. Default `crm`.

import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

// Paths que pertencem exclusivamente a cada módulo.
const MODULE_PATH_MATCHERS: Array<{ id: ModuleId; prefixes: string[] }> = [
  // /services é uma visão operacional/faturamento consumida por Contratos.
  // Mantemos as rotas, mas o path é tratado como parte do módulo Contratos
  // para que o sidebar e o breadcrumb reflitam essa hierarquia.
  { id: "contracts", prefixes: ["/contracts", "/services"] },
  { id: "projects", prefixes: ["/projects"] },
  { id: "finance", prefixes: ["/finance"] },
  { id: "people", prefixes: ["/people"] },
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

// ────────────────────────────────────────────────────────────────────────
// Preferência persistida em localStorage
// ────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "erp.activeModule";
const VALID_IDS: readonly ModuleId[] = [
  "crm",
  "ats",
  "contracts",
  "services",
  "projects",
  "finance",
  "people",
];

function isValidModuleId(v: unknown): v is ModuleId {
  return typeof v === "string" && (VALID_IDS as readonly string[]).includes(v);
}

export function getStoredActiveModule(): ModuleId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isValidModuleId(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Persiste a preferência de módulo ativo e dispara `storage` para outras abas.
 * Também dispara um CustomEvent local (`erp:active-module-changed`) para
 * componentes na mesma aba reagirem sem depender de re-render de rota.
 */
export function setStoredActiveModule(id: ModuleId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent("erp:active-module-changed", { detail: id }));
  } catch {
    /* ignore */
  }
}

function useStoredActiveModule(): ModuleId | null {
  const [value, setValue] = useState<ModuleId | null>(() => getStoredActiveModule());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setValue(isValidModuleId(e.newValue) ? e.newValue : null);
    };
    const onLocal = () => setValue(getStoredActiveModule());
    window.addEventListener("storage", onStorage);
    window.addEventListener("erp:active-module-changed", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("erp:active-module-changed", onLocal);
    };
  }, []);
  return value;
}

/**
 * Hook React: retorna o módulo ativo aplicando a ordem descrita no topo do arquivo.
 */
export function useActiveModule(): ModuleId {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const stored = useStoredActiveModule();
  return useMemo(() => {
    // Single-host: host não discrimina mais o módulo.
    // Ordem: path do módulo > preferência salva > default crm.
    const pathModule = detectModuleFromPath(path);
    if (pathModule) return pathModule;
    if (stored) return stored;
    return "crm";
  }, [path, stored]);
}

/**
 * Hook auxiliar: retorna o módulo detectado pelo path atual (ou null se o
 * path é neutro / workspace). Usado por `AppSidebar` para exibir banner
 * "você está numa tela de outro módulo".
 */
export function usePathModule(): ModuleId | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return useMemo(() => detectModuleFromPath(path), [path]);
}

/**
 * Retorna a definição completa do módulo ativo (cor, nome, rota inicial, etc.).
 */
export function useActiveModuleDefinition() {
  const id = useActiveModule();
  return MODULES[id];
}
