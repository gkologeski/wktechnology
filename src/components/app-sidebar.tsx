import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search, Shield } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  SIDEBAR_GROUPS, SIDEBAR_PLATFORM_ITEMS, canSee, type Perms,
} from "@/lib/menu-config";

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, isManager } = useMyRole();
  const { isPlatformAdmin } = useIsPlatformAdmin();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [query, setQuery] = useState("");

  const perms: Perms = { isAdmin, isManager, isPlatformAdmin };
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SIDEBAR_GROUPS
      .map((g) => ({
        ...g,
        items: g.items
          .filter((i) => canSee(i.need, perms))
          .filter((i) => !q || i.title.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, isAdmin, isManager, isPlatformAdmin]);

  const platformItems = SIDEBAR_PLATFORM_ITEMS.filter((i) => canSee(i.need, perms));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-4 gap-3">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center text-sm font-bold shadow-md shadow-primary/20">
            WK
          </div>
          <div className="group-data-[collapsible=icon]:hidden min-w-0">
            <h2 className="text-base font-bold tracking-tight leading-tight truncate">TechSales CRM</h2>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">Operação comercial</p>
          </div>
        </Link>

        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSwitcher />
        </div>

        {!collapsed && (
          <div className="relative group-data-[collapsible=icon]:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu…"
              className="h-9 pl-9 rounded-xl bg-card"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <nav className="space-y-4 pb-2">
          {visibleGroups.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
              Nada encontrado.
            </p>
          ) : (
            visibleGroups.map((group) => (
              <section key={group.label}>
                <h3 className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {group.label}
                </h3>
                <div className="rounded-2xl border border-border bg-card p-1.5 shadow-sm group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:p-0">
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((it) => {
                      const active = isActive(it.url);
                      const Icon = it.icon;
                      return (
                        <SidebarMenuItem key={it.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={it.title}
                            className={cn(
                              "h-auto rounded-xl px-2 py-2 transition-all",
                              active
                                ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                          >
                            <Link to={it.url} className="group/item flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                                  active
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span className="truncate group-data-[collapsible=icon]:hidden">{it.title}</span>
                              {active && (
                                <span className="ml-auto h-5 w-1 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              </section>
            ))
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-sidebar-border/60 px-2 pt-2">
        <SidebarMenu>
          {platformItems.map((it) => {
            const Icon = it.icon;
            const active = isActive(it.url);
            return (
              <SidebarMenuItem key={it.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={it.title}
                  isActive={active}
                  className="h-auto rounded-xl px-2 py-2"
                >
                  <Link to={it.url} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate group-data-[collapsible=icon]:hidden">{it.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
