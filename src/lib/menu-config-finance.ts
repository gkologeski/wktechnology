// Menu lateral do módulo TechFinance.
// Renderizado pelo AppSidebar quando `activeModule === 'finance'`.
import { DollarSign, FileText, BarChart3, TrendingUp } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Financeiro",
    items: [
      { title: "Visão geral", url: "/finance", icon: DollarSign, need: "manager" },
      { title: "A receber", url: "/finance/receivable", icon: DollarSign, need: "manager" },
      { title: "A pagar", url: "/finance/payable", icon: DollarSign, need: "manager" },
      { title: "DRE gerencial", url: "/finance/dre", icon: BarChart3, need: "manager" },
      { title: "Fluxo de caixa", url: "/finance/cash-flow", icon: TrendingUp, need: "manager" },
      { title: "Categorias", url: "/finance/categories", icon: DollarSign, need: "manager" },
      { title: "Contas bancárias", url: "/finance/bank-accounts", icon: DollarSign, need: "manager" },
      { title: "Faturas", url: "/invoices", icon: FileText },
    ],
  },
];
