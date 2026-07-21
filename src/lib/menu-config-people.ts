// Menu lateral do módulo TechPeople.
import {
  Users,
  UserCog,
  FileCheck2,
  Receipt,
  TrendingUp,
  BarChart3,
  LayoutTemplate,
} from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PEOPLE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Pessoas",
    items: [
      { title: "Pessoas", url: "/people", icon: Users },
      { title: "Meu time", url: "/people/my-team", icon: UserCog },
      { title: "Documentos a vencer", url: "/people/documents", icon: FileCheck2, need: "manager" },
      { title: "Faturamento de horas", url: "/people/billing", icon: Receipt, need: "manager" },
      { title: "Margem por contrato", url: "/people/contract-margin", icon: TrendingUp, need: "manager" },
      { title: "Analytics", url: "/people/analytics", icon: BarChart3, need: "manager" },
      { title: "Modelos de onboarding", url: "/people/onboarding-templates", icon: LayoutTemplate, need: "manager" },
    ],
  },
];

