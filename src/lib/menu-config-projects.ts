// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import { Kanban, ListTodo, LayoutGrid, Clock, Sparkles, Timer, CheckCheck } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Projetos",
    items: [
      { title: "My Work", url: "/projects/my-work", icon: Sparkles },
      { title: "Espaços", url: "/projects/spaces", icon: LayoutGrid },
      { title: "Projetos", url: "/projects", icon: Kanban },
      { title: "Tarefas", url: "/projects/tasks", icon: ListTodo },
    ],
  },
  {
    label: "Horas",
    items: [
      { title: "Minhas Horas", url: "/projects/my-hours", icon: Timer },
      { title: "Revisão de Horas", url: "/projects/hours-review", icon: CheckCheck },
      { title: "Timesheet", url: "/projects/timesheet", icon: Clock },
    ],
  },
];
