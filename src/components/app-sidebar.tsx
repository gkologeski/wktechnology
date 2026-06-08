import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserPlus, Users, Building2, Briefcase, PlayCircle,
  ListTodo, MessageSquare, StickyNote, MessageCircle, Megaphone, Mail,
  ChevronRight, Inbox, ShieldCheck, LifeBuoy, Star, Package, FileText,
  BarChart3, TrendingUp, Sparkles, Bug, Briefcase as BriefcaseIcon, Video,
  GitBranch, Sliders,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";


type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; section?: string };
type Group = { label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

// URLs visíveis apenas para admin (configuração estrutural e dados sensíveis).
const ADMIN_ONLY = new Set<string>([
  "/leads/import-hubspot",
]);
// URLs adicionais visíveis a admin+manager (automação, marketing, configuração comercial).
const MANAGER_PLUS = new Set<string>([
  "/reports", "/dashboards", "/analytics",
  "/campaigns/whatsapp", "/campaigns/email",
  "/prospecting/campaigns",
]);

// Jornada do usuário (Configurar saiu para o header → engrenagem):
// Trabalhar (operação) · Analisar · Engajar (saída ativa)
const groups: Group[] = [
  {
    label: "Trabalhar", icon: BriefcaseIcon, items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: UserPlus },
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Empresas", url: "/companies", icon: Building2 },
      { title: "Negócios", url: "/deals", icon: Briefcase },
      { title: "Tickets", url: "/tickets", icon: LifeBuoy },
      { title: "Tarefas", url: "/tasks", icon: ListTodo },
      { title: "Reuniões", url: "/meetings", icon: Video },
      { title: "Propostas", url: "/proposals", icon: FileText },
      { title: "Faturas", url: "/invoices", icon: FileText },
      { title: "Inbox unificada", url: "/inbox", icon: Inbox },
      { title: "Inbox de Email", url: "/inbox/email", icon: Mail },
      { title: "Inbox de WhatsApp", url: "/inbox/whatsapp", icon: MessageCircle },
      { title: "Chat ao vivo", url: "/inbox/chat", icon: MessageSquare },
      { title: "Comunicações", url: "/communications", icon: MessageSquare },
      { title: "Notas", url: "/notes", icon: StickyNote },
    ],
  },
  {
    label: "Analisar", icon: BarChart3, items: [
      { title: "Dashboards", url: "/dashboards", icon: LayoutDashboard },
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
      { title: "Analytics", url: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Engajar", icon: Megaphone, items: [
      { title: "Campanhas WhatsApp", url: "/campaigns/whatsapp", icon: Megaphone },
      { title: "Campanhas Email", url: "/campaigns/email", icon: Mail },
      { title: "Landing Pages", url: "/landing-pages", icon: FileText },
      { title: "Prospecção por voz", url: "/prospecting/campaigns", icon: PlayCircle },
      { title: "Agente SDR", url: "/agents/sdr", icon: Sparkles },
      { title: "Pesquisas", url: "/settings/surveys", icon: Star },
    ],
  },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useMyRole();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const isActive = (url: string) => path === url || path.startsWith(url + "/");
  const canSee = (url: string) => {
    if (ADMIN_ONLY.has(url)) return isAdmin;
    if (MANAGER_PLUS.has(url)) return isManager;
    return true;
  };
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i.url)) }))
    .filter((g) => g.items.length > 0);
  const groupHasActive = (g: Group) => g.items.some((i) => isActive(i.url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 gap-2">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm">C</div>
          <span className="group-data-[collapsible=icon]:hidden">TechSales CRM</span>
        </Link>
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => {
          let lastSection: string | undefined;
          return (
            <Collapsible key={group.label} defaultOpen={groupHasActive(group)} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((it) => {
                        const showSection = it.section && it.section !== lastSection;
                        if (it.section) lastSection = it.section;
                        return (
                          <div key={it.url}>
                            {showSection && (
                              <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                                {it.section}
                              </div>
                            )}
                            <SidebarMenuItem>
                              <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                                <Link to={it.url}>
                                  <it.icon className="h-4 w-4" />
                                  <span>{it.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          </div>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="gap-1">
        <SidebarMenu>
          {isPlatformAdmin && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Super-admin" isActive={path.startsWith("/admin/workspaces")}>
                  <Link to="/admin/workspaces">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Super-admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Status" isActive={path.startsWith("/admin/status")}>
                  <Link to="/admin/status">
                    <BarChart3 className="h-4 w-4" />
                    <span>Status</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Alertas" isActive={path.startsWith("/admin/alerts")}>
                  <Link to="/admin/alerts">
                    <Sparkles className="h-4 w-4" />
                    <span>Alertas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Quotas" isActive={path.startsWith("/admin/quotas")}>
                  <Link to="/admin/quotas">
                    <Sliders className="h-4 w-4" />
                    <span>Quotas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Sandbox" isActive={path.startsWith("/admin/sandbox")}>
                  <Link to="/admin/sandbox">
                    <GitBranch className="h-4 w-4" />
                    <span>Sandbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Chamados" isActive={path.startsWith("/admin/bug-reports")}>
                  <Link to="/admin/bug-reports">
                    <Bug className="h-4 w-4" />
                    <span>Chamados</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
