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
  Search,
  Settings as SettingsIcon,
  User,
  Mail,
  Shield,
  ShieldCheck,
  Languages,
  Smartphone,
  Calendar,
  CalendarCheck,
  GitBranch,
  Tag,
  Layers,
  LayoutTemplate,
  Boxes,
  Filter,
  Package,
  FileText,
  FileSignature,
  BookOpen,
  Repeat,
  Upload,
  Workflow,
  ArrowRightLeft,
  Route as RouteIcon,
  Timer,
  Star,
  Sparkles,
  Users,
  UsersRound,
  KeyRound,
  ScrollText,
  Webhook,
  Plug,
  RefreshCw,
  MessageSquare,
  MessagesSquare,
  ShoppingBag,
  Megaphone,
  CreditCard,
  Receipt,
  Repeat2,
  FileBarChart2,
  ClipboardList,
  Globe,
  MousePointerClick,
  PhoneCall,
  Video as VideoIcon,
  Lock,
  Database,
  Download,
  Bell,
  Zap,
  ListChecks,
  Briefcase,
  Image as ImageIcon,
} from "lucide-react";
import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

type Need = "admin" | "manager" | "platform" | undefined;
/**
 * Escopo da configuração. Regra: se impacta 2+ módulos → "global" (default).
 * Configurações específicas de um módulo recebem o ID do módulo dono e são
 * exibidas apenas quando aquele módulo é o ativo (via `getSettingsForScope`).
 */
type Scope = "global" | "crm" | "ats" | "contracts" | "services" | "projects" | "finance";
type Tab = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: Need;
  scope?: Scope;
};
type Section = { label: string; tabs: Tab[] };

const sections: Section[] = [
  {
    label: "Minha conta",
    tabs: [
      { to: "/settings", label: "Perfil", icon: User },
      { to: "/settings/email", label: "Conexão de email", icon: Mail },
      { to: "/settings/notifications", label: "Notificações", icon: Bell },
      { to: "/settings/security", label: "Segurança (2FA)", icon: ShieldCheck },
    ],
  },
  {
    label: "Workspace",
    tabs: [
      { to: "/settings/branding", label: "White-label", icon: Sparkles, need: "admin" },
      { to: "/settings/language", label: "Idioma", icon: Languages, need: "admin" },
      { to: "/settings/mobile", label: "Mobile / PWA", icon: Smartphone, need: "admin" },
      { to: "/settings/calendars", label: "Calendários", icon: Calendar },
      { to: "/settings/booking", label: "Agendamentos", icon: CalendarCheck, need: "manager" },
      { to: "/settings/billing", label: "Planos e cobrança", icon: CreditCard, need: "admin" },
      {
        to: "/settings/data-residency",
        label: "Residência de dados",
        icon: Database,
        need: "admin",
      },
      { to: "/settings/exports", label: "Exportações", icon: Download, need: "admin" },
    ],
  },
  {
    label: "Estrutura CRM",
    tabs: [
      { to: "/settings/pipelines", label: "Pipelines", icon: GitBranch, need: "admin" },
      { to: "/settings/custom-properties", label: "Propriedades", icon: Tag, need: "admin" },
      {
        to: "/settings/property-groups",
        label: "Grupos de propriedades",
        icon: Layers,
        need: "admin",
      },
      {
        to: "/settings/record-layouts",
        label: "Layout do registro",
        icon: LayoutTemplate,
        need: "admin",
      },
      { to: "/settings/custom-objects", label: "Objetos custom", icon: Boxes, need: "admin" },
      {
        to: "/settings/lead-sources",
        label: "Fontes de lead",
        icon: Filter,
        need: "manager",
        scope: "crm",
      },
      { to: "/settings/segments", label: "Segmentos", icon: Filter, need: "manager" },
      { to: "/settings/products", label: "Produtos", icon: Package, need: "manager" },
    ],
  },
  {
    label: "Vendas & Financeiro",
    tabs: [
      { to: "/settings/quotes", label: "Cotações", icon: FileText, need: "manager", scope: "crm" },
      {
        to: "/settings/quote-templates",
        label: "Modelos de cotação",
        icon: LayoutTemplate,
        need: "manager",
      },
      {
        to: "/settings/clauses",
        label: "Biblioteca de cláusulas",
        icon: BookOpen,
        need: "manager",
      },
      {
        to: "/settings/esign",
        label: "Assinaturas eletrônicas",
        icon: FileSignature,
        need: "admin",
      },
      { to: "/settings/payments", label: "Pagamentos", icon: CreditCard, need: "admin" },
      { to: "/settings/subscriptions", label: "Assinaturas", icon: Repeat2, need: "admin" },
      { to: "/settings/recurring", label: "Recorrência", icon: Repeat, need: "admin" },
      { to: "/settings/dunning", label: "Cobrança (dunning)", icon: Receipt, need: "admin" },
      { to: "/settings/nfse", label: "NFS-e", icon: FileBarChart2, need: "admin" },
      { to: "/settings/goals", label: "Metas", icon: Star, need: "manager", scope: "crm" },
    ],
  },
  {
    label: "Automação",
    tabs: [
      { to: "/settings/workflows", label: "Workflows", icon: Workflow, need: "manager" },
      { to: "/settings/sequences", label: "Sequências", icon: RouteIcon, need: "manager" },
      { to: "/settings/rotation", label: "Distribuição", icon: ArrowRightLeft, need: "manager" },
      { to: "/settings/sla", label: "SLA por etapa", icon: Timer, need: "manager" },
      { to: "/settings/scoring", label: "Pontuação", icon: Star, need: "manager" },
      { to: "/settings/playbooks", label: "Playbooks", icon: BookOpen, need: "manager" },
      { to: "/settings/enrichment", label: "Enriquecimento", icon: Sparkles, need: "admin" },
      { to: "/settings/macros", label: "Macros", icon: ListChecks, need: "manager" },
      { to: "/settings/kb", label: "Base de conhecimento", icon: BookOpen, need: "manager" },
      { to: "/settings/import-csv", label: "Importar CSV", icon: Upload, need: "admin" },
    ],
  },
  {
    label: "Pessoas & Acesso",
    tabs: [
      { to: "/settings/access-policy", label: "Política de acesso", icon: Lock, need: "admin" },

      { to: "/settings/scim", label: "SCIM", icon: Users, need: "admin" },
      { to: "/settings/audit-log", label: "Auditoria", icon: ScrollText, need: "admin" },
      { to: "/settings/audit-export", label: "Exportar auditoria", icon: Download, need: "admin" },
      { to: "/settings/api-keys", label: "API Keys", icon: KeyRound, need: "admin" },
    ],
  },
  {
    label: "Engajamento",
    tabs: [
      { to: "/settings/forms", label: "Formulários", icon: ClipboardList, need: "manager" },
      { to: "/settings/widget", label: "Widget do site", icon: MousePointerClick, need: "admin" },
      { to: "/settings/portal", label: "Portal do cliente", icon: Globe, need: "admin" },
      { to: "/settings/surveys", label: "Pesquisas", icon: Star, need: "manager" },
      { to: "/settings/email-templates", label: "Templates de email", icon: Mail, need: "manager" },
      { to: "/settings/media", label: "Biblioteca de mídia", icon: ImageIcon, need: "manager" },
      { to: "/settings/prospecting", label: "Prospecção", icon: Briefcase, need: "manager" },
      {
        to: "/settings/prospecting-scripts",
        label: "Scripts de prospecção",
        icon: FileText,
        need: "manager",
      },
      { to: "/settings/voice-agent", label: "Agente de voz", icon: PhoneCall, need: "admin" },
      { to: "/settings/video", label: "Vídeo / reuniões", icon: VideoIcon, need: "manager" },
    ],
  },
  {
    label: "Integrações",
    tabs: [
      { to: "/integrations", label: "Conectores", icon: Plug, need: "admin" },
      { to: "/settings/integrations/linkedin", label: "LinkedIn (Unipile)", icon: Briefcase },
      { to: "/settings/webhooks", label: "Webhooks", icon: Webhook, need: "admin" },
      { to: "/settings/zapier", label: "Zapier", icon: Zap, need: "admin" },
      { to: "/settings/notifications/slack", label: "Slack", icon: Bell, need: "admin" },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot", icon: RefreshCw, need: "admin" },
      { to: "/settings/hubspot-users", label: "Usuários HubSpot", icon: Users, need: "admin" },
      { to: "/settings/ads-sync", label: "Sync de anúncios", icon: Megaphone, need: "admin" },
      { to: "/settings/whatsapp", label: "WhatsApp (Meta)", icon: MessageSquare, need: "admin" },
      {
        to: "/settings/whatsapp-templates",
        label: "WhatsApp · Templates",
        icon: MessagesSquare,
        need: "manager",
      },
      {
        to: "/settings/whatsapp-catalogs",
        label: "WhatsApp · Catálogos",
        icon: ShoppingBag,
        need: "manager",
      },
      {
        to: "/settings/wa-ads",
        label: "WhatsApp · Anúncios CTWA",
        icon: Megaphone,
        need: "manager",
      },
    ],
  },
];

/**
 * Retorna as configurações específicas de um módulo (scope === moduleId).
 * Consumido pelo sidebar do módulo para exibir um grupo "Configurações do módulo",
 * sem duplicar URLs — todas as telas continuam morando em /settings/*.
 */
export function getSettingsForScope(scope: Exclude<Scope, "global">): Tab[] {
  const out: Tab[] = [];
  for (const s of sections) for (const t of s.tabs) if (t.scope === scope) out.push(t);
  return out;
}
export type { Tab as SettingsTab };

function SettingsLayout() {
  const path = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { isAdmin, isManager } = useMyRole();
  const { isPlatformAdmin } = useIsPlatformAdmin();

  const canSee = (t: Tab) => {
    if (t.need === "platform") return isPlatformAdmin;
    if (t.need === "admin") return isAdmin;
    if (t.need === "manager") return isManager;
    return true;
  };

  const allowedSections = useMemo(
    () =>
      sections.map((s) => ({ ...s, tabs: s.tabs.filter(canSee) })).filter((s) => s.tabs.length > 0),
    [isAdmin, isManager, isPlatformAdmin],
  );

  const isActive = (to: string) =>
    to === "/settings" ? path === "/settings" : path.startsWith(to);

  const currentValue =
    allowedSections
      .flatMap((s) => s.tabs)
      .filter((t) => isActive(t.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? "/settings";

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allowedSections;
    return allowedSections
      .map((s) => ({ ...s, tabs: s.tabs.filter((t) => t.label.toLowerCase().includes(q)) }))
      .filter((s) => s.tabs.length > 0);
  }, [query, allowedSections]);

  // Páginas que devem ocupar a largura inteira (sem o menu lateral de configurações),
  // mantendo apenas o sidebar global do app.
  const FULL_WIDTH_ROUTES = ["/settings/forms"];
  const fullWidth = FULL_WIDTH_ROUTES.some((r) => path === r || path.startsWith(r + "/"));

  if (fullWidth) {
    return (
      <div className="min-w-0">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      {/* Mobile: select */}
      <div className="mb-4 lg:hidden">
        <Select value={currentValue} onValueChange={(v) => navigate({ to: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedSections.map((section) => (
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gerencie seu ambiente de trabalho
            </p>
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
