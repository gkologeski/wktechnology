import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserPlus, Users, Building2, Briefcase, Settings, LogOut, Plug,
  ListTodo, MessageSquare, StickyNote, MessageCircle, Megaphone, Mail, PlayCircle,
  Workflow, Repeat, Target, BookOpen, GitBranch, Filter, Send, ChevronRight, Inbox, Shuffle, Timer, ShieldCheck, UsersRound, ScrollText, KeyRound, Sliders, LifeBuoy, Wand2, Star, ExternalLink, Package, FileText, PenLine, BarChart3, TrendingUp, Sparkles, Calendar, CalendarDays,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";

import { useMyRole } from "@/lib/use-my-role";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

// URLs visíveis apenas para admin (configuração estrutural e dados sensíveis).
const ADMIN_ONLY = new Set<string>([
  "/settings/roles", "/settings/teams", "/settings/api-keys", "/settings/webhooks",
  "/settings/audit-log", "/settings/security", "/settings/hubspot-sync",
  "/settings/branding", "/settings/custom-objects", "/settings/custom-properties",
  "/settings/pipelines", "/integrations", "/settings/email", "/leads/import-hubspot",
  "/settings/mobile", "/settings/language",
]);
// URLs adicionais visíveis a admin+manager (automação, marketing, configuração comercial).
const MANAGER_PLUS = new Set<string>([
  "/settings/workflows", "/settings/sequences", "/settings/rotation", "/settings/sla",
  "/settings/scoring", "/settings/playbooks", "/settings/goals", "/settings/exports",
  "/settings/enrichment", "/settings/products", "/settings/quotes", "/settings/esign",
  "/settings/recurring", "/settings/macros", "/settings/surveys", "/settings/portal",
  "/settings/forms", "/settings/prospecting", "/settings/subscriptions",
  "/settings/email-templates", "/settings/segments", "/settings/calendars",
  "/settings/booking", "/reports", "/dashboards", "/analytics",
  "/campaigns/whatsapp", "/campaigns/email",
]);

const groups: Group[] = [
  {
    label: "Análises", icon: BarChart3, items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Dashboards", url: "/dashboards", icon: LayoutDashboard },
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
      { title: "Analytics", url: "/analytics", icon: TrendingUp },
      { title: "Metas", url: "/settings/goals", icon: Target },
      { title: "Exports agendados", url: "/settings/exports", icon: Send },
      { title: "Enriquecimento", url: "/settings/enrichment", icon: Sparkles },
      { title: "Calendários", url: "/settings/calendars", icon: Calendar },
      { title: "Agendamentos", url: "/settings/booking", icon: CalendarDays },
    ],
  },
  {
    label: "CRM", icon: Users, items: [
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
    label: "Vendas", icon: Briefcase, items: [
      { title: "Produtos", url: "/settings/products", icon: Package },
      { title: "Cotações", url: "/settings/quotes", icon: FileText },
      { title: "Assinaturas eletrônicas", url: "/settings/esign", icon: PenLine },
      { title: "Recorrência", url: "/settings/recurring", icon: Repeat },
    ],
  },
  {
    label: "Suporte", icon: LifeBuoy, items: [
      { title: "Tickets", url: "/tickets", icon: LifeBuoy },
      { title: "Macros", url: "/settings/macros", icon: Wand2 },
      { title: "Pesquisas", url: "/settings/surveys", icon: Star },
      { title: "Portal do cliente", url: "/settings/portal", icon: ExternalLink },
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
      { title: "Campanhas Email", url: "/campaigns/email", icon: Mail },
      { title: "Templates de email", url: "/settings/email-templates", icon: Send },
      { title: "Formulários", url: "/settings/forms", icon: FileText },
      { title: "Prospecting", url: "/settings/prospecting", icon: Sparkles },
      { title: "Tipos de assinatura", url: "/settings/subscriptions", icon: Mail },
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
    label: "Configuração", icon: Settings, items: [
      { title: "Pipelines", url: "/settings/pipelines", icon: GitBranch },
      { title: "Propriedades", url: "/settings/custom-properties", icon: Sliders },
      { title: "Usuários", url: "/settings/teams", icon: UsersRound },
      { title: "Permissões", url: "/settings/roles", icon: ShieldCheck },
      { title: "Auditoria", url: "/settings/audit-log", icon: ScrollText },
      { title: "Segurança (2FA)", url: "/settings/security", icon: KeyRound },
      { title: "Conexão de Email", url: "/settings/email", icon: Mail },
      { title: "Integrações", url: "/integrations", icon: Plug },
      { title: "API Keys", url: "/settings/api-keys", icon: KeyRound },
      { title: "Webhooks", url: "/settings/webhooks", icon: Plug },
      { title: "Sync HubSpot", url: "/settings/hubspot-sync", icon: Plug },
      { title: "Objetos custom", url: "/settings/custom-objects", icon: Sliders },
      { title: "Mobile / PWA", url: "/settings/mobile", icon: Settings },
      { title: "Idioma", url: "/settings/language", icon: Settings },
      { title: "White-label", url: "/settings/branding", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useMyRole();
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
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm">C</div>
          <span className="group-data-[collapsible=icon]:hidden">CRM</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
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
