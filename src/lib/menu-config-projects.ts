// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import { Kanban, ListTodo, ListChecks } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Projetos",
    items: [
      { title: "Projetos", url: "/projects", icon: Kanban },
      {
        title: "Tarefas",
        url: "/tasks",
        icon: ListTodo,
        children: [{ title: "Filas", url: "/tasks/queues", icon: ListChecks }],
      },
    ],
  },
];
