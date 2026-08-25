// Menu lateral do módulo ATS (TechHire).
// Renderizado pelo AppSidebar quando `activeModule === 'ats'`.
// Permissões reaproveitam o tipo `Perms` do menu-config principal.
//
// Regra: apontar SOMENTE para rotas ATS-only (src/routes/_authenticated/(ats)/*)
// ou para settings compartilhados de workspace. Não reutilizar rotas do CRM
// (TechSales) como /meetings, /inbox, /settings/portal, /reports, etc.

import {
  Briefcase,
  Users,
  GitBranch,
  BarChart3,
  Mail,
  Globe,
  ClipboardCheck,
  BookOpen,
  FileSignature,
  Sparkles,
  ShieldAlert,
  Heart,
  Users2,
  Gift,
  Inbox,
  CalendarClock,
  Search,
  Activity,
  Shield,
  LayoutDashboard,
} from "lucide-react";

import type { SidebarGroup } from "@/lib/menu-config";

// Sidebar ATS: somente itens do módulo. Configurações de workspace (membros,
// papéis, billing, idioma, API keys) ficam no Workspace Hub (/workspace),
// acessível pelo menu "Workspace" no header.
export const ATS_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Visão geral",
    items: [{ title: "Dashboard", url: "/ats-dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Recrutamento",
    items: [
      { title: "Vagas", url: "/jobs", icon: Briefcase },
      { title: "Candidatos", url: "/candidates", icon: Users },
      { title: "Pipelines", url: "/pipelines", icon: GitBranch },
      { title: "Scorecards", url: "/scorecards", icon: ClipboardCheck },
      { title: "Kits de Entrevista", url: "/interview-kits", icon: BookOpen },
      { title: "Scheduling", url: "/scheduling", icon: CalendarClock },
    ],
  },
  {
    label: "Sourcing",
    items: [
      { title: "Inbox", url: "/sourcing/inbox", icon: Inbox },
      { title: "Talent Pools", url: "/sourcing/pools", icon: Users2 },
      { title: "Sequências", url: "/sourcing/sequences", icon: Mail },
      { title: "Indicações", url: "/sourcing/referrals", icon: Gift },
      { title: "Multi-posting", url: "/sourcing/multi-posting", icon: Globe },
      { title: "Analytics", url: "/sourcing/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Hunting (LinkedIn)",
    items: [
      { title: "Hub", url: "/hunting", icon: Search },
      { title: "Buscar perfis", url: "/hunting/search", icon: Search },
      { title: "Capturados", url: "/hunting/captures", icon: Inbox },
      { title: "Templates", url: "/hunting/templates", icon: Mail },
      { title: "Observabilidade", url: "/hunting/observability", icon: Activity },
    ],
  },
  {
    label: "Contratação",
    items: [{ title: "Ofertas", url: "/offers", icon: FileSignature }],
  },
  {
    label: "Comunicação",
    items: [{ title: "E-mails por etapa", url: "/stage-emails", icon: Mail }],
  },
  {
    label: "Carreiras",
    items: [{ title: "Ver site de Carreiras", url: "/careers", icon: Globe, external: true }],
  },
  {
    label: "Inteligência (IA)",
    items: [
      { title: "Briefing diário", url: "/briefing", icon: Sparkles },
      { title: "Recruiter Copilot", url: "/copilot", icon: Sparkles },
      { title: "Match Scores", url: "/match-scores", icon: Sparkles },
      { title: "Flags de risco", url: "/fraud-flags", icon: ShieldAlert },
      { title: "Notetaker IA", url: "/notetaker", icon: Sparkles },
    ],
  },
  {
    label: "Análise",
    items: [
      { title: "Insights ATS", url: "/insights", icon: BarChart3 },
      { title: "DEI Analytics", url: "/dei-analytics", icon: Heart },
    ],
  },
  {
    label: "Compliance",
    items: [{ title: "LGPD & DSAR", url: "/compliance", icon: Shield }],
  },
];

// Prefixos de rota considerados "do ATS" para detecção de módulo
// (`detectModuleFromPath`) e para o `HostRouterGuard`. Derivado dos URLs
// do menu para evitar drift quando novos itens são adicionados.
// Itens marcados como `external: true` (ex.: site público de Carreiras) são
// excluídos para não capturar visitantes anônimos.
//
// IMPORTANTE: novos itens neutros (Settings/Account/Workspace/Admin) NÃO
// devem ser adicionados a este menu como `<Link to>` simples — devem usar
// `buildWorkspaceUrl(...)` (cross-host em produção, SPA em preview).
function collectPrefixes(): string[] {
  const set = new Set<string>([
    "/ats-dashboard",
    "/jobs",
    "/candidates",
    "/ats",
    "/pipelines",
    "/scorecards",
    "/interview-kits",
    "/offers",
    "/stage-emails",
    "/match-scores",
    "/fraud-flags",
    "/insights",
    "/dei-analytics",
    "/notetaker",
    "/sourcing",
    "/hunting",
    "/scheduling",
  ]);
  for (const g of ATS_SIDEBAR_GROUPS) {
    for (const it of g.items) {
      if (it.external) continue;
      if (!it.url || !it.url.startsWith("/")) continue;
      // Usa o top-level (1º segmento) como prefixo para cobrir filhos.
      const top = "/" + it.url.split("/").filter(Boolean)[0];
      if (top !== "/") set.add(top);
      for (const c of it.children ?? []) {
        if (c.external) continue;
        if (c.url?.startsWith("/")) {
          const ct = "/" + c.url.split("/").filter(Boolean)[0];
          if (ct !== "/") set.add(ct);
        }
      }
    }
  }
  return Array.from(set);
}

export const ATS_ROUTE_PREFIXES: readonly string[] = collectPrefixes();
