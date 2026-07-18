// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import { Kanban, ListTodo } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Projetos",
    items: [
      { title: "Projetos", url: "/projects", icon: Kanban },
      // Sprint C — Fase 4.1: aponta para `project_tasks` (domínio Projects),
      // não para `/tasks` (que é `activities` do TechSales).
      { title: "Tarefas", url: "/projects/tasks", icon: ListTodo },
    ],
  },
];
