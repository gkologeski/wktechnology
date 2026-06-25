// Em produção, garante que cada path seja servido pelo subdomínio correto:
//   - paths de módulo (CRM/ATS) → host do módulo
//   - paths neutros (workspace, settings, account, auth) → host do workspace (app.*)
// Em preview/local, é inerte (mesmo host serve tudo).
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  WORKSPACE_HOST,
  MODULE_HOSTS,
  isProductionHost,
  getHostKind,
} from "@/lib/hosts";
import { detectModuleFromPath } from "@/lib/modules/active-module";

const WORKSPACE_PATH_PREFIXES = [
  "/workspace",
  "/settings",
  "/account",
  "/admin",
];

function isWorkspacePath(path: string): boolean {
  return WORKSPACE_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
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

    if (workspacePath && currentHost !== "workspace") {
      targetHost = WORKSPACE_HOST;
    } else if (moduleFromPath && currentHost !== moduleFromPath) {
      targetHost = MODULE_HOSTS[moduleFromPath];
    }

    if (targetHost && targetHost !== hostname) {
      const url = `https://${targetHost}${path}${window.location.search}${window.location.hash}`;
      window.location.replace(url);
    }
  }, [path]);

  return null;
}
