// Menu lateral do módulo TechFinance.
// Renderizado pelo AppSidebar quando `activeModule === 'finance'`.
import {
  DollarSign,
  FileText,
  BarChart3,
  TrendingUp,
  Receipt,
  Landmark,
  Repeat,
  Building2,
  FolderTree,
  ShieldCheck,
  Bell,
  Mail,
  Package,
} from "lucide-react";
import { MENU_PERMISSIONS, type SidebarGroup } from "@/lib/menu-config";

const view = (r: string) => ["workspace", "team", "own"].map((s) => `techfinance.${r}.view.${s}`);

export const FINANCE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        title: "Dashboard",
        url: "/finance",
        icon: DollarSign,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeOverview,
      },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        title: "A receber",
        url: "/finance/receivable",
        icon: DollarSign,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeReceivable,
      },
      {
        title: "A pagar",
        url: "/finance/payable",
        icon: DollarSign,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financePayable,
      },
      {
        title: "Recorrências",
        url: "/finance/recurrences",
        icon: Repeat,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeRecurrences,
      },
      {
        title: "DRE gerencial",
        url: "/finance/dre",
        icon: BarChart3,
        need: "manager",
        permissionAny: view("reports"),
      },
      {
        title: "Fluxo de caixa",
        url: "/finance/cash-flow",
        icon: TrendingUp,
        need: "manager",
        permissionAny: view("reports"),
      },
      {
        title: "Plano de contas",
        url: "/finance/categories",
        icon: DollarSign,
        need: "manager",
        permissionAny: view("categories"),
      },
      {
        title: "Centros de custo",
        url: "/finance/cost-centers",
        icon: FolderTree,
        need: "manager",
        permissionAny: view("cost_centers"),
      },
      {
        title: "Empresas (CNPJs)",
        url: "/finance/legal-entities",
        icon: Building2,
        need: "admin",
        permissionAny: view("legal_entities"),
      },
      {
        title: "Grupos empresariais",
        url: "/finance/legal-entity-groups",
        icon: Building2,
        need: "admin",
        permissionAny: view("legal_entity_groups"),
      },
      {
        title: "Contas bancárias",
        url: "/finance/bank-accounts",
        icon: DollarSign,
        need: "manager",
        permissionAny: view("bank_accounts"),
      },
      {
        title: "Banco Inter",
        url: "/finance/banking",
        icon: Landmark,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeBanking,
      },
      {
        title: "Conciliação",
        url: "/finance/banking/reconciliation",
        icon: Landmark,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeBanking,
      },

      {
        title: "Faturas",
        url: "/invoices",
        icon: FileText,
        permissionAny: [
          ...view("invoices"),
          ...["workspace", "team", "own"].map((s) => `techsales.invoices.view.${s}`),
        ],
      },
      {
        title: "Faturamento de Serviços",
        url: "/services",
        icon: Package,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.financeReceivable,
      },
      {
        title: "NFS-e",
        url: "/finance/nfse",
        icon: Receipt,
        need: "manager",
        permissionAny: view("nfse"),
      },
      {
        title: "Auditoria",
        url: "/finance/audit",
        icon: ShieldCheck,
        need: "admin",
        permissionAny: view("audit"),
      },
      {
        title: "Régua de cobrança",
        url: "/settings/dunning",
        icon: Bell,
        need: "manager",
        permissionAny: view("dunning"),
      },
      {
        title: "Templates de cobrança",
        url: "/settings/charging-templates",
        icon: Mail,
        need: "manager",
        permissionAny: view("charging_templates"),
      },
    ],
  },
];
