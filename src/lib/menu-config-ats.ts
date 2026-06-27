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
  Globe,
  ClipboardCheck,
  BookOpen,
  FileSignature,
  Sparkles,
  ShieldAlert,
  Heart,
  Users2,
  Gift,
  Inbox,
  CalendarClock,
} from "lucide-react";

import type { SidebarGroup } from "@/lib/menu-config";

// Sidebar ATS: somente itens do módulo. Configurações de workspace (membros,
// papéis, billing, idioma, API keys) ficam no Workspace Hub (/workspace),
// acessível pelo menu "Workspace" no header.
export const ATS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas", url: "/jobs", icon: Briefcase },
      { title: "Candidatos", url: "/candidates", icon: Users },
      { title: "Pipelines", url: "/pipelines", icon: GitBranch },
      { title: "Scorecards", url: "/scorecards", icon: ClipboardCheck },
      { title: "Kits de Entrevista", url: "/interview-kits", icon: BookOpen },
      { title: "Scheduling", url: "/scheduling", icon: CalendarClock },
    ],
  },
  {
    label: "Sourcing",
    items: [
      { title: "Inbox", url: "/sourcing/inbox", icon: Inbox },
      { title: "Talent Pools", url: "/sourcing/pools", icon: Users2 },
      { title: "Sequências", url: "/sourcing/sequences", icon: Mail },
      { title: "Indicações", url: "/sourcing/referrals", icon: Gift },
      { title: "Analytics", url: "/sourcing/analytics", icon: BarChart3 },
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
      { title: "Notetaker IA", url: "/notetaker", icon: Sparkles },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Insights ATS", url: "/insights", icon: BarChart3 },
      { title: "DEI Analytics", url: "/dei-analytics", icon: Heart },
    ],
  },
];
