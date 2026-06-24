import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Briefcase, Users, LayoutGrid } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ats")({
  component: AtsLayout,
});

const NAV = [
  { to: "/ats/jobs", label: "Vagas", icon: Briefcase },
  { to: "/ats/candidates", label: "Candidatos", icon: Users },
] as const;

function AtsLayout() {
  const loc = useLocation();
  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" /> ATS — Recrutamento & Seleção
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie vagas, candidatos e o funil de seleção. Integrado ao CRM via eventos.
          </p>
        </div>
      </header>
      <nav className="flex gap-1 border-b -mt-2">
        {NAV.map((n) => {
          const active =
            loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
