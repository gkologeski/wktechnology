// Em produção, garante que cada path seja servido pelo subdomínio correto:
//   - paths de módulo (CRM/ATS) → host do módulo
//   - paths neutros (workspace, settings, account, auth) → host do workspace (app.*)
// Em preview/local, é inerte (mesmo host serve tudo).
//
// Proteção contra loop: se detectarmos ≥2 redirects em <5s, abortamos o próximo
// e mostramos um toast informativo. Logs detalhados ficam atrás da flag
// `localStorage.setItem("techhire:debug-host","1")`.
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  WORKSPACE_HOST,
  MODULE_HOSTS,
  isProductionHost,
  isReachableHost,
  getHostKind,
} from "@/lib/hosts";
import { detectModuleFromPath } from "@/lib/modules/active-module";

const WORKSPACE_PATH_PREFIXES = [
  "/workspace",
  "/settings",
  "/account",
  "/admin",
  "/home",
  "/marketplace",
  "/invoices",
];

const LOOP_KEY = "techhire:host-redirects";
const LOOP_WINDOW_MS = 5000;
const LOOP_MAX = 2;
const LOOP_COOLDOWN_MS = 10000;

function isWorkspacePath(path: string): boolean {
  return WORKSPACE_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}

function debugEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("techhire:debug-host") === "1";
  } catch {
    return false;
  }
}

type LoopEntry = { ts: number; from: string; to: string };

function readLoopHistory(): LoopEntry[] {
  try {
    const raw = sessionStorage.getItem(LOOP_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LoopEntry[];
    const now = Date.now();
    return arr.filter((e) => now - e.ts < LOOP_COOLDOWN_MS);
  } catch {
    return [];
  }
}

function writeLoopHistory(entries: LoopEntry[]) {
  try {
    sessionStorage.setItem(LOOP_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function HostRouterGuard() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname.toLowerCase();
    if (!isProductionHost(hostname)) return; // preview / localhost → noop

    const currentHost = getHostKind(hostname);
    const moduleFromPath = detectModuleFromPath(path);
    const workspacePath = isWorkspacePath(path);

    let targetHost: string | null = null;
    let reason = "";

    if (workspacePath && currentHost !== "workspace") {
      targetHost = WORKSPACE_HOST;
      reason = "workspace-path";
    } else if (moduleFromPath && currentHost !== moduleFromPath) {
      targetHost = MODULE_HOSTS[moduleFromPath];
      reason = `module:${moduleFromPath}`;
    }

    if (!targetHost || targetHost === hostname) return;

    // Não redireciona pra host não alcançável (ex.: subdomínio sem SSL/DNS
    // pronto). Evita causa raiz óbvia de loop.
    if (!isReachableHost(targetHost)) {
      if (debugEnabled()) {
        console.warn("[host-guard] skip — target host not reachable", {
          from: hostname,
          to: targetHost,
          path,
          reason,
        });
      }
      return;
    }

    // Proteção contra loop: conta redirects recentes.
    const history = readLoopHistory();
    const recent = history.filter((e) => Date.now() - e.ts < LOOP_WINDOW_MS);
    if (recent.length >= LOOP_MAX) {
      console.warn("[host-guard] redirect loop suprimido", {
        from: hostname,
        to: targetHost,
        path,
        reason,
        recent,
      });
      toast.warning("Loop de domínio detectado", {
        description: `Mantendo neste host (${hostname}). Verifique se ${targetHost} está configurado.`,
        duration: 8000,
      });
      // Limpa pra permitir uma nova tentativa após o cooldown.
      writeLoopHistory([]);
      return;
    }

    writeLoopHistory([
      ...history,
      { ts: Date.now(), from: hostname, to: targetHost },
    ]);

    if (debugEnabled()) {
      console.info("[host-guard] redirecting", {
        from: hostname,
        to: targetHost,
        path,
        reason,
      });
    }

    const url = `https://${targetHost}${path}${window.location.search}${window.location.hash}`;
    window.location.replace(url);
  }, [path]);

  return null;
}
