// Menu lateral do módulo TechContracts.
// Renderizado pelo AppSidebar quando `activeModule === 'contracts'`.
// /services é uma visão de execução/faturamento consumida por Contratos.
import { FileStack, FileText, Package } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const CONTRACTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Contratos",
    items: [
      { title: "Contratos", url: "/contracts", icon: FileText },
      { title: "Modelos de contrato", url: "/contracts/templates", icon: FileStack },
      { title: "Serviços em execução", url: "/services", icon: Package },
    ],
  },
];
