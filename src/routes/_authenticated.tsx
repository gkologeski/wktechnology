import { createFileRoute, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CrossModuleBanner } from "@/components/cross-module-banner";
import { useAuth } from "@/lib/auth";
import { useMyRole } from "@/lib/use-my-role";
import { useModuleLicenses } from "@/hooks/use-module-licenses";
import { detectModuleFromPath } from "@/lib/modules/active-module";
import { ShieldAlert } from "lucide-react";
import { BugReportButton } from "@/components/bug-report/bug-report-button";
import { ChatTrigger } from "@/components/chat/chat-trigger";
import { NotificationsBell } from "@/components/notifications-bell";
import { GlobalSearch } from "@/components/global-search/global-search";
import { GlobalSearchTrigger } from "@/components/global-search-trigger";
import { QuickCreateMenu } from "@/components/quick-create-menu";
import { SettingsMenu } from "@/components/settings-menu";
import { AccountMenu } from "@/components/account-menu";
import { WorkspaceMenu } from "@/components/workspace-menu";
import { RouteBreadcrumbs } from "@/components/route-breadcrumbs";
import { FocusQueueBar } from "@/components/focus-queue-bar";
import { ModuleSwitcher } from "@/components/module-switcher";

import { TimerWidget } from "@/components/timer-widget";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const showTimer = false; // TimerWidget oculto temporariamente; reativar futuramente.

const ADMIN_ONLY = [
  "/settings/roles",
  "/settings/teams",
  "/settings/api-keys",
  "/settings/webhooks",
  "/settings/audit-log",
  "/settings/security",
  "/settings/hubspot-sync",
  "/settings/branding",
  "/settings/custom-objects",
  "/settings/custom-properties",
  "/settings/pipelines",
  "/integrations",
  "/settings/integrations",
  "/settings/marketplace",
  "/settings/import",
  "/leads/import-hubspot",
  "/settings/mobile",
  "/settings/language",
  "/settings/permissions",
  "/settings/rbac-diagnostics",
];
const MANAGER_PLUS = [
  "/settings/workflows",
  "/settings/sequences",
  "/settings/rotation",
  "/settings/sla",
  "/settings/scoring",
  "/settings/playbooks",
  "/settings/goals",
  "/settings/exports",
  "/settings/enrichment",
  "/settings/products",
  "/settings/quotes",
  "/settings/quote-templates",
  "/settings/esign",
  "/settings/recurring",
  "/settings/macros",
  "/settings/surveys",
  "/settings/portal",
  "/settings/forms",
  "/settings/prospecting",
  "/settings/subscriptions",
  "/settings/email-templates",
  "/settings/segments",
  "/settings/booking",
  "/reports",
  "/dashboards",
  "/analytics",
  "/campaigns/whatsapp",
  "/campaigns/email",
];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + "/"));

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, isManager, loading: roleLoading } = useMyRole();
  const { isLicensed } = useModuleLicenses();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const roleBlocked =
    !roleLoading &&
    ((matches(path, ADMIN_ONLY) && !isAdmin) || (matches(path, MANAGER_PLUS) && !isManager));

  const pathModule = detectModuleFromPath(path);
  const licenseBlocked = !!pathModule && !isLicensed(pathModule);
  const blocked = roleBlocked || licenseBlocked;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex min-w-0 items-center gap-2 border-b bg-background px-3">
            <SidebarTrigger className="shrink-0" />
            <ModuleSwitcher className="min-w-0 shrink" />
            <GlobalSearchTrigger />
            <div className="flex-1" />
            <div className="flex shrink-0 items-center gap-1">
              <WorkspaceMenu />
              <QuickCreateMenu />
              <SettingsMenu />
              <NotificationsBell />
              <AccountMenu />
            </div>
          </header>

          {!blocked && <RouteBreadcrumbs />}
          <main className="flex-1 p-6 overflow-auto">
            <FocusQueueBar />
            {!blocked && <CrossModuleBanner />}
            {blocked ? (
              <div className="max-w-md mx-auto mt-24 text-center space-y-3 border rounded-lg p-8 bg-background">
                <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  {licenseBlocked && !roleBlocked ? "Módulo não contratado" : "Acesso restrito"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {licenseBlocked && !roleBlocked
                    ? "Este módulo não está habilitado para o seu workspace. Um administrador pode contratá-lo em Módulos do workspace."
                    : "Você não tem permissão para acessar esta tela. Fale com um administrador do workspace."}
                </p>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
      <BugReportButton />
      <ChatTrigger />
      {showTimer && <TimerWidget />}
      <GlobalSearch />
    </SidebarProvider>
  );
}
