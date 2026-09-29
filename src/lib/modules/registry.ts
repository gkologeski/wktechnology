// Registro central dos módulos do ERP.
// Espelha (em código) os registros da tabela `public.modules` para que o
// front-end possa funcionar sem um round-trip ao banco para metadados estáticos
// (cor, ícone, rota inicial, menu). Branding por workspace ainda vem do banco
// via `module_branding`.
//
// ─── Fonte de verdade sobre "quais módulos existem" ─────────────────────────
// Existem SEIS módulos verticais: crm (TechSales), ats (TechHire),
// people (TechPeople), contracts (TechContracts), projects (TechProjects) e
// finance (TechFinance). O núcleo compartilhado é o Core ERP (TechERP) e
// inclui atendimento (tickets/SLA/base de conhecimento) — não existe módulo
// "TechService"/"TechServices".
//
// `services` é um id LEGADO: existe em `public.modules` /`workspace_modules`
// apenas por compatibilidade de licenciamento. `/services` é a visão
// operacional/faturamento do TechContracts. Ele NUNCA deve aparecer como
// módulo selecionável na interface — use `VERTICAL_MODULE_IDS` /
// `VERTICAL_MODULE_LIST` ao listar módulos para o usuário.

import {
  Briefcase,
  Users,
  LayoutDashboard,
  UserPlus,
  UserCog,
  GitBranch,
  Calendar as CalendarIcon,
  BarChart3,
  Settings as SettingsIcon,
  ClipboardCheck,
  Mail,
  FileText,
  Package,
  Kanban,
  DollarSign,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Ids aceitos pelo front-end. Inclui o legado `services` porque o banco ainda
 * possui esse registro; para listas voltadas ao usuário use `VERTICAL_MODULE_IDS`.
 */
export type ModuleId = "crm" | "ats" | "contracts" | "services" | "projects" | "finance" | "people";

/** Módulo legado, absorvido pelo TechContracts. Nunca exibir como módulo. */
export const LEGACY_MODULE_IDS = ["services"] as const satisfies readonly ModuleId[];

/** Os seis módulos verticais reais do produto, na ordem de exibição. */
export const VERTICAL_MODULE_IDS = [
  "crm",
  "ats",
  "people",
  "contracts",
  "projects",
  "finance",
] as const satisfies readonly ModuleId[];

export function isLegacyModuleId(id: ModuleId): boolean {
  return (LEGACY_MODULE_IDS as readonly ModuleId[]).includes(id);
}

export type ModuleMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type ModuleDefinition = {
  id: ModuleId;
  name: string;
  productName: string;
  shortDescription: string;
  defaultColor: string;
  icon: LucideIcon;
  /** Subdomínio sugerido (host) para servir o módulo em produção. */
  hostSuffix: string;
  /** Rota padrão ao entrar no módulo. */
  defaultRoute: string;
  /** Itens de menu específicos do módulo (usado pelo shell do módulo). */
  menu: ModuleMenuItem[];
};

export const MODULES: Record<ModuleId, ModuleDefinition> = {
  crm: {
    id: "crm",
    name: "CRM",
    productName: "TechSales",
    shortDescription: "Operação comercial",
    defaultColor: "#2563eb",
    icon: Briefcase,
    hostSuffix: "crm",
    defaultRoute: "/dashboard",
    // O CRM continua usando o menu rico definido em src/lib/menu-config.ts.
    // Esta lista existe apenas como fallback para o module switcher.
    menu: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: UserPlus },
      { title: "Negócios", url: "/deals", icon: Briefcase },
    ],
  },
  ats: {
    id: "ats",
    name: "ATS",
    productName: "TechHire",
    shortDescription: "Recrutamento e seleção",
    defaultColor: "#7c3aed",
    icon: Users,
    hostSuffix: "ats",
    defaultRoute: "/ats-dashboard",
    menu: [
      { title: "Dashboard", url: "/ats-dashboard", icon: LayoutDashboard },
      { title: "Insights", url: "/insights", icon: BarChart3 },
      { title: "Vagas", url: "/jobs", icon: Briefcase },
      { title: "Candidatos", url: "/candidates", icon: Users },
      { title: "Scorecards", url: "/scorecards", icon: ClipboardCheck },
      { title: "Pipelines", url: "/pipelines", icon: GitBranch },
      { title: "E-mails por etapa", url: "/stage-emails", icon: Mail },
      { title: "Entrevistas", url: "/meetings", icon: CalendarIcon },
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
      { title: "Configurações", url: "/settings", icon: SettingsIcon },
    ],
  },
  contracts: {
    id: "contracts",
    name: "Contratos",
    productName: "TechContracts",
    shortDescription: "Gestão de contratos e aprovações",
    defaultColor: "#2563eb",
    icon: FileText,
    // Sem subdomínio próprio ainda — reutiliza o host do TechSales.
    hostSuffix: "crm",
    defaultRoute: "/contracts/dashboard",
    menu: [
      { title: "Dashboard", url: "/contracts/dashboard", icon: LayoutDashboard },
      { title: "Contratos", url: "/contracts", icon: FileText },
    ],
  },
  // LEGADO — não é um módulo do produto. Mantido apenas para resolver o
  // registro `services` de `public.modules`/`workspace_modules` sem quebrar
  // licenciamento. `/services` pertence ao TechContracts.
  services: {
    id: "services",
    name: "Serviços",
    productName: "TechServices",
    shortDescription: "Catálogo e billing recorrente",
    defaultColor: "#2563eb",
    icon: Package,
    hostSuffix: "crm",
    defaultRoute: "/services",
    menu: [{ title: "Serviços", url: "/services", icon: Package }],
  },
  projects: {
    id: "projects",
    name: "Projetos",
    productName: "TechProjects",
    shortDescription: "PSA — projetos, marcos e horas",
    defaultColor: "#2563eb",
    icon: Kanban,
    hostSuffix: "crm",
    defaultRoute: "/projects/dashboard",
    menu: [
      { title: "Dashboard", url: "/projects/dashboard", icon: LayoutDashboard },
      { title: "Projetos", url: "/projects", icon: Kanban },
    ],
  },
  finance: {
    id: "finance",
    name: "Financeiro",
    productName: "TechFinance",
    shortDescription: "Contas a pagar, receber e conciliação",
    defaultColor: "#2563eb",
    icon: DollarSign,
    hostSuffix: "crm",
    defaultRoute: "/finance",
    menu: [
      { title: "Dashboard", url: "/finance", icon: Wallet },
      { title: "A receber", url: "/finance/receivable", icon: ArrowDownCircle },
      { title: "A pagar", url: "/finance/payable", icon: ArrowUpCircle },
    ],
  },
  people: {
    id: "people",
    name: "Pessoas",
    productName: "TechPeople",
    shortDescription: "Gestão de prestadores e time",
    defaultColor: "#059669",
    icon: UserCog,
    hostSuffix: "crm",
    defaultRoute: "/people/dashboard",
    menu: [
      { title: "Dashboard", url: "/people/dashboard", icon: LayoutDashboard },
      { title: "Pessoas", url: "/people", icon: Users },
      { title: "Meu time", url: "/people/my-team", icon: UserCog },
    ],
  },
};

/** Todas as definições, incluindo ids legados. Prefira `VERTICAL_MODULE_LIST`. */
export const MODULE_LIST: ModuleDefinition[] = Object.values(MODULES);

/** Apenas os módulos reais do produto — use em switchers, grids e menus. */
export const VERTICAL_MODULE_LIST: ModuleDefinition[] = VERTICAL_MODULE_IDS.map(
  (id) => MODULES[id],
);

export function getModule(id: ModuleId): ModuleDefinition {
  return MODULES[id];
}
