import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

type Tab = { to: string; label: string };
type Section = { label: string; tabs: Tab[] };

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
      { to: "/settings/record-layouts", label: "Layout do registro" },
      { to: "/settings/custom-objects", label: "Objetos custom" },
      { to: "/settings/lead-sources", label: "Fontes de lead" },
      { to: "/settings/products", label: "Produtos" },
      { to: "/settings/quotes", label: "Cotações" },
      { to: "/settings/recurring", label: "Recorrência" },
      { to: "/settings/esign", label: "Assinaturas eletrônicas" },
      { to: "/settings/import-csv", label: "Importar CSV" },
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
      { to: "/settings/workspace-team", label: "Equipe do workspace" },
      { to: "/settings/teams", label: "Usuários" },
      { to: "/settings/user-groups", label: "Equipes (grupos)" },
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
      { to: "/settings/hubspot-users", label: "Usuários HubSpot" },
      { to: "/settings/email-templates", label: "Templates de email" },
    ],
  },
];

function SettingsLayout() {
  const path = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const isActive = (to: string) =>
    to === "/settings" ? path === "/settings" : path.startsWith(to);

  const currentValue =
    sections
      .flatMap((s) => s.tabs)
      .filter((t) => isActive(t.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? "/settings";

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      {/* Mobile: select */}
      <div className="mb-4 lg:hidden">
        <Select value={currentValue} onValueChange={(v) => navigate({ to: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectGroup key={section.label}>
                <SelectLabel>{section.label}</SelectLabel>
                {section.tabs.map((t) => (
                  <SelectItem key={t.to} value={t.to}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden lg:block">
        <nav className="sticky top-4 space-y-6">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <div className="flex flex-col">
                {section.tabs.map((t) => (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive(t.to)
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}
