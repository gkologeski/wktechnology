// Engrenagem no header: dropdown com atalhos + link para todas as configurações.
import { Link } from "@tanstack/react-router";
import { Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { SETTINGS_GROUPS, canSee, type Perms } from "@/lib/menu-config";

export function SettingsMenu() {
  const { isAdmin, isManager } = useMyRole();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const perms: Perms = { isAdmin, isManager, isPlatformAdmin };
  const visible = SETTINGS_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => canSee(it.need, perms)),
  })).filter((g) => g.items.length > 0);

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
