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
  /** Permission keys efetivas do usuário (conjunto de permissões do workspace). */
  permissions?: Set<string>;
};

export type SidebarItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: Need;
  /**
   * Permissões granulares que também liberam o item, mesmo sem o papel exigido
   * em `need`. Basta ter QUALQUER uma das chaves.
   */
  permissionAny?: readonly string[];
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
  /** Permissões granulares que também liberam o item (basta QUALQUER uma). */
  permissionAny?: readonly string[];
};
export type SettingsGroup = { label: string; items: SettingsItem[] };

// --- SIDEBAR -----------------------------------------------------------------

/**
 * Permissões que dão acesso a alguma aba de /prospecting.
 * Deve espelhar as abas definidas em `routes/_authenticated/prospecting.index.tsx`.
 */
export const PROSPECTING_VIEW_PERMISSIONS = [
  "techsales.prospecting.search.view",
  "techsales.prospecting.queue.view",
  "techsales.prospecting.cadences.view",
  "techsales.prospecting.questionnaires.view",
  "techsales.prospecting.scoring.view",
  "techsales.prospecting.scripts.view",
  "techsales.prospecting.playbooks.view",
  "techsales.prospecting.enrichment.view",
  "techsales.prospecting.voice.view",
];

/**
 * Permissões granulares por área de menu.
 * Cada lista libera o item correspondente mesmo sem o papel de gestor.
 * As chaves existem em `public.permissions` (catálogo do workspace).
 */
export const MENU_PERMISSIONS = {
  landingPages: [
    "techsales.marketing.landing_pages.view.workspace",
    "techsales.marketing.landing_pages.manage.workspace",
  ],
  forms: ["techsales.marketing.forms.view.workspace", "techsales.marketing.forms.manage.workspace"],
  campaigns: [
    "techsales.marketing.campaigns.view.workspace",
    "techsales.marketing.campaigns.manage.workspace",
  ],
  sdrAgent: [
    "techsales.marketing.sdr_agent.view.workspace",
    "techsales.marketing.sdr_agent.manage.workspace",
  ],
  catalog: [
    "techsales.catalog.services.view.workspace",
    "techsales.catalog.services.manage.workspace",
  ],
  dashboards: [
    "system.analytics.dashboards.view.workspace",
    "system.analytics.dashboards.manage.workspace",
  ],
  reports: ["system.analytics.reports.view.workspace", "system.analytics.reports.manage.workspace"],
  analytics: ["system.analytics.insights.view.workspace"],
  workflows: ["system.workflows.manage.workspace"],
  sequences: [
    "system.automation.sequences.view.workspace",
    "system.automation.sequences.manage.workspace",
  ],
  rotation: [
    "system.automation.rotation.view.workspace",
    "system.automation.rotation.manage.workspace",
  ],
  sla: ["system.automation.sla.view.workspace", "system.automation.sla.manage.workspace"],
  macros: ["system.automation.macros.view.workspace", "system.automation.macros.manage.workspace"],
  emailTemplates: [
    "system.automation.email_templates.view.workspace",
    "system.automation.email_templates.manage.workspace",
  ],
  kb: ["system.kb.articles.view.workspace", "system.kb.articles.manage.workspace"],
  calendars: ["system.calendars.view.workspace", "system.calendars.manage.workspace"],
  booking: ["system.booking.view.workspace", "system.booking.manage.workspace"],
  onboardingTemplates: [
    "system.onboarding_templates.view.workspace",
    "system.onboarding_templates.manage.workspace",
  ],
  userGroups: ["system.user_groups.view.workspace", "system.user_groups.manage.workspace"],
  // Financeiro
  financeOverview: [
    "techfinance.entries.view.own",
    "techfinance.entries.view.workspace",
    "techfinance.entries.manage.workspace",
  ],
  financeReceivable: [
    "techfinance.invoices.view.workspace",
    "techfinance.entries.view.workspace",
    "techfinance.entries.view.own",
  ],
  financePayable: [
    "techfinance.payments.view.workspace",
    "techfinance.entries.view.workspace",
    "techfinance.entries.view.own",
  ],
  financeRecurrences: [
    "techfinance.recurrences.view.workspace",
    "techfinance.recurrences.update.workspace",
  ],
  financeCostCenters: [
    "techfinance.cost_centers.view.workspace",
    "techfinance.cost_centers.update.workspace",
  ],
  financeBanking: ["techfinance.banking.view.workspace", "techfinance.banking.manage.workspace"],
  financeNfse: ["techfinance.nfse.view.workspace", "techfinance.nfse.manage.workspace"],
  financeDunning: ["techfinance.dunning.view.workspace", "techfinance.dunning.manage.workspace"],
  // Pessoas
  peopleOnboarding: [
    "techpeople.onboarding.view.workspace",
    "techpeople.onboarding.manage.workspace",
  ],
  peopleDocuments: ["techpeople.documents.view.workspace", "techpeople.documents.update.workspace"],
  peopleWellbeingAssessments: [
    "techpeople.wellbeing.assessments.view.own",
    "techpeople.wellbeing.assessments.view.workspace",
  ],
  peopleWellbeingIncidents: [
    "techpeople.wellbeing.incidents.view.own",
    "techpeople.wellbeing.incidents.view.workspace",
    "techpeople.incidents.view.workspace",
  ],
  peopleBenefits: ["techpeople.benefits.view.workspace", "techpeople.benefits.update.workspace"],
  peopleTimesheet: [
    "techpeople.timesheet.view.own",
    "techpeople.timesheet.view.workspace",
    "techpeople.timesheet.approve.workspace",
  ],
  peopleAllocations: [
    "techpeople.allocations.view.workspace",
    "techpeople.allocations.update.workspace",
  ],
  peopleImport: ["techpeople.people.create.own", "techpeople.people.update.workspace"],
} as const;

/**
 * Chaves granulares equivalentes a "administrar este recurso".
 * Usadas em itens que antes só tinham gate por papel de administrador —
 * o papel continua valendo, a permissão é um caminho adicional.
 */
export function adminAny(resource: string): readonly string[] {
  return [`${resource}.view.workspace`, `${resource}.update.workspace`];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Captar",
    items: [
      {
        title: "Prospecção",
        url: "/prospecting",
        icon: PlayCircle,
        need: "manager",
        permissionAny: PROSPECTING_VIEW_PERMISSIONS,
      },

      {
        title: "Leads",
        url: "/leads",
        icon: UserPlus,
      },

      {
        title: "Landing Pages",
        url: "/landing-pages",
        icon: FileText,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.landingPages,
      },
      {
        title: "Formulários",
        url: "/forms",
        icon: FileText,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.forms,
      },
      { title: "Pesquisas", url: "/surveys", icon: Star },

      {
        title: "Campanhas Email",
        url: "/campaigns/email",
        icon: Mail,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.campaigns,
      },
      {
        title: "Campanhas WhatsApp",
        url: "/campaigns/whatsapp",
        icon: Megaphone,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.campaigns,
      },

      {
        title: "Agente SDR",
        url: "/agents/sdr",
        icon: Sparkles,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.sdrAgent,
      },
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
          {
            title: "Calendários",
            url: "/settings/calendars",
            icon: Calendar,
            need: "manager",
            permissionAny: MENU_PERMISSIONS.calendars,
          },
          {
            title: "Agendamentos",
            url: "/settings/booking",
            icon: Calendar,
            need: "manager",
            permissionAny: MENU_PERMISSIONS.booking,
          },
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
      { title: "Faturas", url: "/invoices", icon: FileText },
      {
        title: "Portal do cliente",
        url: "/settings/portal",
        icon: Briefcase,
        need: "admin",
        permissionAny: adminAny("system.portal"),
      },
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

      {
        title: "Base de conhecimento",
        url: "/settings/kb",
        icon: BookOpen,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.kb,
      },
    ],
  },
  {
    label: "Otimizar",
    items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      {
        title: "Dashboards",
        url: "/dashboards",
        icon: LayoutDashboard,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.dashboards,
      },
      {
        title: "Relatórios",
        url: "/reports",
        icon: BarChart3,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.reports,
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: TrendingUp,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.analytics,
      },
      {
        title: "Workflows",
        url: "/settings/workflows",
        icon: Workflow,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.workflows,
      },
      {
        title: "Sequências",
        url: "/settings/sequences",
        icon: RouteIcon,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.sequences,
      },
      {
        title: "Distribuição",
        url: "/settings/rotation",
        icon: RouteIcon,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.rotation,
      },
      {
        title: "SLA por etapa",
        url: "/settings/sla",
        icon: Activity,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.sla,
      },

      {
        title: "Macros",
        url: "/settings/macros",
        icon: LayoutTemplate,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.macros,
      },
    ],
  },
];

export const SIDEBAR_PLATFORM_ITEMS: SidebarItem[] = [
  { title: "Super-admin", url: "/admin/workspaces", icon: ShieldCheck, need: "platform" },
  { title: "Chamados", url: "/admin/bug-reports", icon: Bug, need: "platform" },
  { title: "Status", url: "/settings/platform/status", icon: Activity, need: "platform" },
  { title: "Alertas", url: "/settings/platform/alerts", icon: Bell, need: "platform" },
  { title: "Segurança", url: "/settings/platform/security", icon: ShieldCheck, need: "platform" },
  { title: "Quotas", url: "/settings/platform/quotas", icon: Gauge, need: "platform" },
  { title: "Sandbox", url: "/settings/platform/sandbox", icon: FlaskConical, need: "platform" },
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
      { to: "/settings/my-tickets", label: "Meus chamados", icon: Bug },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        to: "/settings/branding",
        label: "White-label",
        icon: Sparkles,
        need: "admin",
        permissionAny: adminAny("system.branding"),
      },
      {
        to: "/settings/legal-entities",
        label: "Empresas (CNPJs)",
        icon: Building2,
        need: "admin",
        permissionAny: adminAny("system.legal_entities"),
      },
      {
        to: "/settings/legal-entity-groups",
        label: "Grupos empresariais",
        icon: Building2,
        need: "admin",
        permissionAny: adminAny("system.legal_entity_groups"),
      },
      {
        to: "/settings/language",
        label: "Idioma",
        icon: Languages,
        need: "admin",
        permissionAny: adminAny("system.language"),
      },
      {
        to: "/settings/calendars",
        label: "Calendários",
        icon: Calendar,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.calendars,
      },
      {
        to: "/settings/billing",
        label: "Planos e cobrança",
        icon: CreditCard,
        need: "admin",
        permissionAny: adminAny("system.billing"),
      },
    ],
  },
  {
    label: "Estrutura CRM",
    items: [
      {
        to: "/settings/pipelines",
        label: "Pipelines",
        icon: GitBranch,
        need: "admin",
        permissionAny: adminAny("system.pipelines"),
      },
      {
        to: "/settings/custom-properties",
        label: "Propriedades",
        icon: Tag,
        need: "admin",
        permissionAny: adminAny("system.custom_properties"),
      },
      {
        to: "/settings/custom-objects",
        label: "Objetos custom",
        icon: Boxes,
        need: "admin",
        permissionAny: adminAny("system.custom_objects"),
      },
    ],
  },
  {
    label: "Pessoas & Acesso",
    items: [
      {
        to: "/settings/teams",
        label: "Membros",
        icon: UsersRound,
        need: "admin",
        permissionAny: adminAny("system.members"),
      },
      {
        to: "/settings/user-groups",
        label: "Times",
        icon: UsersRound,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.userGroups,
      },
      {
        to: "/settings/permissions",
        label: "Permissões",
        icon: Shield,
        need: "admin",
        permissionAny: adminAny("system.roles"),
      },
      {
        to: "/settings/rbac-diagnostics",
        label: "Diagnóstico de acesso",
        icon: Shield,
        need: "admin",
        permissionAny: adminAny("system.rbac_diagnostics"),
      },
    ],
  },
  {
    label: "Automação & Engajamento",
    items: [
      {
        to: "/settings/workflows",
        label: "Workflows",
        icon: Workflow,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.workflows,
      },
      {
        to: "/settings/sequences",
        label: "Sequências",
        icon: RouteIcon,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.sequences,
      },
      {
        to: "/settings/email-templates",
        label: "Templates de email",
        icon: Mail,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.emailTemplates,
      },
      {
        to: "/settings/macros",
        label: "Macros",
        icon: LayoutTemplate,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.macros,
      },
      { to: "/settings/snippets", label: "Snippets", icon: LayoutTemplate },
      {
        to: "/settings/onboarding-templates",
        label: "Modelos de onboarding",
        icon: LayoutTemplate,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.onboardingTemplates,
      },
      {
        to: "/settings/kb",
        label: "Base de conhecimento",
        icon: BookOpen,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.kb,
      },
    ],
  },
  {
    label: "Integrações",
    items: [
      {
        to: "/settings/marketplace",
        label: "Marketplace",
        icon: ShoppingBag,
        need: "admin",
        permissionAny: adminAny("system.marketplace"),
      },
      {
        to: "/settings/integrations",
        label: "Integrações",
        icon: Plug,
        need: "admin",
        permissionAny: adminAny("system.integrations"),
      },
      {
        to: "/settings/whatsapp",
        label: "WhatsApp",
        icon: MessageSquare,
        need: "admin",
        permissionAny: adminAny("system.whatsapp"),
      },
      {
        to: "/settings/integrations/linkedin",
        label: "LinkedIn (Unipile)",
        icon: Linkedin,
        need: "admin",
        permissionAny: adminAny("system.linkedin"),
      },
      {
        to: "/settings/integrations/$slug",
        label: "Sync HubSpot",
        icon: RefreshCw,
        need: "admin",
        permissionAny: adminAny("system.hubspot_sync"),
      },
      {
        to: "/settings/widget",
        label: "Widget do site",
        icon: Megaphone,
        need: "admin",
        permissionAny: adminAny("system.widget"),
      },
      {
        to: "/settings/import",
        label: "Importar dados",
        icon: Download,
        need: "admin",
        permissionAny: adminAny("system.import"),
      },
    ],
  },

  {
    label: "Plataforma",
    items: [
      { to: "/settings/platform/status", label: "Status", icon: Activity, need: "platform" },
      { to: "/settings/platform/alerts", label: "Alertas", icon: Bell, need: "platform" },
      {
        to: "/settings/platform/security",
        label: "Segurança",
        icon: ShieldCheck,
        need: "platform",
      },
      { to: "/settings/platform/quotas", label: "Quotas", icon: Gauge, need: "platform" },
      { to: "/settings/platform/sandbox", label: "Sandbox", icon: FlaskConical, need: "platform" },
    ],
  },
];

// --- Helpers -----------------------------------------------------------------

export function canSee(need: Need, perms: Perms, permissionAny?: readonly string[]): boolean {
  if (permissionAny?.length && perms.permissions?.size) {
    if (permissionAny.some((k) => perms.permissions!.has(k))) return true;
  }
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
      if (!canSee(i.need, perms, i.permissionAny)) continue;
      out.push(i.url);
      for (const c of i.children ?? []) {
        if (canSee(c.need, perms, c.permissionAny)) out.push(c.url);
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
    g.items.filter((i) => canSee(i.need, perms, i.permissionAny)).map((i) => i.to),
  );
}
