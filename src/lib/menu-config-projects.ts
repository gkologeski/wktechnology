// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import { Kanban, ListTodo, LayoutGrid, Clock, Sparkles, Timer, CheckCheck } from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Projetos",
    items: [
      {
        title: "My Work",
        url: "/projects/my-work",
        icon: Sparkles,
        permissionAny: [
          "techprojects.my_work.view.own",
          "techprojects.my_work.view.team",
          "techprojects.my_work.view.workspace",
        ],
      },
      {
        title: "Espaços",
        url: "/projects/spaces",
        need: "manager",
        icon: LayoutGrid,
        permissionAny: ["techprojects.spaces.view.team", "techprojects.spaces.view.workspace"],
      },
      {
        title: "Projetos",
        url: "/projects",
        need: "manager",
        icon: Kanban,
        permissionAny: ["techprojects.projects.view.team", "techprojects.projects.view.workspace"],
      },
      {
        title: "Tarefas",
        url: "/projects/tasks",
        icon: ListTodo,
        permissionAny: [
          "techprojects.tasks.view.own",
          "techprojects.tasks.view.team",
          "techprojects.tasks.view.workspace",
        ],
      },
    ],
  },
  {
    label: "Horas",
    items: [
      {
        title: "Minhas Horas",
        url: "/projects/my-hours",
        icon: Timer,
        permissionAny: [
          "techprojects.time_entries.view.own",
          "techprojects.time_entries.view.workspace",
        ],
      },
      {
        title: "Revisão de Horas",
        url: "/projects/hours-review",
        need: "manager",
        icon: CheckCheck,
        permissionAny: [
          "techprojects.time_entries.approve.workspace",
          "techprojects.timesheet.approve.workspace",
        ],
      },
      {
        title: "Timesheet",
        url: "/projects/timesheet",
        need: "manager",
        icon: Clock,
        permissionAny: [
          "techprojects.timesheet.view.team",
          "techprojects.timesheet.view.workspace",
        ],
      },
    ],
  },
];
