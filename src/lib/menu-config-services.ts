// Menu lateral do id legado `services` (não existe módulo "TechServices").
// `/services` é a visão operacional/faturamento do TechContracts; este grupo só
// é renderizado pelo AppSidebar se o id legado ainda estiver ativo no banco.
import { Package } from "lucide-react";
import { MENU_PERMISSIONS, type SidebarGroup } from "@/lib/menu-config";

export const SERVICES_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Serviços",
    items: [{ title: "Serviços", url: "/services", icon: Package }],
  },
];
