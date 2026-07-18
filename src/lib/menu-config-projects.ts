// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import { Kanban, ListTodo, LayoutGrid } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Projetos",
    items: [
      // Sprint C - Fase 4.2: hub de Espaços/Pastas/Listas (estilo ClickUp).
      { title: "Espaços", url: "/projects/spaces", icon: LayoutGrid },
      { title: "Projetos", url: "/projects", icon: Kanban },
      { title: "Tarefas", url: "/projects/tasks", icon: ListTodo },
    ],
  },
];
