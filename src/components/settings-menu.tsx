// Engrenagem no header: dropdown com atalhos + link para todas as configurações.
import { Link } from "@tanstack/react-router";
import {
  Settings, ArrowRight, User, Mail, ShieldCheck, Bug, Sparkles, Languages,
  Calendar, CreditCard, GitBranch, Tag, Package, Boxes, UsersRound, KeyRound,
  Workflow, Route as RouteIcon, LayoutTemplate, BookOpen, Plug, ShoppingBag,
  RefreshCw, MessageSquare, Activity, Bell, Gauge, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";

type Item = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  need?: "admin" | "manager" | "platform";
};
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Minha conta",
    items: [
      { to: "/settings", label: "Perfil", icon: User },
      { to: "/settings/email", label: "Conexão de email", icon: Mail },
      { to: "/settings/security", label: "Segurança (2FA)", icon: ShieldCheck },
      { to: "/my-bug-reports", label: "Meus chamados", icon: Bug },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/settings/branding", label: "White-label", icon: Sparkles, need: "admin" },
      { to: "/settings/language", label: "Idioma", icon: Languages, need: "admin" },
      { to: "/settings/calendars", label: "Calendários", icon: Calendar, need: "manager" },
      { to: "/settings/billing", label: "Planos e cobrança", icon: CreditCard, need: "admin" },
    ],
  },
  {
    label: "Estrutura CRM",
    items: [
      { to: "/settings/pipelines", label: "Pipelines", icon: GitBranch, need: "admin" },
      { to: "/settings/custom-properties", label: "Propriedades", icon: Tag, need: "admin" },
      { to: "/settings/products", label: "Produtos", icon: Package, need: "manager" },
      { to: "/settings/custom-objects", label: "Objetos custom", icon: Boxes, need: "admin" },
    ],
  },
  {
    label: "Pessoas & Acesso",
    items: [
      { to: "/settings/teams", label: "Usuários", icon: UsersRound, need: "admin" },
      { to: "/settings/user-groups", label: "Equipes", icon: UsersRound, need: "manager" },
      { to: "/settings/roles", label: "Permissões", icon: KeyRound, need: "admin" },
    ],
  },
  {
    label: "Automação & Engajamento",
    items: [
      { to: "/settings/workflows", label: "Workflows", icon: Workflow, need: "manager" },
      { to: "/settings/sequences", label: "Sequências", icon: RouteIcon, need: "manager" },
      { to: "/settings/email-templates", label: "Templates de email", icon: Mail, need: "manager" },
      { to: "/settings/macros", label: "Macros", icon: LayoutTemplate, need: "manager" },
      { to: "/settings/kb", label: "Base de conhecimento", icon: BookOpen, need: "manager" },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/marketplace", label: "Marketplace", icon: ShoppingBag, need: "admin" },
      { to: "/integrations", label: "Integrações", icon: Plug, need: "admin" },
      { to: "/settings/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot", icon: RefreshCw, need: "admin" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { to: "/admin/status", label: "Status", icon: Activity, need: "platform" },
      { to: "/admin/alerts", label: "Alertas", icon: Bell, need: "platform" },
      { to: "/admin/quotas", label: "Quotas", icon: Gauge, need: "platform" },
      { to: "/admin/sandbox", label: "Sandbox", icon: FlaskConical, need: "platform" },
    ],
  },
];

export function SettingsMenu() {
  const { isAdmin, isManager } = useMyRole();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const canSee = (it: Item) => {
    if (it.need === "platform") return isPlatformAdmin;
    if (it.need === "admin") return isAdmin;
    if (it.need === "manager") return isManager;
    return true;
  };
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[80vh] overflow-y-auto p-3 space-y-3 bg-popover"
      >
        {/* Header */}
        <div className="px-1">
          <div className="flex items-center gap-2 text-foreground">
            <Settings className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold tracking-tight">Configurações</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Atalhos rápidos do workspace</p>
        </div>

        {visible.map((g) => (
          <section key={g.label}>
            <h4 className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {g.label}
            </h4>
            <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm">
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all",
                          "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                            "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))}

        {/* Footer CTA */}
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-xl border border-border bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Todas as configurações
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
