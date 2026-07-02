// Raiz autenticada — redireciona para /home no host neutro (workspace) e
// para o defaultRoute do módulo quando em host de módulo.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { detectModuleFromHost } from "@/lib/modules/active-module";
import { MODULES } from "@/lib/modules/registry";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : null;
    const mod = detectModuleFromHost(hostname);
    if (mod) {
      throw redirect({ to: MODULES[mod].defaultRoute });
    }
    throw redirect({ to: "/home" });
  },
});
