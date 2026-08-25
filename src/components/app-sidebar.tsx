import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Search, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { cn, normalizeSearch } from "@/lib/utils";

import { useMyRole } from "@/lib/use-my-role";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { usePermissions } from "@/lib/access-control/use-permissions";

import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { ModuleSwitcher } from "@/components/module-switcher";
import { SIDEBAR_GROUPS, SIDEBAR_PLATFORM_ITEMS, canSee, type Perms } from "@/lib/menu-config";
import { ATS_SIDEBAR_GROUPS } from "@/lib/menu-config-ats";
import { ERP_SIDEBAR_GROUPS, isWorkspacePathname } from "@/lib/menu-config-erp";
import { CONTRACTS_SIDEBAR_GROUPS } from "@/lib/menu-config-contracts";
import { SERVICES_SIDEBAR_GROUPS } from "@/lib/menu-config-services";
import { PROJECTS_SIDEBAR_GROUPS } from "@/lib/menu-config-projects";
import { FINANCE_SIDEBAR_GROUPS } from "@/lib/menu-config-finance";
import { PEOPLE_SIDEBAR_GROUPS } from "@/lib/menu-config-people";
import { CORE_SIDEBAR_GROUPS, shouldInjectCoreGroups } from "@/lib/menu-config-core";

import { useActiveModule, useActiveModuleDefinition } from "@/lib/modules/active-module";

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, isManager } = useMyRole();
  const { permissions: grantedPermissions } = usePermissions();
  const { isPlatformAdmin } = useIsPlatformAdmin();

  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [query, setQuery] = useState("");
  const activeModule = useActiveModuleDefinition();
  const activeModuleId = useActiveModule();

  const perms: Perms = { isAdmin, isManager, isPlatformAdmin, permissions: grantedPermissions };
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  // Neutro no Workspace/ERP Home: exibe shell "ERP" independente do módulo.
  const workspaceShell = isWorkspacePathname(path);
  // `useActiveModule` já é path-first com fallback de host — usa direto.
  const effectiveModuleId = activeModuleId;
  const groupsSource = workspaceShell
    ? ERP_SIDEBAR_GROUPS
    : (() => {
        const moduleGroups =
          effectiveModuleId === "ats"
            ? ATS_SIDEBAR_GROUPS
            : effectiveModuleId === "contracts"
              ? CONTRACTS_SIDEBAR_GROUPS
              : effectiveModuleId === "services"
                ? SERVICES_SIDEBAR_GROUPS
                : effectiveModuleId === "projects"
                  ? PROJECTS_SIDEBAR_GROUPS
                  : effectiveModuleId === "finance"
                    ? FINANCE_SIDEBAR_GROUPS
                    : effectiveModuleId === "people"
                      ? PEOPLE_SIDEBAR_GROUPS
                      : SIDEBAR_GROUPS;
        // Prepend "Cadastros" (Core ERP) para módulos consumidores.
        return shouldInjectCoreGroups(effectiveModuleId)
          ? [...CORE_SIDEBAR_GROUPS, ...moduleGroups]
          : moduleGroups;
      })();

  // Header/branding neutro no shell de workspace.
  const shellBrand = workspaceShell
    ? {
        productName: "TechERP",
        name: "Workspace",
        shortDescription: "Módulos e configurações",
        defaultColor: "#0f172a",
        defaultRoute: "/home",
      }
    : {
        productName: activeModule.productName,
        name: activeModule.name,
        shortDescription: activeModule.shortDescription,
        defaultColor: activeModule.defaultColor,
        defaultRoute: activeModule.defaultRoute,
      };

  const visibleGroups = useMemo(() => {
    const q = normalizeSearch(query);
    const matches = (title: string) => !q || normalizeSearch(title).includes(q);
    return groupsSource
      .map((g) => ({
        ...g,
        items: g.items
          .filter((i) => canSee(i.need, perms, i.permissionAny))
          .map((i) => ({
            ...i,
            children: (i.children ?? []).filter(
              (c) => canSee(c.need, perms, c.permissionAny) && matches(c.title),
            ),
          }))
          .filter((i) => matches(i.title) || (i.children && i.children.length > 0)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, isAdmin, isManager, isPlatformAdmin, grantedPermissions, groupsSource]);

  const platformItems = SIDEBAR_PLATFORM_ITEMS.filter((i) => canSee(i.need, perms));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-4 gap-3">
        <Link to={shellBrand.defaultRoute} className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 shrink-0 rounded-xl text-white grid place-items-center text-sm font-bold shadow-md"
            style={{
              backgroundColor: shellBrand.defaultColor,
              boxShadow: `0 4px 12px ${shellBrand.defaultColor}33`,
            }}
          >
            {shellBrand.productName.slice(0, 2).toUpperCase()}
          </div>
          <div className="group-data-[collapsible=icon]:hidden min-w-0">
            <h2 className="text-base font-bold tracking-tight leading-tight truncate">
              {shellBrand.productName} {shellBrand.name}
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {shellBrand.shortDescription}
            </p>
          </div>
        </Link>

        <div className="group-data-[collapsible=icon]:hidden space-y-2">
          <ModuleSwitcher className="w-full" />
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
                      const hasChildren = !!(it.children && it.children.length > 0);
                      // Pai com filhos: ativo apenas em match exato (evita duplo destaque com filho ativo)
                      const active = hasChildren ? path === it.url : isActive(it.url);
                      const Icon = it.icon;
                      const anyChildActive =
                        hasChildren && it.children!.some((c) => isActive(c.url));
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
                            {it.external ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/item flex items-center gap-2.5"
                              >
                                <span
                                  className={cn(
                                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                                    "bg-muted text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary",
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="truncate group-data-[collapsible=icon]:hidden">
                                  {it.title}
                                </span>
                              </a>
                            ) : (
                              <Link to={it.url} className="group/item flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                                    active || anyChildActive
                                      ? "bg-primary/15 text-primary"
                                      : "bg-muted text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary",
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="truncate group-data-[collapsible=icon]:hidden">
                                  {it.title}
                                </span>
                                {active && (
                                  <span className="ml-auto h-5 w-1 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
                                )}
                              </Link>
                            )}
                          </SidebarMenuButton>

                          {hasChildren && (
                            <ul
                              className={cn(
                                "mt-0.5 ml-[18px] border-l pl-2 space-y-0.5 group-data-[collapsible=icon]:hidden",
                                anyChildActive ? "border-primary/40" : "border-border/60",
                              )}
                            >
                              {it.children!.map((c) => {
                                const cActive = isActive(c.url);
                                const CIcon = c.icon;
                                return (
                                  <li key={c.url}>
                                    <Link
                                      to={c.url}
                                      className={cn(
                                        "group/sub flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                                        cActive
                                          ? "bg-primary/10 text-primary font-semibold"
                                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                      )}
                                    >
                                      <CIcon
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          cActive
                                            ? "text-primary"
                                            : "text-muted-foreground group-hover/sub:text-foreground",
                                        )}
                                      />
                                      <span className="truncate">{c.title}</span>
                                      {cActive && (
                                        <span className="ml-auto h-4 w-1 rounded-full bg-primary" />
                                      )}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
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
        <PlatformSection items={platformItems} isActive={isActive} collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function PlatformSection({
  items,
  isActive,
  collapsed,
}: {
  items: typeof SIDEBAR_PLATFORM_ITEMS;
  isActive: (url: string) => boolean;
  collapsed: boolean;
}) {
  const hasActive = items.some((i) => isActive(i.url));
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("sidebar:platform-open");
    if (saved !== null) return saved === "1";
    return false;
  });

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:platform-open", open ? "1" : "0");
    }
  }, [open]);

  if (items.length === 0) return null;

  // No modo colapsado (icon-only), sempre mostra os ícones — sem toggle.
  if (collapsed) {
    return (
      <SidebarMenu>
        {items.map((it) => {
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
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Shield className="h-3 w-3" />
        </span>
        <span className="flex-1 text-left">Plataforma</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")}
        />
      </button>

      {open && (
        <SidebarMenu>
          {items.map((it) => {
            const Icon = it.icon;
            const active = isActive(it.url);
            return (
              <SidebarMenuItem key={it.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={it.title}
                  isActive={active}
                  className={cn(
                    "h-auto rounded-xl px-2 py-2",
                    active && "bg-primary/10 text-primary font-semibold",
                  )}
                >
                  <Link to={it.url} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{it.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      )}
    </div>
  );
}
