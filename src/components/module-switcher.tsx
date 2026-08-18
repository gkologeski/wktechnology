// Module switcher: alterna entre os módulos do ERP (CRM, ATS, ...).
// Single-host: sempre navegação SPA — não há mais cross-host.

import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, ChevronsUpDown, LayoutGrid, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MODULE_LIST } from "@/lib/modules/registry";
import { useModuleLicenses } from "@/hooks/use-module-licenses";
import { useActiveModule, setStoredActiveModule } from "@/lib/modules/active-module";
import { isWorkspacePathname } from "@/lib/menu-config-erp";
import { cn } from "@/lib/utils";

// Rotas neutras extras do workspace que não constam em WORKSPACE_ROUTE_PREFIXES.
const EXTRA_WORKSPACE_PREFIXES = ["/integrations"];

function isWorkspaceRoute(pathname: string): boolean {
  if (isWorkspacePathname(pathname)) return true;
  return EXTRA_WORKSPACE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function ModuleSwitcher({ className }: { className?: string }) {
  const active = useActiveModule();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Só é "contexto workspace" quando a rota é realmente neutra (mesma regra do
  // sidebar). Em rotas de módulo, o rótulo segue o módulo ativo — inclusive o
  // TechSales, que não possui prefixos de path mapeados.
  const isWorkspaceContext = isWorkspaceRoute(pathname);


  const handleSelect = (moduleId: typeof active) => {
    setOpen(false);
    if (!isWorkspaceContext && moduleId === active) return;
    const target = MODULE_LIST.find((m) => m.id === moduleId);
    if (!target) return;
    setStoredActiveModule(moduleId);
    navigate({ to: target.defaultRoute });
  };


  const activeDef = MODULE_LIST.find((m) => m.id === active) ?? MODULE_LIST[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 min-w-0 shrink gap-2 justify-between xl:min-w-[140px]", className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {isWorkspaceContext ? <Home className="h-4 w-4 shrink-0" /> : <LayoutGrid className="h-4 w-4 shrink-0" />}
            <span className="truncate">{isWorkspaceContext ? "ERP Home" : activeDef.productName}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate({ to: "/home" });
          }}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent transition-colors",
            isWorkspaceContext && "bg-accent",
          )}
        >
          <span className="h-8 w-8 rounded-lg grid place-items-center bg-muted text-foreground">
            <Home className="h-4 w-4" />
          </span>
          <span className="flex-1 min-w-0">
            <div className="font-medium leading-tight truncate">ERP Home</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Módulos e configurações do workspace
            </div>
          </span>
          {isWorkspaceContext && <Check className="h-4 w-4 text-primary" />}
        </button>
        <div className="my-1 h-px bg-border" />
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Módulos do ERP
        </div>

        {MODULE_LIST.filter((m) => m.id !== "services").map((m) => {
          const Icon = m.icon;
          const isActive = !isWorkspaceContext && m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent transition-colors",
                isActive && "bg-accent"
              )}
            >
              <span
                className="h-8 w-8 rounded-lg grid place-items-center text-white"
                style={{ backgroundColor: m.defaultColor }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <div className="font-medium leading-tight truncate">
                  {m.productName}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {m.shortDescription}
                </div>
              </span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

