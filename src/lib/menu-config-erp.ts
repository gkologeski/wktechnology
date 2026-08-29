// Menu neutro exibido no shell do Workspace/ERP Home (paths /home, /workspace, /settings, ...).
// Não pertence a nenhum módulo — apresenta apenas atalhos administrativos primários.
// Itens administrativos detalhados (Membros, Controle de acesso, Billing, etc.) vivem
// em /settings, para não duplicar entre Sidebar, Home e Configurações.
import {
  Home,
  Store,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Users,
  UsersRound,
  FolderOpen,
  Boxes,
} from "lucide-react";

import type { SidebarGroup } from "@/lib/menu-config";

export const ERP_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "ERP",
    items: [
      { title: "Home", url: "/home", icon: Home },
      { title: "Módulos", url: "/modules", icon: Boxes },
      { title: "Arquivos", url: "/files", icon: FolderOpen },
      { title: "Marketplace", url: "/settings/marketplace", icon: Store },
      { title: "Faturas", url: "/invoices", icon: Receipt },
    ],
  },

  {
    label: "Workspace",
    items: [
      {
        title: "Controle de acesso",
        url: "/settings/teams",
        icon: ShieldCheck,
        children: [
          { title: "Membros", url: "/settings/teams", icon: Users },
          { title: "Times", url: "/settings/user-groups", icon: UsersRound },
          { title: "Permissões", url: "/settings/permissions", icon: Shield },
          { title: "Diagnóstico de acesso", url: "/settings/rbac-diagnostics", icon: Shield },
        ],
      },
      { title: "Configurações", url: "/settings", icon: SettingsIcon },
    ],
  },
];

export const WORKSPACE_ROUTE_PREFIXES: readonly string[] = [
  "/home",
  "/modules",
  "/workspace",
  "/settings",
  "/account",
  "/admin",
  "/marketplace",
  "/settings/marketplace",
  "/invoices",
  "/files",
];

export function isWorkspacePathname(pathname: string): boolean {
  return WORKSPACE_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
