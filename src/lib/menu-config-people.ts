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
  LayoutDashboard,
} from "lucide-react";
import { MENU_PERMISSIONS, type SidebarGroup } from "@/lib/menu-config";

export const PEOPLE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Visão geral",
    items: [{ title: "Dashboard", url: "/people/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Pessoas",
    items: [
      {
        title: "Pessoas",
        url: "/people",
        icon: Users,
        permissionAny: [
          "techpeople.people.view.workspace",
          "techpeople.people.view.team",
          "techpeople.people.view.own",
        ],
      },
      { title: "Meu time", url: "/people/my-team", icon: UserCog },
      {
        title: "Onboarding",
        url: "/people/onboarding",
        icon: ClipboardList,
        need: "manager",
        permissionAny: [
          "techpeople.onboarding.view.workspace",
          "techpeople.onboarding.view.team",
          "techpeople.onboarding.view.own",
        ],
      },
      {
        title: "Offboarding",
        url: "/people/offboarding",
        icon: UserMinus,
        need: "manager",
        permissionAny: [
          "techpeople.offboarding.view.workspace",
          "techpeople.offboarding.view.team",
          "techpeople.offboarding.view.own",
        ],
      },
      {
        title: "Documentos a vencer",
        url: "/people/documents",
        icon: FileCheck2,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleDocuments,
      },
      {
        title: "Modelos de onboarding",
        url: "/people/onboarding-templates",
        icon: LayoutTemplate,
        need: "manager",
        permissionAny: [
          "techpeople.onboarding_templates.view.workspace",
          "techpeople.onboarding_templates.view.team",
          "techpeople.onboarding_templates.view.own",
        ],
      },
      {
        title: "Importar do Google Forms",
        url: "/people/import-forms",
        icon: FileUp,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleImport,
      },
    ],
  },
  {
    label: "Saúde & segurança",
    items: [
      {
        title: "Riscos psicossociais",
        url: "/people/psychosocial",
        icon: Brain,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleWellbeingAssessments,
      },
      {
        title: "Incidentes",
        url: "/people/incidents",
        icon: ShieldAlert,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleWellbeingIncidents,
      },
    ],
  },
  {
    label: "Benefícios & custos",
    items: [
      {
        title: "Benefícios",
        url: "/people/benefits",
        icon: HeartHandshake,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleBenefits,
      },
      {
        title: "Faturamento de horas",
        url: "/people/billing",
        icon: Receipt,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleTimesheet,
      },
      {
        title: "Margem por contrato",
        url: "/people/contract-margin",
        icon: TrendingUp,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleAllocations,
      },
      {
        title: "Analytics",
        url: "/people/analytics",
        icon: BarChart3,
        need: "manager",
        permissionAny: MENU_PERMISSIONS.peopleAllocations,
      },
    ],
  },
];
