import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings", label: "Perfil" },
  { to: "/settings/email", label: "Conexão de Email" },
  { to: "/settings/security", label: "Segurança" },
  { to: "/settings/pipelines", label: "Pipelines" },
  { to: "/settings/custom-properties", label: "Propriedades" },
  { to: "/settings/teams", label: "Equipe" },
  { to: "/settings/roles", label: "Permissões" },
  { to: "/settings/audit-log", label: "Auditoria" },
] as const;

function SettingsLayout() {
  const path = useLocation({ select: (l) => l.pathname });
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Personalize a operação do CRM." />
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => {
          const active = t.to === "/settings" ? path === "/settings" : path.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
