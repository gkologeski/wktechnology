// Menu lateral do módulo TechServices.
// Renderizado pelo AppSidebar quando `activeModule === 'services'`.
import { Package } from "lucide-react";
import { MENU_PERMISSIONS, type SidebarGroup } from "@/lib/menu-config";

export const SERVICES_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Serviços",
    items: [{ title: "Serviços", url: "/services", icon: Package }],
  },
];
