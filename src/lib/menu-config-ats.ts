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
  BookOpen,
  FileSignature,
  Sparkles,
  ShieldAlert,
  Heart,
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
      { title: "Kits de Entrevista", url: "/interview-kits", icon: BookOpen },
    ],
  },
  {
    label: "Contratação",
    items: [
      { title: "Ofertas", url: "/offers", icon: FileSignature },
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
      { title: "Ver site de Carreiras", url: "/careers", icon: Globe, external: true },
    ],
  },
  {
    label: "Inteligência (IA)",
    items: [
      { title: "Match Scores", url: "/match-scores", icon: Sparkles },
      { title: "Flags de risco", url: "/fraud-flags", icon: ShieldAlert },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Insights ATS", url: "/insights", icon: BarChart3 },
      { title: "DEI Analytics", url: "/dei-analytics", icon: Heart },
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
