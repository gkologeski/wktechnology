// Engrenagem no header: dropdown com atalhos + link para todas as configurações.
import { Link } from "@tanstack/react-router";
import { Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";

type Item = { to: string; label: string; need?: "admin" | "manager" | "platform" };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Minha conta",
    items: [
      { to: "/settings", label: "Perfil" },
      { to: "/settings/email", label: "Conexão de email" },
      { to: "/settings/security", label: "Segurança (2FA)" },
      { to: "/my-bug-reports", label: "Meus chamados" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/settings/branding", label: "White-label", need: "admin" },
      { to: "/settings/language", label: "Idioma", need: "admin" },
      { to: "/settings/calendars", label: "Calendários", need: "manager" },
      { to: "/settings/billing", label: "Planos e cobrança" },
    ],
  },
  {
    label: "Estrutura CRM",
    items: [
      { to: "/settings/pipelines", label: "Pipelines", need: "admin" },
      { to: "/settings/custom-properties", label: "Propriedades", need: "admin" },
      { to: "/settings/products", label: "Produtos", need: "manager" },
      { to: "/settings/custom-objects", label: "Objetos custom", need: "admin" },
    ],
  },
  {
    label: "Pessoas & Acesso",
    items: [
      { to: "/settings/teams", label: "Usuários", need: "admin" },
      { to: "/settings/user-groups", label: "Equipes" },
      { to: "/settings/roles", label: "Permissões", need: "admin" },
    ],
  },
  {
    label: "Automação & Engajamento",
    items: [
      { to: "/settings/workflows", label: "Workflows", need: "manager" },
      { to: "/settings/sequences", label: "Sequências", need: "manager" },
      { to: "/settings/email-templates", label: "Templates de email", need: "manager" },
      { to: "/settings/macros", label: "Macros", need: "manager" },
      { to: "/settings/kb", label: "Base de conhecimento", need: "manager" },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/marketplace", label: "Marketplace", need: "admin" },
      { to: "/integrations", label: "Integrações", need: "admin" },
      { to: "/settings/whatsapp", label: "WhatsApp" },
      { to: "/settings/hubspot-sync", label: "Sync HubSpot", need: "admin" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { to: "/admin/status", label: "Status", need: "platform" },
      { to: "/admin/alerts", label: "Alertas", need: "platform" },
      { to: "/admin/quotas", label: "Quotas", need: "platform" },
      { to: "/admin/sandbox", label: "Sandbox", need: "platform" },
    ],
  },
];

export function SettingsMenu() {
  const { isAdmin, isManager } = useMyRole();
  const canSee = (it: Item) => {
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
      <DropdownMenuContent align="end" className="w-72 max-h-[80vh] overflow-y-auto">
        {visible.map((g, idx) => (
          <div key={g.label}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {g.label}
            </DropdownMenuLabel>
            {g.items.map((it) => (
              <DropdownMenuItem key={it.to} asChild>
                <Link to={it.to}>{it.label}</Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="font-medium">
            Todas as configurações
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
