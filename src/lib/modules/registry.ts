// Registro central dos módulos do ERP.
// Espelha (em código) os registros da tabela `public.modules` para que o
// front-end possa funcionar sem um round-trip ao banco para metadados estáticos
// (cor, ícone, rota inicial, menu). Branding por workspace ainda vem do banco
// via `module_branding`.

import {
  Briefcase,
  Users,
  LayoutDashboard,
  UserPlus,
  GitBranch,
  Calendar as CalendarIcon,
  BarChart3,
  Settings as SettingsIcon,
  ClipboardCheck,
  Mail,
  type LucideIcon,
} from "lucide-react";

export type ModuleId = "crm" | "ats";

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
      { title: "Insights", url: "/insights", icon: LayoutDashboard },
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
};

export const MODULE_LIST: ModuleDefinition[] = Object.values(MODULES);

export function getModule(id: ModuleId): ModuleDefinition {
  return MODULES[id];
}
