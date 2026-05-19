import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings", label: "Perfil" },
  { to: "/settings/email", label: "Email" },
  { to: "/settings/email-templates", label: "Templates de Email" },
  { to: "/settings/pipelines", label: "Pipelines" },
  { to: "/settings/scoring", label: "Lead Scoring" },
  { to: "/settings/playbooks", label: "Playbooks" },
  { to: "/settings/segments", label: "Segmentos" },
  { to: "/settings/sequences", label: "Sequências" },
  { to: "/settings/workflows", label: "Workflows" },
  { to: "/settings/rotation", label: "Distribuição" },
  { to: "/settings/sla", label: "SLA" },
  { to: "/settings/roles", label: "Permissões" },
  { to: "/settings/subscriptions", label: "Tipos de Assinatura" },
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
