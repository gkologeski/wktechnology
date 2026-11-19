// Menu lateral do módulo TechContracts.
// Renderizado pelo AppSidebar quando `activeModule === 'contracts'`.
// /services é uma visão de execução/faturamento consumida por Contratos.
import {
  FileStack,
  FileText,
  FileSignature,
  LayoutDashboard,
  Package,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const CONTRACTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Visão geral",
    items: [{ title: "Dashboard", url: "/contracts/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Contratos",
    items: [
      { title: "Contratos", url: "/contracts", icon: FileText },
      {
        title: "Contratação de fornecedores",
        url: "/contracts/supplier-requests",
        icon: Package,
        permissionAny: ["techcontracts.supplier_requests.view.workspace"],
      },
      { title: "Assinaturas eletrônicas", url: "/contracts/signatures", icon: FileSignature },
      { title: "Modelos de contrato", url: "/contracts/templates", icon: FileStack },
      { title: "Serviços em execução", url: "/services", icon: Package },
      {
        title: "Padrões de contrato",
        url: "/settings/contract-defaults",
        icon: SlidersHorizontal,
      },
      {
        title: "Fluxo de contratação",
        url: "/contracts/contracting-flow",
        icon: Scale,
      },
    ],
  },
];
