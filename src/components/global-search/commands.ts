import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Ticket,
  UserPlus,
  Briefcase,
  Settings,
  Shield,
  Home,
} from "lucide-react";

export type QuickCommand = {
  id: string;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  to: string;
  group: "Navegar" | "Criar" | "Configurar";
};

export const QUICK_COMMANDS: QuickCommand[] = [
  { id: "nav-home", label: "Ir para TechERP Home", keywords: ["home", "erp"], icon: Home, to: "/home", group: "Navegar" },
  { id: "nav-dashboard", label: "Dashboard TechSales", keywords: ["dashboard", "sales", "crm"], icon: LayoutDashboard, to: "/dashboard", group: "Navegar" },
  { id: "nav-ats-dashboard", label: "Dashboard TechHire", keywords: ["ats", "recrutamento"], icon: LayoutDashboard, to: "/ats-dashboard", group: "Navegar" },
  { id: "nav-contacts", label: "Contatos", keywords: ["contatos", "pessoas"], icon: Users, to: "/contacts", group: "Navegar" },
  { id: "nav-companies", label: "Empresas", keywords: ["empresas", "contas"], icon: Building2, to: "/companies", group: "Navegar" },
  { id: "nav-deals", label: "Negócios", keywords: ["negocios", "deals", "pipeline"], icon: Handshake, to: "/deals", group: "Navegar" },
  { id: "nav-tickets", label: "Tickets", keywords: ["tickets", "chamados", "suporte"], icon: Ticket, to: "/tickets", group: "Navegar" },
  { id: "nav-candidates", label: "Candidatos", keywords: ["candidatos", "talentos"], icon: UserPlus, to: "/candidates", group: "Navegar" },
  { id: "nav-jobs", label: "Vagas", keywords: ["vagas", "jobs"], icon: Briefcase, to: "/jobs", group: "Navegar" },
  { id: "nav-settings", label: "Configurações", keywords: ["configuracoes", "settings"], icon: Settings, to: "/settings", group: "Configurar" },
  { id: "nav-access", label: "Controle de Acesso", keywords: ["permissoes", "cargos", "acesso"], icon: Shield, to: "/home/access", group: "Configurar" },
];
