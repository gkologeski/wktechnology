// Menu lateral do módulo TechProjects.
// Renderizado pelo AppSidebar quando `activeModule === 'projects'`.
import {
  Kanban,
  ListTodo,
  LayoutGrid,
  Clock,
  Coins,
  Sparkles,
  Timer,
  CheckCheck,
  LayoutDashboard,
  Download,
  ShieldCheck,
  Handshake,
  Activity,
} from "lucide-react";
import type { SidebarGroup } from "@/lib/menu-config";

export const PROJECTS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Visão geral",
    items: [
      {
        title: "Dashboard",
        url: "/projects/dashboard",
        icon: LayoutDashboard,
        permissionAny: [
          "techprojects.projects.view.own",
          "techprojects.projects.view.team",
          "techprojects.projects.view.workspace",
          "techprojects.tasks.view.own",
          "techprojects.tasks.view.team",
          "techprojects.tasks.view.workspace",
        ],
      },
    ],
  },
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
        permissionAny: [
          "techprojects.projects.view.own",
          "techprojects.projects.view.team",
          "techprojects.projects.view.workspace",
        ],
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
        // Líder/aprovador nomeado no projeto pode não ter papel de gestor: a fila só
        // mostra o que ele pode decidir (validado no banco).
        permissionAny: [
          "techprojects.time_entries.approve.workspace",
          "techprojects.timesheet.approve.workspace",
          "techprojects.time_entries.view.own",
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
  {
    label: "Configurações",
    items: [
      {
        title: "Importar do Clockify",
        url: "/projects/settings/imports/clockify",
        need: "admin",
        icon: Download,
      },
      {
        title: "Importar do Jibble",
        url: "/projects/settings/imports/jibble",
        need: "admin",
        icon: Download,
      },
      {
        title: "Conciliação de horas",
        url: "/projects/settings/imports/reconciliation",
        need: "admin",
        icon: ShieldCheck,
      },
      {
        title: "Entrega de negócios",
        url: "/projects/settings/delivery",
        need: "admin",
        icon: Handshake,
      },
      {
        title: "Política de horas e modelos",
        url: "/projects/settings/time",
        need: "admin",
        icon: Clock,
      },
      {
        title: "Tarifas e custos",
        url: "/projects/settings/rates",
        need: "admin",
        icon: Coins,
      },
      {
        title: "Operação e saúde",
        url: "/projects/settings/operations",
        need: "admin",
        icon: Activity,
      },
    ],
  },
];
