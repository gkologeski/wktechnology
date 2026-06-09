import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, Settings as SettingsIcon, User, Mail, ShieldCheck, Languages,
  Smartphone, Calendar, CalendarCheck, GitBranch, Tag, Layers, LayoutTemplate, Boxes,
  Filter, Package, FileText, FileSignature, BookOpen, Repeat, Upload, Workflow,
  ArrowRightLeft, Route as RouteIcon, Timer, Star, Sparkles, Users, UsersRound,
  KeyRound, ScrollText, Webhook, Plug, RefreshCw, MessageSquare, MessagesSquare,
  ShoppingBag, Megaphone, CreditCard, Receipt, Repeat2, FileBarChart2,
  ClipboardList, Globe, MousePointerClick, PhoneCall, Video as VideoIcon,
  Lock, Database, Download, Bell, Zap, ListChecks, Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Section = { label: string; tabs: Tab[] };

const sections: Section[] = [
  {
    label: "Minha conta",
    tabs: [
      { to: "/settings", label: "Perfil", icon: User },
      { to: "/settings/email", label: "Conexão de email", icon: Mail },
      { to: "/settings/security", label: "Segurança (2FA)", icon: ShieldCheck },
    ],
  },
  {
    label: "Workspace",
    tabs: [
      { to: "/settings/branding", label: "White-label", icon: Sparkles },
      { to: "/settings/language", label: "Idioma", icon: Languages },
      { to: "/settings/mobile", label: "Mobile / PWA", icon: Smartphone },
      { to: "/settings/calendars", label: "Calendários", icon: Calendar },
      { to: "/settings/booking", label: "Agendamentos", icon: CalendarCheck },
      { to: "/settings/billing", label: "Planos e cobrança", icon: CreditCard },
      { to: "/settings/data-residency", label: "Residência de dados", icon: Database },
      { to: "/settings/exports", label: "Exportações", icon: Download },
    ],
  },
  {
    label: "Estrutura CRM",
    tabs: [
      { to: "/settings/pipelines", label: "Pipelines", icon: GitBranch },
      { to: "/settings/custom-properties", label: "Propriedades", icon: Tag },
      { to: "/settings/property-groups", label: "Grupos de propriedades", icon: Layers },
      { to: "/settings/record-layouts", label: "Layout do registro", icon: LayoutTemplate },
      { to: "/settings/custom-objects", label: "Objetos custom", icon: Boxes },
      { to: "/settings/lead-sources", label: "Fontes de lead", icon: Filter },
      { to: "/settings/segments", label: "Segmentos", icon: Filter },
      { to: "/settings/products", label: "Produtos", icon: Package },
    ],
  },
  {
    label: "Vendas & Financeiro",
    tabs: [
      { to: "/settings/quotes", label: "Cotações", icon: FileText },
      { to: "/settings/quote-templates", label: "Modelos de cotação", icon: LayoutTemplate },
      { to: "/settings/clauses", label: "Biblioteca de cláusulas", icon: BookOpen },
      { to: "/settings/esign", label: "Assinaturas eletrônicas", icon: FileSignature },
      { to: "/settings/payments", label: "Pagamentos", icon: CreditCard },
      { to: "/settings/subscriptions", label: "Assinaturas", icon: Repeat2 },
      { to: "/settings/recurring", label: "Recorrência", icon: Repeat },
      { to: "/settings/dunning", label: "Cobrança (dunning)", icon: Receipt },
      { to: "/settings/nfse", label: "NFS-e", icon: FileBarChart2 },
      { to: "/settings/goals", label: "Metas", icon: Star },
    ],
  },
  {
    label: "Automação",
    tabs: [
      { to: "/settings/workflows", label: "Workflows", icon: Workflow },
      { to: "/settings/sequences", label: "Sequências", icon: RouteIcon },
      { to: "/settings/rotation", label: "Distribuição", icon: ArrowRightLeft },
      { to: "/settings/sla", label: "SLA por etapa", icon: Timer },
      { to: "/settings/scoring", label: "Pontuação", icon: Star },
      { to: "/settings/playbooks", label: "Playbooks", icon: BookOpen },
      { to: "/settings/enrichment", label: "Enriquecimento", icon: Sparkles },
      { to: "/settings/macros", label: "Macros", icon: ListChecks },
      { to: "/settings/kb", label: "Base de conhecimento", icon: BookOpen },
      { to: "/settings/import-csv", label: "Importar CSV", icon: Upload },
    ],
  },
  {
    label: "Pessoas & Acesso",
    tabs: [
      { to: "/settings/workspace-team", label: "Equipe do workspace", icon: Users },
      { to: "/settings/teams", label: "Usuários", icon: UsersRound },
      { to: "/settings/user-groups", label: "Equipes (grupos)", icon: UsersRound },
      { to: "/settings/roles", label: "Permissões", icon: KeyRound },
      { to: "/settings/access-policy", label: "Política de acesso", icon: Lock },
      { to: "/settings/sso", label: "SSO", icon: KeyRound },
      { to: "/settings/scim", label: "SCIM", icon: Users },
      { to: "/settings/audit-log", label: "Auditoria", icon: ScrollText },
      { to: "/settings/audit-export", label: "Exportar auditoria", icon: Download },
      { to: "/settings/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    label: "Engajamento",
    tabs: [
      { to: "/settings/forms", label: "Formulários", icon: ClipboardList },
      { to: "/settings/widget", label: "Widget do site", icon: MousePointerClick },
      { to: "/settings/portal", label: "Portal do cliente", icon: Globe },
      { to: "/settings/surveys", label: "Pesquisas", icon: Star },
      { to: "/settings/email-templates", label: "Templates de email", icon: Mail },
      { to: "/settings/prospecting", label: "Prospecção", icon: Briefcase },
      { to: "/settings/prospecting-scripts", label: "Scripts de prospecção", icon: FileText },
      { to: "/settings/voice-agent", label: "Agente de voz", icon: PhoneCall },
      { to: "/settings/video", label: "Vídeo / reuniões", icon: VideoIcon },
    ],
  },
  {
    label: "Integrações",
    tabs: [
      { to: "/integrations", label: "Conectores", icon: Plug },
      { to: "/settings/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/settings/zapier", label: "Zapier", icon: Zap },
      { to: "/settings/notifications/slack", label: "Slack", icon: Bell },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot", icon: RefreshCw },
      { to: "/settings/hubspot-users", label: "Usuários HubSpot", icon: Users },
      { to: "/settings/ads-sync", label: "Sync de anúncios", icon: Megaphone },
      { to: "/settings/whatsapp", label: "WhatsApp (Meta)", icon: MessageSquare },
      { to: "/settings/whatsapp-templates", label: "WhatsApp · Templates", icon: MessagesSquare },
      { to: "/settings/whatsapp-catalogs", label: "WhatsApp · Catálogos", icon: ShoppingBag },
      { to: "/settings/wa-ads", label: "WhatsApp · Anúncios CTWA", icon: Megaphone },
    ],
  },
];

function SettingsLayout() {
  const path = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const isActive = (to: string) =>
    to === "/settings" ? path === "/settings" : path.startsWith(to);

  const currentValue =
    sections
      .flatMap((s) => s.tabs)
      .filter((t) => isActive(t.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? "/settings";

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({ ...s, tabs: s.tabs.filter((t) => t.label.toLowerCase().includes(q)) }))
      .filter((s) => s.tabs.length > 0);
  }, [query]);

  return (
    <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
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
        <div className="sticky top-4 space-y-4">
          {/* Header */}
          <div className="px-1">
            <div className="flex items-center gap-2 text-foreground">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold tracking-tight">Configurações</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Gerencie seu ambiente de trabalho</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar configuração…"
              className="h-9 pl-9 rounded-xl bg-card"
            />
          </div>

          {/* Grouped cards */}
          <nav className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {filteredSections.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">Nenhuma configuração encontrada.</p>
            ) : (
              filteredSections.map((section) => (
                <section key={section.label}>
                  <h3 className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {section.label}
                  </h3>
                  <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm">
                    <ul className="flex flex-col gap-0.5">
                      {section.tabs.map((t) => {
                        const Icon = t.icon;
                        const active = isActive(t.to);
                        return (
                          <li key={t.to}>
                            <Link
                              to={t.to}
                              className={cn(
                                "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all",
                                active
                                  ? "bg-primary/10 text-primary font-semibold shadow-sm"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                              )}
                            >
                              <span
                                className={cn(
                                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                                  active
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span className="truncate">{t.label}</span>
                              {active && (
                                <span className="ml-auto h-5 w-1 rounded-full bg-primary" />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              ))
            )}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
