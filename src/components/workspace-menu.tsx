// Header menu para acessar o Workspace Hub a partir de qualquer módulo.
// Em produção navega cross-host (app.wktechnology.com.br/workspace); em
// preview/local mantém SPA.
import { Building2, CreditCard, UsersRound, Settings as Cog, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildWorkspaceUrl, isCrossHostUrl } from "@/lib/hosts";
import { useNavigate } from "@tanstack/react-router";

type Item = { label: string; path: string; icon: React.ComponentType<{ className?: string }> };

const ITEMS: Item[] = [
  { label: "Configurações do Workspace", path: "/workspace", icon: Cog },
  { label: "Módulos contratados", path: "/workspace/modules", icon: Boxes },
  { label: "Membros & Equipes", path: "/settings/teams", icon: UsersRound },
  { label: "Planos & Cobrança", path: "/settings/billing", icon: CreditCard },
];

export function WorkspaceMenu() {
  const navigate = useNavigate();

  const handle = (path: string) => {
    const url = buildWorkspaceUrl(path);
    if (isCrossHostUrl(url)) {
      window.location.assign(url);
    } else {
      navigate({ to: url });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-2" aria-label="Workspace">
          <Building2 className="h-4 w-4" />
          <span className="hidden xl:inline text-sm">Workspace</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((i) => {
          const Icon = i.icon;
          return (
            <DropdownMenuItem key={i.path} onSelect={() => handle(i.path)}>
              <Icon className="h-4 w-4 mr-2" />
              {i.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
