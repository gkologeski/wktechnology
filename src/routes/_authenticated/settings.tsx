import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

type Tab = { to: string; label: string };
type Section = { label: string; tabs: Tab[] };

// Sub-navegação de /settings agrupada por sub-domínio (Proposta B).
// Conta pessoal (Perfil, Email pessoal, 2FA) também aparece aqui para acesso direto,
// além do menu do avatar no rodapé da sidebar.
const sections: Section[] = [
  {
    label: "Minha conta",
    tabs: [
      { to: "/settings", label: "Perfil" },
      { to: "/settings/email", label: "Conexão de email" },
      { to: "/settings/security", label: "Segurança (2FA)" },
    ],
  },
  {
    label: "Workspace",
    tabs: [
      { to: "/settings/branding", label: "White-label" },
      { to: "/settings/language", label: "Idioma" },
      { to: "/settings/mobile", label: "Mobile / PWA" },
      { to: "/settings/calendars", label: "Calendários" },
      { to: "/settings/booking", label: "Agendamentos" },
    ],
  },
  {
    label: "Estrutura CRM",
    tabs: [
      { to: "/settings/pipelines", label: "Pipelines" },
      { to: "/settings/custom-properties", label: "Propriedades" },
      { to: "/settings/custom-objects", label: "Objetos custom" },
      { to: "/settings/lead-sources", label: "Fontes de lead" },
      { to: "/settings/products", label: "Produtos" },
      { to: "/settings/quotes", label: "Cotações" },
      { to: "/settings/recurring", label: "Recorrência" },
      { to: "/settings/esign", label: "Assinaturas eletrônicas" },
    ],
  },
  {
    label: "Automação",
    tabs: [
      { to: "/settings/workflows", label: "Workflows" },
      { to: "/settings/sequences", label: "Sequências" },
      { to: "/settings/rotation", label: "Distribuição" },
      { to: "/settings/sla", label: "SLA por etapa" },
      { to: "/settings/scoring", label: "Pontuação" },
      { to: "/settings/playbooks", label: "Playbooks" },
      { to: "/settings/enrichment", label: "Enriquecimento" },
    ],
  },
  {
    label: "Pessoas & Acesso",
    tabs: [
      { to: "/settings/teams", label: "Usuários" },
      { to: "/settings/roles", label: "Permissões" },
    ],
  },
  {
    label: "Segurança",
    tabs: [
      { to: "/settings/audit-log", label: "Auditoria" },
      { to: "/settings/api-keys", label: "API Keys" },
      { to: "/settings/webhooks", label: "Webhooks" },
    ],
  },
  {
    label: "Integrações",
    tabs: [
      { to: "/integrations", label: "Conectores" },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot" },
      { to: "/settings/email-templates", label: "Templates de email" },
    ],
  },
];

function SettingsLayout() {
  const path = useLocation({ select: (l) => l.pathname });
  const isActive = (to: string) =>
    to === "/settings" ? path === "/settings" : path.startsWith(to);

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Personalize a operação do CRM." />
      <nav className="space-y-3 border-b pb-3">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="w-36 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {section.tabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-sm transition-colors",
                    isActive(t.to)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
