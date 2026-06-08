import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserPlus, Users, Building2, Briefcase, Settings, LogOut, Plug,
  ListTodo, MessageSquare, StickyNote, MessageCircle, Megaphone, Mail, PlayCircle,
  Workflow, Repeat, Target, BookOpen, GitBranch, Filter, Send, ChevronRight, Inbox, Shuffle, Timer, ShieldCheck, UsersRound, ScrollText, KeyRound, Sliders, LifeBuoy, Wand2, Star, ExternalLink, Package, FileText, PenLine, BarChart3, TrendingUp, Sparkles, Calendar, CalendarDays, Bug, Briefcase as BriefcaseIcon, User as UserIcon, Video,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";

import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";


type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; section?: string };
type Group = { label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

// URLs visíveis apenas para admin (configuração estrutural e dados sensíveis).
const ADMIN_ONLY = new Set<string>([
  "/settings/roles", "/settings/teams", "/settings/api-keys", "/settings/webhooks",
  "/settings/audit-log", "/settings/hubspot-sync",
  "/settings/branding", "/settings/custom-objects", "/settings/custom-properties",
  "/settings/pipelines", "/integrations", "/marketplace",
  "/settings/mobile", "/settings/language", "/leads/import-hubspot",
]);
// URLs adicionais visíveis a admin+manager (automação, marketing, configuração comercial).
const MANAGER_PLUS = new Set<string>([
  "/settings/workflows", "/settings/sequences", "/settings/rotation", "/settings/sla",
  "/settings/scoring", "/settings/playbooks", "/settings/goals", "/settings/exports",
  "/settings/enrichment", "/settings/products", "/settings/quotes", "/settings/esign", "/settings/clauses",
  "/settings/payments", "/settings/dunning", "/settings/nfse",
  "/settings/recurring", "/settings/macros", "/settings/surveys", "/settings/portal",
  "/settings/kb", "/settings/widget",
  "/settings/forms", "/settings/prospecting", "/settings/subscriptions",
  "/settings/email-templates", "/settings/segments", "/settings/calendars",
  "/settings/booking", "/settings/lead-sources", "/reports", "/dashboards", "/analytics",
  "/campaigns/whatsapp", "/campaigns/email",
  "/prospecting/campaigns", "/settings/prospecting-scripts", "/settings/voice-agent",
  "/settings/notifications/slack", "/settings/zapier",
]);

// Proposta B — Jornada do usuário:
// Trabalhar (operação) · Analisar · Engajar (saída ativa) · Configurar (admin)
// Conta pessoal vai para o menu do avatar (rodapé).
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
      { title: "Listas", url: "/settings/segments", icon: Filter },
      { title: "Comunicações", url: "/communications", icon: MessageSquare },
      { title: "Inbox unificada", url: "/inbox", icon: Inbox },
      { title: "Inbox de Email", url: "/inbox/email", icon: Mail },
      { title: "Inbox de WhatsApp", url: "/inbox/whatsapp", icon: MessageCircle },
      { title: "Chat ao vivo", url: "/inbox/chat", icon: MessageSquare },
      { title: "Notas", url: "/notes", icon: StickyNote },
    ],
  },
  {
    label: "Analisar", icon: BarChart3, items: [
      { title: "Dashboards", url: "/dashboards", icon: LayoutDashboard },
      { title: "Relatórios", url: "/reports", icon: BarChart3 },
      { title: "Analytics", url: "/analytics", icon: TrendingUp },
      { title: "Metas", url: "/settings/goals", icon: Target },
      { title: "Exports agendados", url: "/settings/exports", icon: Send },
    ],
  },
  {
    label: "Engajar", icon: Megaphone, items: [
      { title: "Campanhas WhatsApp", url: "/campaigns/whatsapp", icon: Megaphone },
      { title: "Campanhas Email", url: "/campaigns/email", icon: Mail },
      { title: "Sequências", url: "/settings/sequences", icon: Repeat },
      { title: "Templates de email", url: "/settings/email-templates", icon: Send },
      { title: "Formulários", url: "/settings/forms", icon: FileText },
      { title: "Prospecting", url: "/settings/prospecting", icon: Sparkles },
      { title: "Prospecção por voz", url: "/prospecting/campaigns", icon: PlayCircle },
      { title: "Scripts de voz", url: "/settings/prospecting-scripts", icon: FileText },
      { title: "Agente de voz", url: "/settings/voice-agent", icon: Sliders },
      { title: "Macros", url: "/settings/macros", icon: Wand2 },
      { title: "Pesquisas", url: "/settings/surveys", icon: Star },
      { title: "Portal do cliente", url: "/settings/portal", icon: ExternalLink },
      { title: "Base de conhecimento", url: "/settings/kb", icon: BookOpen },
      { title: "Widget de chat", url: "/settings/widget", icon: MessageSquare },
      { title: "Tipos de assinatura", url: "/settings/subscriptions", icon: Mail },
    ],
  },
  {
    label: "Configurar", icon: Settings, items: [
      // Workspace
      { section: "Workspace", title: "White-label", url: "/settings/branding", icon: Sparkles },
      { section: "Workspace", title: "Idioma", url: "/settings/language", icon: Settings },
      { section: "Workspace", title: "Mobile / PWA / Push", url: "/settings/mobile", icon: Smartphone },
      { section: "Workspace", title: "Calendários", url: "/settings/calendars", icon: Calendar },
      { section: "Workspace", title: "Agendamentos", url: "/settings/booking", icon: CalendarDays },
      { section: "Workspace", title: "Vídeo & Reuniões", url: "/settings/video", icon: Video },
      { section: "Workspace", title: "Cobrança & Pagamentos", url: "/settings/payments", icon: FileText },
      { section: "Workspace", title: "Régua de cobrança", url: "/settings/dunning", icon: Repeat },
      { section: "Workspace", title: "NFS-e", url: "/settings/nfse", icon: FileText },
      // Estrutura CRM
      { section: "Estrutura CRM", title: "Pipelines", url: "/settings/pipelines", icon: GitBranch },
      { section: "Estrutura CRM", title: "Propriedades", url: "/settings/custom-properties", icon: Sliders },
      { section: "Estrutura CRM", title: "Objetos custom", url: "/settings/custom-objects", icon: Sliders },
      { section: "Estrutura CRM", title: "Fontes de lead", url: "/settings/lead-sources", icon: Filter },
      { section: "Estrutura CRM", title: "Produtos", url: "/settings/products", icon: Package },
      { section: "Estrutura CRM", title: "Cotações", url: "/settings/quotes", icon: FileText },
      { section: "Estrutura CRM", title: "Recorrência", url: "/settings/recurring", icon: Repeat },
      { section: "Estrutura CRM", title: "Assinaturas eletrônicas", url: "/settings/esign", icon: PenLine },
      { section: "Estrutura CRM", title: "Biblioteca de cláusulas", url: "/settings/clauses", icon: FileText },
      // Automação
      { section: "Automação", title: "Workflows", url: "/settings/workflows", icon: Workflow },
      { section: "Automação", title: "Distribuição", url: "/settings/rotation", icon: Shuffle },
      { section: "Automação", title: "SLA por etapa", url: "/settings/sla", icon: Timer },
      { section: "Automação", title: "Pontuação", url: "/settings/scoring", icon: Target },
      { section: "Automação", title: "Playbooks", url: "/settings/playbooks", icon: BookOpen },
      { section: "Automação", title: "Enriquecimento", url: "/settings/enrichment", icon: Sparkles },
      // Pessoas & Acesso
      { section: "Pessoas & Acesso", title: "Equipe do workspace", url: "/settings/workspace-team", icon: UsersRound },
      { section: "Pessoas & Acesso", title: "Usuários", url: "/settings/teams", icon: UsersRound },
      { section: "Pessoas & Acesso", title: "Permissões", url: "/settings/roles", icon: ShieldCheck },
      // Segurança
      { section: "Segurança", title: "Auditoria", url: "/settings/audit-log", icon: ScrollText },
      { section: "Segurança", title: "API Keys", url: "/settings/api-keys", icon: KeyRound },
      { section: "Segurança", title: "Webhooks", url: "/settings/webhooks", icon: Plug },
      // Integrações
      { section: "Integrações", title: "Marketplace", url: "/marketplace", icon: Package },
      { section: "Integrações", title: "Integrações", url: "/integrations", icon: Plug },
      { section: "Integrações", title: "Notificações Slack", url: "/settings/notifications/slack", icon: MessageSquare },
      { section: "Integrações", title: "Zapier / Make", url: "/settings/zapier", icon: Workflow },
      { section: "Integrações", title: "Sync HubSpot", url: "/settings/hubspot-sync", icon: Plug },
      { section: "Integrações", title: "Usuários HubSpot", url: "/settings/hubspot-users", icon: Plug },
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
                <SidebarMenuButton asChild tooltip="Chamados" isActive={path.startsWith("/admin/bug-reports")}>
                  <Link to="/admin/bug-reports">
                    <Bug className="h-4 w-4" />
                    <span>Chamados</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={user?.email ?? "Minha conta"}>
                  <UserIcon className="h-4 w-4" />
                  <span className="truncate">{user?.email ?? "Minha conta"}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <UserIcon className="h-4 w-4 mr-2" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/email">
                    <Mail className="h-4 w-4 mr-2" />
                    Conexão de email
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/security">
                    <KeyRound className="h-4 w-4 mr-2" />
                    Segurança (2FA)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/my-bug-reports">
                    <Bug className="h-4 w-4 mr-2" />
                    Meus chamados
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/billing">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Planos e cobrança
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
