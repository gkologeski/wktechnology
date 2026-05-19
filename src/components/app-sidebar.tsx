import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserPlus, Users, Building2, Briefcase, Settings, LogOut, Plug,
  ListTodo, MessageSquare, StickyNote, MessageCircle, Megaphone, Mail, PlayCircle,
  Workflow, Repeat, Target, BookOpen, GitBranch, Filter, Send, ChevronRight, Inbox, Shuffle, Timer,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

const groups: Group[] = [
  {
    label: "CRM", icon: Users, items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: UserPlus },
      { title: "Contatos", url: "/contacts", icon: Users },
      { title: "Empresas", url: "/companies", icon: Building2 },
      { title: "Negócios", url: "/deals", icon: Briefcase },
      { title: "Tarefas", url: "/tasks", icon: ListTodo },
      { title: "Filas de tarefas", url: "/tasks/queues", icon: PlayCircle },
      { title: "Listas", url: "/settings/segments", icon: Filter },
    ],
  },
  {
    label: "Caixa de entrada", icon: Inbox, items: [
      { title: "Comunicações", url: "/communications", icon: MessageSquare },
      { title: "Email", url: "/inbox/email", icon: Mail },
      { title: "WhatsApp", url: "/inbox/whatsapp", icon: MessageCircle },
      { title: "Notas", url: "/notes", icon: StickyNote },
    ],
  },
  {
    label: "Marketing", icon: Megaphone, items: [
      { title: "Campanhas WhatsApp", url: "/campaigns/whatsapp", icon: Megaphone },
      { title: "Templates de email", url: "/settings/email-templates", icon: Send },
      { title: "Assinaturas", url: "/settings/subscriptions", icon: Mail },
    ],
  },
  {
    label: "Automações", icon: Workflow, items: [
      { title: "Workflows", url: "/settings/workflows", icon: Workflow },
      { title: "Sequências", url: "/settings/sequences", icon: Repeat },
      { title: "Distribuição", url: "/settings/rotation", icon: Shuffle },
      { title: "SLA por etapa", url: "/settings/sla", icon: Timer },
      { title: "Pontuação", url: "/settings/scoring", icon: Target },
      { title: "Playbooks", url: "/settings/playbooks", icon: BookOpen },
    ],
  },
  {
    label: "Dados", icon: GitBranch, items: [
      { title: "Pipelines", url: "/settings/pipelines", icon: GitBranch },
      { title: "Integrações", url: "/integrations", icon: Plug },
    ],
  },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const isActive = (url: string) => path === url || path.startsWith(url + "/");
  const groupHasActive = (g: Group) => g.items.some((i) => isActive(i.url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm">C</div>
          <span className="group-data-[collapsible=icon]:hidden">CRM</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
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
                    {group.items.map((it) => (
                      <SidebarMenuItem key={it.url}>
                        <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                          <Link to={it.url}>
                            <it.icon className="h-4 w-4" />
                            <span>{it.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações" isActive={path === "/settings"}>
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span className="truncate">{user?.email ?? "Sair"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
