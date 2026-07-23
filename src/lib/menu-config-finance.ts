// Menu lateral do módulo TechFinance.
// Renderizado pelo AppSidebar quando `activeModule === 'finance'`.
import { DollarSign, FileText, BarChart3, TrendingUp, Receipt, Landmark, Repeat, Building2, FolderTree, ShieldCheck, Bell, Mail, Package } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Financeiro",
    items: [
      { title: "Visão geral", url: "/finance", icon: DollarSign, need: "manager" },
      { title: "A receber", url: "/finance/receivable", icon: DollarSign, need: "manager" },
      { title: "A pagar", url: "/finance/payable", icon: DollarSign, need: "manager" },
      { title: "Recorrências", url: "/finance/recurrences", icon: Repeat, need: "manager" },
      { title: "DRE gerencial", url: "/finance/dre", icon: BarChart3, need: "manager" },
      { title: "Fluxo de caixa", url: "/finance/cash-flow", icon: TrendingUp, need: "manager" },
      { title: "Plano de contas", url: "/finance/categories", icon: DollarSign, need: "manager" },
      { title: "Centros de custo", url: "/finance/cost-centers", icon: FolderTree, need: "manager" },
      { title: "Empresas (CNPJs)", url: "/finance/legal-entities", icon: Building2, need: "admin" },
      { title: "Grupos empresariais", url: "/finance/legal-entity-groups", icon: Building2, need: "admin" },
      { title: "Contas bancárias", url: "/finance/bank-accounts", icon: DollarSign, need: "manager" },
      { title: "Banco Inter", url: "/finance/banking", icon: Landmark, need: "manager" },
      { title: "Conciliação", url: "/finance/banking/reconciliation", icon: Landmark, need: "manager" },

      { title: "Faturas", url: "/invoices", icon: FileText },
      { title: "Faturamento de Serviços", url: "/services", icon: Package, need: "manager" },
      { title: "NFS-e", url: "/finance/nfse", icon: Receipt, need: "manager" },
      { title: "Auditoria", url: "/finance/audit", icon: ShieldCheck, need: "admin" },
      { title: "Régua de cobrança", url: "/settings/dunning", icon: Bell, need: "manager" },
      { title: "Templates de cobrança", url: "/settings/charging-templates", icon: Mail, need: "manager" },
    ],
  },
];



