// Menu lateral do módulo TechFinance.
// Renderizado pelo AppSidebar quando `activeModule === 'finance'`.
import { DollarSign, FileText, BarChart3, TrendingUp, Receipt, Landmark, Repeat, Building2, FolderTree, ShieldCheck, Bell, Mail, Package } from "lucide-react";
import { MENU_PERMISSIONS, type SidebarGroup } from "@/lib/menu-config";

export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Financeiro",
    items: [
      { title: "Visão geral", url: "/finance", icon: DollarSign, need: "manager", permissionAny: MENU_PERMISSIONS.financeOverview },
      { title: "A receber", url: "/finance/receivable", icon: DollarSign, need: "manager", permissionAny: MENU_PERMISSIONS.financeReceivable },
      { title: "A pagar", url: "/finance/payable", icon: DollarSign, need: "manager", permissionAny: MENU_PERMISSIONS.financePayable },
      { title: "Recorrências", url: "/finance/recurrences", icon: Repeat, need: "manager", permissionAny: MENU_PERMISSIONS.financeRecurrences },
      { title: "DRE gerencial", url: "/finance/dre", icon: BarChart3, need: "manager", permissionAny: MENU_PERMISSIONS.financeOverview },
      { title: "Fluxo de caixa", url: "/finance/cash-flow", icon: TrendingUp, need: "manager", permissionAny: MENU_PERMISSIONS.financeOverview },
      { title: "Plano de contas", url: "/finance/categories", icon: DollarSign, need: "manager", permissionAny: MENU_PERMISSIONS.financeOverview },
      { title: "Centros de custo", url: "/finance/cost-centers", icon: FolderTree, need: "manager", permissionAny: MENU_PERMISSIONS.financeCostCenters },
      { title: "Empresas (CNPJs)", url: "/finance/legal-entities", icon: Building2, need: "admin" },
      { title: "Grupos empresariais", url: "/finance/legal-entity-groups", icon: Building2, need: "admin" },
      { title: "Contas bancárias", url: "/finance/bank-accounts", icon: DollarSign, need: "manager", permissionAny: MENU_PERMISSIONS.financeBanking },
      { title: "Banco Inter", url: "/finance/banking", icon: Landmark, need: "manager", permissionAny: MENU_PERMISSIONS.financeBanking },
      { title: "Conciliação", url: "/finance/banking/reconciliation", icon: Landmark, need: "manager", permissionAny: MENU_PERMISSIONS.financeBanking },

      { title: "Faturas", url: "/invoices", icon: FileText },
      { title: "Faturamento de Serviços", url: "/services", icon: Package, need: "manager", permissionAny: MENU_PERMISSIONS.financeReceivable },
      { title: "NFS-e", url: "/finance/nfse", icon: Receipt, need: "manager", permissionAny: MENU_PERMISSIONS.financeNfse },
      { title: "Auditoria", url: "/finance/audit", icon: ShieldCheck, need: "admin" },
      { title: "Régua de cobrança", url: "/settings/dunning", icon: Bell, need: "manager", permissionAny: MENU_PERMISSIONS.financeDunning },
      { title: "Templates de cobrança", url: "/settings/charging-templates", icon: Mail, need: "manager", permissionAny: MENU_PERMISSIONS.financeDunning },
    ],
  },
];



