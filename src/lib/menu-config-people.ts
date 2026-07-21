// Menu lateral do módulo TechPeople.
import { Users, UserCog, FileCheck2, Receipt } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PEOPLE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Pessoas",
    items: [
      { title: "Pessoas", url: "/people", icon: Users },
      { title: "Meu time", url: "/people/my-team", icon: UserCog },
      { title: "Documentos a vencer", url: "/people/documents", icon: FileCheck2, need: "manager" },
      { title: "Faturamento de horas", url: "/people/billing", icon: Receipt, need: "manager" },
    ],
  },
];

