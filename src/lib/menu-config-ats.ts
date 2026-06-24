// Menu lateral do módulo ATS (TechHire).
// Renderizado pelo AppSidebar quando `activeModule === 'ats'`.
// Permissões reaproveitam o tipo `Perms` do menu-config principal.

import {
  LayoutDashboard,
  Briefcase,
  Users,
  GitBranch,
  Calendar,
  BarChart3,
  FileText,
  Mail,
  Plug,
  ShieldCheck,
  Languages,
  CreditCard,
  KeyRound,
  Workflow,
  UsersRound,
  Bell,
  Activity,
  Globe,
} from "lucide-react";

import type { SidebarGroup } from "@/lib/menu-config";

export const ATS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas", url: "/jobs", icon: Briefcase },
      { title: "Candidatos", url: "/candidates", icon: Users },
      { title: "Pipelines", url: "/settings/pipelines", icon: GitBranch },
      { title: "Entrevistas", url: "/meetings", icon: Calendar },
      { title: "Página de Carreiras", url: "/settings/portal", icon: Globe },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Inbox", url: "/inbox", icon: Mail },
      { title: "Templates de E-mail", url: "/settings/email-templates", icon: FileText },
      { title: "Notificações", url: "/settings/notifications", icon: Bell },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
      { title: "Dashboards", url: "/dashboards", icon: Activity },
    ],
  },
  {
    label: "Workspace (ERP)",
    items: [
      { title: "Equipe", url: "/settings/workspace-team", icon: UsersRound, need: "admin" },
      { title: "Papéis & Permissões", url: "/settings/roles", icon: ShieldCheck, need: "admin" },
      { title: "Planos & Cobrança", url: "/settings/billing", icon: CreditCard, need: "admin" },
      { title: "Idioma", url: "/settings/language", icon: Languages },
      { title: "Integrações", url: "/integrations", icon: Plug },
      { title: "API Keys", url: "/settings/api-keys", icon: KeyRound, need: "admin" },
      { title: "Workflows", url: "/settings/workflows", icon: Workflow, need: "admin" },
    ],
  },
];
