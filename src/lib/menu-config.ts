// Configuração compartilhada dos menus (Sidebar e Configurações) + helpers
// puros de visibilidade por papel. Pensada para ser testável sem renderizar
// componentes React.
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Building2,
  Briefcase,
  PlayCircle,
  ListTodo,
  MessageSquare,
  StickyNote,
  MessageCircle,
  Megaphone,
  Mail,
  Inbox,
  LifeBuoy,
  Star,
  FileText,
  BarChart3,
  TrendingUp,
  Sparkles,
  Video,
  ListChecks,
  Download,
  Activity,
  Bell,
  Gauge,
  FlaskConical,
  User,
  Shield,
  ShieldCheck,
  Bug,
  Lock,
  Languages,
  Calendar,
  CreditCard,
  GitBranch,
  Tag,
  Package,
  Boxes,
  UsersRound,
  KeyRound,
  Workflow,
  Route as RouteIcon,
  LayoutTemplate,
  BookOpen,
  Plug,
  ShoppingBag,
  RefreshCw,
  Linkedin,
} from "lucide-react";


export type Need = "admin" | "manager" | "platform" | undefined;
export type Perms = {
  isAdmin: boolean;
  isManager: boolean;
  isPlatformAdmin: boolean;
};

export type SidebarItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: Need;
  children?: SidebarItem[];
  /** Quando true, abre em nova aba (link externo / página pública). */
  external?: boolean;
};
export type SidebarGroup = { label: string; items: SidebarItem[] };

export type SettingsItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: Need;
};
export type SettingsGroup = { label: string; items: SettingsItem[] };

// --- SIDEBAR -----------------------------------------------------------------

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Captar",
    items: [
      {
        title: "Leads",
        url: "/leads",
        icon: UserPlus,
      },

      { title: "Landing Pages", url: "/landing-pages", icon: FileText, need: "manager" },
      { title: "Formulários", url: "/forms", icon: FileText, need: "manager" },
      { title: "Pesquisas", url: "/surveys", icon: Star },

      { title: "Campanhas Email", url: "/campaigns/email", icon: Mail, need: "manager" },
      { title: "Campanhas WhatsApp", url: "/campaigns/whatsapp", icon: Megaphone, need: "manager" },
      {
        title: "Prospecção por voz",
        url: "/prospecting/campaigns",
        icon: PlayCircle,
        need: "manager",
      },
      { title: "Agente SDR", url: "/agents/sdr", icon: Sparkles, need: "manager" },
    ],
  },
  {
    label: "Relacionar",
    items: [
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Empresas", url: "/companies", icon: Building2 },
      {
        title: "Inbox unificada",
        url: "/inbox",
        icon: Inbox,
        children: [
          { title: "Email", url: "/inbox/email", icon: Mail },
          { title: "WhatsApp", url: "/inbox/whatsapp", icon: MessageCircle },
          { title: "Chat ao vivo", url: "/inbox/chat", icon: MessageSquare },
        ],
      },
      { title: "Comunicações", url: "/communications", icon: MessageSquare },
      { title: "Notas", url: "/notes", icon: StickyNote },
      {
        title: "Reuniões",
        url: "/meetings",
        icon: Video,
        children: [
          { title: "Calendários", url: "/settings/calendars", icon: Calendar, need: "manager" },
          { title: "Agendamentos", url: "/settings/booking", icon: Calendar, need: "manager" },
        ],
      },
      { title: "Conexão de Email", url: "/settings/email", icon: Mail },
    ],
  },

  {
    label: "Vender",
    items: [
      { title: "Negócios", url: "/deals", icon: Briefcase },
      { title: "Cotações", url: "/settings/quotes", icon: FileText },
      { title: "Contratos", url: "/proposals", icon: FileText },
      { title: "Produtos", url: "/settings/products", icon: Package, need: "manager" },
      { title: "Faturas", url: "/invoices", icon: FileText },
      { title: "Portal do cliente", url: "/settings/portal", icon: Briefcase, need: "admin" },
    ],
  },
  {
    label: "Atender",
    items: [
      { title: "Tickets", url: "/tickets", icon: LifeBuoy },
      {
        title: "Tarefas",
        url: "/tasks",
        icon: ListTodo,
        children: [{ title: "Filas", url: "/tasks/queues", icon: ListChecks }],
      },

      { title: "Base de conhecimento", url: "/settings/kb", icon: BookOpen, need: "manager" },
    ],
  },
  {
    label: "Otimizar",
    items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Dashboards", url: "/dashboards", icon: LayoutDashboard, need: "manager" },
      { title: "Relatórios", url: "/reports", icon: BarChart3, need: "manager" },
      { title: "Analytics", url: "/analytics", icon: TrendingUp, need: "manager" },
      { title: "Workflows", url: "/settings/workflows", icon: Workflow, need: "manager" },
      { title: "Sequências", url: "/settings/sequences", icon: RouteIcon, need: "manager" },
      { title: "Distribuição", url: "/settings/rotation", icon: RouteIcon, need: "manager" },
      { title: "SLA por etapa", url: "/settings/sla", icon: Activity, need: "manager" },
      { title: "Pontuação", url: "/settings/scoring", icon: Star, need: "manager" },
      { title: "Macros", url: "/settings/macros", icon: LayoutTemplate, need: "manager" },
    ],
  },
];

export const SIDEBAR_PLATFORM_ITEMS: SidebarItem[] = [
  { title: "Super-admin", url: "/admin/workspaces", icon: ShieldCheck, need: "platform" },
  { title: "Chamados", url: "/admin/bug-reports", icon: Bug, need: "platform" },
  { title: "Status", url: "/admin/status", icon: Activity, need: "platform" },
  { title: "Alertas", url: "/admin/alerts", icon: Bell, need: "platform" },
  { title: "Segurança", url: "/admin/security-scans", icon: ShieldCheck, need: "platform" },
  { title: "Quotas", url: "/admin/quotas", icon: Gauge, need: "platform" },
  { title: "Sandbox", url: "/admin/sandbox", icon: FlaskConical, need: "platform" },
];

// --- SETTINGS ----------------------------------------------------------------

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: "Minha conta",
    items: [
      { to: "/settings", label: "Perfil", icon: User },
      { to: "/settings/email", label: "Conexão de email", icon: Mail },
      { to: "/settings/security", label: "Segurança (2FA)", icon: ShieldCheck },
      { to: "/settings/privacy", label: "Privacidade & Meus Dados", icon: Lock },
      { to: "/my-bug-reports", label: "Meus chamados", icon: Bug },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/settings/branding", label: "White-label", icon: Sparkles, need: "admin" },
      { to: "/settings/language", label: "Idioma", icon: Languages, need: "admin" },
      { to: "/settings/calendars", label: "Calendários", icon: Calendar, need: "manager" },
      { to: "/settings/billing", label: "Planos e cobrança", icon: CreditCard, need: "admin" },
    ],
  },
  {
    label: "Estrutura CRM",
    items: [
      { to: "/settings/pipelines", label: "Pipelines", icon: GitBranch, need: "admin" },
      { to: "/settings/custom-properties", label: "Propriedades", icon: Tag, need: "admin" },
      { to: "/settings/products", label: "Produtos", icon: Package, need: "manager" },
      { to: "/settings/custom-objects", label: "Objetos custom", icon: Boxes, need: "admin" },
    ],
  },
  {
    label: "Pessoas & Acesso",
    items: [
      { to: "/settings/teams", label: "Membros", icon: UsersRound, need: "admin" },
      { to: "/settings/user-groups", label: "Times", icon: UsersRound, need: "manager" },
      { to: "/home/access", label: "Controle de Acesso", icon: Shield, need: "admin" },
    ],
  },
  {
    label: "Automação & Engajamento",
    items: [
      { to: "/settings/workflows", label: "Workflows", icon: Workflow, need: "manager" },
      { to: "/settings/sequences", label: "Sequências", icon: RouteIcon, need: "manager" },
      { to: "/settings/email-templates", label: "Templates de email", icon: Mail, need: "manager" },
      { to: "/settings/macros", label: "Macros", icon: LayoutTemplate, need: "manager" },
      { to: "/settings/snippets", label: "Snippets", icon: LayoutTemplate },
      { to: "/settings/kb", label: "Base de conhecimento", icon: BookOpen, need: "manager" },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, need: "admin" },
      { to: "/integrations", label: "Integrações", icon: Plug, need: "admin" },
      { to: "/settings/whatsapp", label: "WhatsApp", icon: MessageSquare, need: "admin" },
      { to: "/settings/integrations/linkedin", label: "LinkedIn (Unipile)", icon: Linkedin, need: "admin" },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot", icon: RefreshCw, need: "admin" },
      { to: "/settings/widget", label: "Widget do site", icon: Megaphone, need: "admin" },
      { to: "/leads/import-hubspot", label: "Importar HubSpot", icon: Download, need: "admin" },
    ],
  },

  {
    label: "Plataforma",
    items: [
      { to: "/admin/status", label: "Status", icon: Activity, need: "platform" },
      { to: "/admin/alerts", label: "Alertas", icon: Bell, need: "platform" },
      { to: "/admin/security-scans", label: "Segurança", icon: ShieldCheck, need: "platform" },
      { to: "/admin/quotas", label: "Quotas", icon: Gauge, need: "platform" },
      { to: "/admin/sandbox", label: "Sandbox", icon: FlaskConical, need: "platform" },
    ],
  },
];

// --- Helpers -----------------------------------------------------------------

export function canSee(need: Need, perms: Perms): boolean {
  if (need === "platform") return perms.isPlatformAdmin;
  if (need === "admin") return perms.isAdmin;
  if (need === "manager") return perms.isManager;
  return true;
}

export function permsForRole(role: "admin" | "manager" | "member", isPlatformAdmin = false): Perms {
  return {
    isAdmin: role === "admin",
    isManager: role === "admin" || role === "manager",
    isPlatformAdmin,
  };
}

export function visibleSidebarUrls(perms: Perms): string[] {
  const out: string[] = [];
  for (const g of SIDEBAR_GROUPS) {
    for (const i of g.items) {
      if (!canSee(i.need, perms)) continue;
      out.push(i.url);
      for (const c of i.children ?? []) {
        if (canSee(c.need, perms)) out.push(c.url);
      }
    }
  }
  return out;
}

export function visibleSidebarPlatformUrls(perms: Perms): string[] {
  return SIDEBAR_PLATFORM_ITEMS.filter((i) => canSee(i.need, perms)).map((i) => i.url);
}

export function visibleSettingsItems(perms: Perms): string[] {
  return SETTINGS_GROUPS.flatMap((g) =>
    g.items.filter((i) => canSee(i.need, perms)).map((i) => i.to),
  );
}
