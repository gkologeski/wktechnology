// /home — ERP Home: agrega módulos contratados e poucos atalhos curados.
// Configurações completas vivem em /settings (fonte única). Presentational + read-only.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Users,
  Boxes,
  Building2,
  UsersRound,
  Shield,
  Store,
  Receipt,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileText,
  Package,
  Kanban,
  DollarSign,
} from "lucide-react";
import { listWorkspaceModules, type WorkspaceModuleRow } from "@/lib/workspace/modules.functions";
import { buildModuleUrl } from "@/lib/hosts";
import { MODULES, type ModuleId } from "@/lib/modules/registry";
import { setStoredActiveModule } from "@/lib/modules/active-module";
import { PageHeader, SectionHeader, MetricCard, StatusBadge } from "@/components/techhire/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/date-range-picker";
import { usePersistedDateRange } from "@/hooks/use-persisted-date-range";

export const Route = createFileRoute("/_authenticated/modules/")({
  component: ErpHome,
});

// ---------------------------------------------------------------------------
// Módulos
// ---------------------------------------------------------------------------

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  briefcase: Briefcase,
  users: Users,
  filetext: FileText,
  package: Package,
  kanban: Kanban,
  dollarsign: DollarSign,
};

function resolveModuleIcon(name: string | null | undefined) {
  const key = (name ?? "").toLowerCase();
  return MODULE_ICONS[key] ?? Boxes;
}

function openModule(moduleId: ModuleId) {
  const def = MODULES[moduleId];
  if (!def) {
    console.warn(
      `[home] Módulo "${moduleId}" existe em public.modules mas não está registrado no front (src/lib/modules/registry.ts).`,
    );
    return;
  }
  // Persiste a preferência do usuário — sidebar do módulo aparece já na 1ª tela.
  setStoredActiveModule(moduleId);
  const url = buildModuleUrl(moduleId, def.defaultRoute);
  // Sempre navegar na mesma aba — cross-host ou SPA — para garantir que
  // o usuário chegue ao módulo (evita bloqueio de popup).
  window.location.assign(url);
}

function ModulesGrid() {
  const listFn = useServerFn(listWorkspaceModules);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["home-workspace-modules"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar os módulos agora.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((m: WorkspaceModuleRow) => {
        const Icon = resolveModuleIcon(m.icon);
        const product = m.default_product_name ?? m.name;
        const isRegisteredModule = (MODULES as Record<string, unknown>)[m.id] !== undefined;
        const status: "Ativo" | "Disponível" | "Não contratado" = m.enabled
          ? "Ativo"
          : m.is_contracted
            ? "Disponível"
            : "Não contratado";
        const canEnter = m.enabled && isRegisteredModule;
        return (
          <Card
            key={m.id}
            className={cn(
              "h-full flex flex-col transition-all",
              canEnter && "hover:border-primary/40 hover:shadow-sm",
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium rounded-full px-2 py-0.5",
                    status === "Ativo" &&
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    status === "Disponível" && "bg-muted text-muted-foreground",
                    status === "Não contratado" &&
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {status}
                </span>
              </div>
              <CardTitle className="text-base mt-3">{product}</CardTitle>
              <CardDescription className="text-xs">{m.name}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between pt-0">
              <div className="text-xs text-muted-foreground">
                {m.plan_code ? `Plano ${m.plan_code}` : "Sem plano ativo"}
              </div>
              {canEnter ? (
                <Button size="sm" onClick={() => openModule(m.id as ModuleId)}>
                  Entrar
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/workspace/modules">Configurar</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Marketplace / explorar mais */}
      <Card className="border-dashed h-full flex flex-col">
        <CardHeader>
          <div className="size-10 rounded-md bg-muted flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-base mt-3">Explorar mais</CardTitle>
          <CardDescription className="text-xs">
            Descubra add-ons e novos módulos no marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-auto pt-0">
          <Button size="sm" variant="outline" asChild>
            <Link to="/marketplace">Abrir marketplace</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atalhos curados (não replica /settings)
// ---------------------------------------------------------------------------

type Shortcut = {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SHORTCUTS: Shortcut[] = [
  {
    to: "/settings/teams",
    title: "Membros",
    desc: "Convites, papéis e acessos.",
    icon: UsersRound,
  },
  {
    to: "/settings/permissions",
    title: "Permissões",
    desc: "Cargos e pacotes de permissão.",
    icon: Shield,
  },
  { to: "/marketplace", title: "Marketplace", desc: "Add-ons e integrações.", icon: Store },
  { to: "/invoices", title: "Faturas", desc: "Histórico de pagamentos.", icon: Receipt },
];

function ShortcutsGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {SHORTCUTS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.title}
            className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start gap-3">
              <div className="size-8 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{item.desc}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function ErpHome() {
  const listFn = useServerFn(listWorkspaceModules);
  const { data: modules } = useQuery({
    queryKey: ["home-workspace-modules"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const { range, setRange } = usePersistedDateRange("home", "last30");

  const activeCount = modules?.filter((m) => m.enabled).length ?? 0;
  const contractedCount = modules?.filter((m) => m.is_contracted).length ?? 0;

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Módulos"
        description="Acesse seus módulos contratados e gerencie o workspace."
        primaryAction={
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={(r, preset) => setRange(r, preset)}
              align="end"
            />
            <Button asChild>
              <Link to="/workspace/modules">
                <Boxes className="mr-2 h-4 w-4" />
                Gerenciar módulos
              </Link>
            </Button>
          </div>
        }
        secondaryActions={
          <Button variant="outline" asChild>
            <Link to="/settings">Todas as configurações</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Módulos ativos" value={String(activeCount)} icon={CheckCircle2} />
        <MetricCard label="Módulos contratados" value={String(contractedCount)} icon={Boxes} />
        <MetricCard label="Status" value="Operacional" icon={Building2} />
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Módulos"
          description="Entre em um módulo contratado ou explore novos."
        />
        <ModulesGrid />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Atalhos"
          description="Acesso rápido às áreas mais usadas do workspace."
        />
        <ShortcutsGrid />
      </section>

      <div className="text-xs text-muted-foreground pt-6 border-t flex items-center gap-2">
        <StatusBadge status="open" label="Workspace" />
        <span>
          Configurações completas ficam em{" "}
          <Link to="/settings" className="underline hover:text-foreground">
            Configurações
          </Link>
          .
        </span>
      </div>
    </div>
  );
}
