// Menu lateral do módulo TechPeople.
import {
  Users,
  UserCog,
  FileCheck2,
  Receipt,
  TrendingUp,
  BarChart3,
  LayoutTemplate,
  Brain,
  ShieldAlert,
  HeartHandshake,
  ClipboardList,
  UserMinus,
  FileUp,
} from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PEOPLE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Pessoas",
    items: [
      { title: "Pessoas", url: "/people", icon: Users },
      { title: "Meu time", url: "/people/my-team", icon: UserCog },
      { title: "Onboarding", url: "/people/onboarding", icon: ClipboardList, need: "manager" },
      { title: "Offboarding", url: "/people/offboarding", icon: UserMinus, need: "manager" },
      { title: "Documentos a vencer", url: "/people/documents", icon: FileCheck2, need: "manager" },
      { title: "Modelos de onboarding", url: "/people/onboarding-templates", icon: LayoutTemplate, need: "manager" },
      { title: "Importar do Google Forms", url: "/people/import-forms", icon: FileUp, need: "manager" },
    ],
  },
  {
    label: "Saúde & segurança",
    items: [
      { title: "Riscos psicossociais", url: "/people/psychosocial", icon: Brain, need: "manager" },
      { title: "Incidentes", url: "/people/incidents", icon: ShieldAlert, need: "manager" },
    ],
  },
  {
    label: "Benefícios & custos",
    items: [
      { title: "Benefícios", url: "/people/benefits", icon: HeartHandshake, need: "manager" },
      { title: "Faturamento de horas", url: "/people/billing", icon: Receipt, need: "manager" },
      { title: "Margem por contrato", url: "/people/contract-margin", icon: TrendingUp, need: "manager" },
      { title: "Analytics", url: "/people/analytics", icon: BarChart3, need: "manager" },
    ],
  },
];
