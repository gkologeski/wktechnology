// Menu neutro exibido no shell do Workspace/ERP Home (paths /home, /workspace, /settings, ...).
// Não pertence a nenhum módulo — apresenta apenas atalhos administrativos.
import { Home, Users2, Store, Receipt, Settings as SettingsIcon, Shield } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const ERP_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "ERP",
    items: [
      { title: "Home", url: "/home", icon: Home },
      { title: "Marketplace", url: "/marketplace", icon: Store },
      { title: "Faturas", url: "/invoices", icon: Receipt },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Membros", url: "/workspace/members", icon: Users2 },
      { title: "Configurações", url: "/settings", icon: SettingsIcon },
      { title: "Controle de acesso", url: "/home/access", icon: Shield },
    ],
  },
];

export const WORKSPACE_ROUTE_PREFIXES: readonly string[] = [
  "/home",
  "/workspace",
  "/settings",
  "/account",
  "/admin",
  "/marketplace",
  "/invoices",
];

export function isWorkspacePathname(pathname: string): boolean {
  return WORKSPACE_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
