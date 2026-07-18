// Menu lateral do módulo TechContracts.
// Renderizado pelo AppSidebar quando `activeModule === 'contracts'`.
import { FileText } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const CONTRACTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Contratos",
    items: [
      { title: "Contratos", url: "/contracts", icon: FileText },
    ],
  },
];
