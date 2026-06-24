// Menu lateral do módulo ATS (TechHire).
// Renderizado pelo AppSidebar quando `activeModule === 'ats'`.
// Permissões reaproveitam o tipo `Perms` do menu-config principal.
//
// Regra: apontar SOMENTE para rotas ATS-only (src/routes/_authenticated/(ats)/*)
// ou para settings compartilhados de workspace. Não reutilizar rotas do CRM
// (TechSales) como /meetings, /inbox, /settings/portal, /reports, etc.

import {
  Briefcase,
  Users,
  GitBranch,
  BarChart3,
  Mail,
  ShieldCheck,
  Languages,
  CreditCard,
  KeyRound,
  UsersRound,
  Globe,
  ClipboardCheck,
} from "lucide-react";

import type { SidebarGroup } from "@/lib/menu-config";

export const ATS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas", url: "/jobs", icon: Briefcase },
      { title: "Candidatos", url: "/candidates", icon: Users },
      { title: "Pipelines", url: "/pipelines", icon: GitBranch },
      { title: "Scorecards", url: "/scorecards", icon: ClipboardCheck },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "E-mails por etapa", url: "/stage-emails", icon: Mail },
    ],
  },
  {
    label: "Carreiras",
    items: [
      { title: "Página de Carreiras", url: "/careers", icon: Globe },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Insights ATS", url: "/insights", icon: BarChart3 },
    ],
  },
  {
    label: "Workspace (ERP)",
    items: [
      { title: "Equipe", url: "/settings/workspace-team", icon: UsersRound, need: "admin" },
      { title: "Papéis & Permissões", url: "/settings/roles", icon: ShieldCheck, need: "admin" },
      { title: "Planos & Cobrança", url: "/settings/billing", icon: CreditCard, need: "admin" },
      { title: "Idioma", url: "/settings/language", icon: Languages },
      { title: "API Keys", url: "/settings/api-keys", icon: KeyRound, need: "admin" },
    ],
  },
];
