// Home host-aware: cada subdomínio aterrissa no produto certo.
//   app.wktechnology.com.br  → /workspace (Workspace Hub)
//   ats.wktechnology.com.br  → /jobs       (TechHire)
//   crm.wktechnology.com.br  → /dashboard  (TechSales)
//   preview / localhost      → /dashboard  (sem regressão)
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getHostKind } from "@/lib/hosts";
import { MODULES } from "@/lib/modules/registry";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") {
      throw redirect({ to: "/dashboard" });
    }
    const kind = getHostKind(window.location.hostname);
    if (kind === "workspace") throw redirect({ to: "/workspace" });
    if (kind === "ats") throw redirect({ to: MODULES.ats.defaultRoute });
    if (kind === "crm") throw redirect({ to: MODULES.crm.defaultRoute });
    throw redirect({ to: "/dashboard" });
  },
});
