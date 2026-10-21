import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FolderKanban, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import { getProjectDashboard } from "@/lib/projects/dashboard.functions";
import { OverviewView } from "@/components/projects/dashboard/overview-view";
import { DashFilters } from "@/components/projects/dashboard/dash-filters";
import { MeView, TeamView } from "@/components/projects/dashboard/work-views";
import {
  CommercialView,
  FinanceView,
  QualityView,
} from "@/components/projects/dashboard/business-views";
import { AlertsOverview } from "@/components/projects/dashboard/alerts-overview";
import { DrillSheet } from "@/components/projects/dashboard/drill-sheet";
import { AlertActDialog } from "@/components/projects/dashboard/alert-act-dialog";
import { RiskRulesDialog } from "@/components/projects/dashboard/risk-rules-dialog";
import { AssistantSheet } from "@/components/projects/dashboard/assistant-sheet";
import type { ViewCtx } from "@/components/projects/dashboard/dash-view-parts";
import {
  useDashScope,
  useProjectDashboardViews,
  type DrillState,
} from "@/hooks/use-project-dashboard-views";
import {
  DASH_FILTER_KEYS,
  DASH_VIEWS,
  DASH_VIEW_FILTERS,
  DASH_VIEW_LABEL,
  dashPreferenceKey,
  filtersForView,
  metricDef,
  parseDashSearch,
  type DashFilters as DashFiltersT,
  type DashSearch,
  type DashView,
} from "@/lib/projects/dashboard-views.shared";
import {
  isIanaTimeZone,
  monthRangeInTimeZone,
  validateIsoRange,
} from "@/lib/projects/reconciliation-labels";

type Tab = "overview" | DashView;

const date = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

export const Route = createFileRoute("/_authenticated/projects/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashSearch => {
    const parsed = parseDashSearch(s);
    return { ...parsed, view: s.view === "overview" ? "overview" : parsed.view };
  },
  head: () => ({
    meta: [
      { title: "Dashboard | TechProjects" },
      {
        name: "description",
        content:
          "Painel por perfil: meu trabalho, equipe e entrega, comercial, financeiro e qualidade dos dados, com capacidade, alertas e previsão.",
      },
      { property: "og:title", content: "Dashboard | TechProjects" },
      {
        property: "og:description",
        content:
          "Painel por perfil: meu trabalho, equipe e entrega, comercial, financeiro e qualidade dos dados, com capacidade, alertas e previsão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsDashboard,
});

function useTimeZone() {
  return useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isIanaTimeZone(tz) ? tz : "America/Sao_Paulo";
  }, []);
}

function ProjectsDashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tz = useTimeZone();
  const fallback = monthRangeInTimeZone(new Date(), tz);
  const valid = search.from && search.to && !validateIsoRange(search.from, search.to);
  const from = valid ? (search.from as string) : fallback.from;
  const to = valid ? (search.to as string) : fallback.to;

  const scope = useDashScope();
  const ws = scope.data?.workspace_id;
  const uid = scope.data?.user_id;
  const allowed = scope.data?.views;
  const tab: Tab =
    search.view && search.view !== "overview" && allowed?.[search.view as DashView]
      ? (search.view as DashView)
      : "overview";
  const view: DashView | null = tab === "overview" ? null : tab;

  // Preferência por workspace + usuário: restaura visão/filtros só quando a URL não traz nenhum.
  const restored = useRef(false);
  useEffect(() => {
    if (!ws || !uid || restored.current) return;
    restored.current = true;
    const empty = !search.view && !search.from && !DASH_FILTER_KEYS.some((k) => search[k]);
    if (!empty) return;
    try {
      const raw = window.localStorage.getItem(dashPreferenceKey(ws, uid));
      if (!raw) return;
      const parsedRaw = JSON.parse(raw) as Record<string, unknown>;
      const saved = parseDashSearch(parsedRaw);
      const savedView = parsedRaw?.view === "overview" ? "overview" : saved.view;
      const hasAny = !!savedView || DASH_FILTER_KEYS.some((k) => saved[k]) || !!saved.compare;
      if (!hasAny) return;
      void navigate({
        search: { ...saved, view: savedView, from: undefined, to: undefined },
        replace: true,
      });
    } catch {
      /* preferência corrompida: ignora */
    }
  }, [ws, uid, search, navigate]);
  useEffect(() => {
    if (!ws || !uid || !restored.current) return;
    const { from: _f, to: _t, ...rest } = search;
    try {
      window.localStorage.setItem(dashPreferenceKey(ws, uid), JSON.stringify(rest));
    } catch {
      /* armazenamento indisponível */
    }
  }, [ws, uid, search]);

  const filters: DashFiltersT = useMemo(
    () => ({
      from,
      to,
      tz,
      ...(view ? filtersForView(view, search) : {}),
      ...(view && (view === "me" || view === "team") && search.compare ? { compare: true } : {}),
    }),
    [from, to, tz, view, search],
  );

  const [drill, setDrill] = useState<DrillState | null>(null);
  const [actOn, setActOn] = useState<Record<string, unknown> | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [labels, setLabels] = useState<Partial<Record<string, string>>>({});
  // Troca de visão/filtros fecha a lista: nunca mostra linhas de outro recorte.
  useEffect(() => setDrill(null), [view, filters]);

  const d = useProjectDashboardViews({ ws, uid, view, filters, drill, rulesOpen });

  const getOverview = useServerFn(getProjectDashboard);
  const overview = useQuery({
    queryKey: ["projects-dashboard", ws, uid, from, to, tz],
    queryFn: () => getOverview({ data: { from, to, tz } }),
    enabled: tab === "overview",
    staleTime: 60_000,
  });

  const periodLabel = `${date(from)} a ${date(to)} · ${tz}`;
  const summary = d.summary.data;
  const ctx: ViewCtx = {
    periodLabel,
    generatedAt: summary?.generated_at ?? new Date().toISOString(),
    onDrill: (dataset, metric) => setDrill({ dataset, metric, offset: 0 }),
  };
  const setSearch = (patch: Partial<DashSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const fetching = tab === "overview" ? overview.isFetching : d.summary.isFetching;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="TechProjects · Projetos"
        title="Dashboard"
        description="Situação dos projetos e das horas por perfil. Cada número abre a lista que o compõe."
        primaryAction={
          <Button asChild size="sm">
            <Link to="/projects">
              <FolderKanban className="mr-2 h-4 w-4" />
              Ir para Projetos
            </Link>
          </Button>
        }
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            {tab === "overview" ? (
              <IsoDateRangePicker
                size="sm"
                align="end"
                ariaLabel="Período das horas"
                from={from}
                to={to}
                defaultPreset="thisMonth"
                onChange={(r) => setSearch({ from: r.from, to: r.to })}
                onClear={() => setSearch({ from: undefined, to: undefined })}
              />
            ) : null}
            {scope.data && Object.values(scope.data.views).some(Boolean) && (
              <AssistantSheet filters={filters} />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void (tab === "overview" ? overview.refetch() : d.summary.refetch())}
              disabled={fetching}
            >
              <RefreshCw className={fetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Atualizar
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setSearch({ view: v })}>
        <TabsList className="h-auto flex-wrap justify-start" aria-label="Visões do painel">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          {DASH_VIEWS.filter((v) => allowed?.[v]).map((v) => (
            <TabsTrigger key={v} value={v}>
              {DASH_VIEW_LABEL[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {scope.isError ? (
        <p className="text-xs text-text-secondary" role="status">
          Não foi possível conferir suas visões; mostrando apenas a visão geral.
        </p>
      ) : null}
      {scope.data?.read_only ? (
        <p className="text-xs text-text-secondary" role="status">
          Modo Ver como: somente leitura. Ações de alerta ficam desativadas.
        </p>
      ) : null}

      {tab === "overview" ? (
        overview.isLoading ? (
          <>
            <Skeletons.MetricsGrid count={4} />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeletons.Card lines={5} />
              <Skeletons.Card lines={5} />
            </div>
          </>
        ) : overview.isError || !overview.data ? (
          <DashboardError retry={() => void overview.refetch()} />
        ) : (
          <OverviewView data={overview.data} from={from} to={to} />
        )
      ) : (
        <>
          <DashFilters
            allowed={DASH_VIEW_FILTERS[tab]}
            from={from}
            to={to}
            tz={tz}
            search={search}
            labels={labels}
            showCompare={tab === "me" || tab === "team"}
            disabled={d.summary.isFetching && !summary}
            onPeriod={(r) => setSearch({ from: r?.from, to: r?.to })}
            onChange={(patch, l) => {
              if (l) setLabels((x) => ({ ...x, [l.kind]: l.label }));
              setSearch(patch);
            }}
            onReset={() =>
              void navigate({ search: { view: tab, from: search.from, to: search.to } })
            }
            onSearch={d.searchOptions}
          />
          {d.summary.isLoading || (d.summary.isFetching && !summary) ? (
            <>
              <Skeletons.MetricsGrid count={4} />
              <Skeletons.MetricsGrid count={4} />
              <Skeletons.Card lines={4} />
            </>
          ) : d.summary.isError || !summary ? (
            <DashboardError retry={() => void d.summary.refetch()} />
          ) : (
            <>
              {tab === "me" ? <MeView data={summary} ctx={ctx} /> : null}
              {tab === "team" ? <TeamView data={summary} ctx={ctx} /> : null}
              {tab === "commercial" ? <CommercialView data={summary} ctx={ctx} /> : null}
              {tab === "finance" ? <FinanceView data={summary} ctx={ctx} /> : null}
              {tab === "quality" ? <QualityView data={summary} ctx={ctx} /> : null}
              <AlertsOverview
                data={summary}
                ctx={ctx}
                reevaluating={d.reevaluate.isPending}
                onReevaluate={() => d.reevaluate.mutate()}
                onOpenRules={() => setRulesOpen(true)}
              />
              <p className="text-xs text-text-tertiary">
                Gerado em{" "}
                {new Date(summary.generated_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                · período {periodLabel}. Totais calculados no banco sobre todas as linhas do seu
                acesso, sem amostragem.
              </p>
            </>
          )}
        </>
      )}

      {drill && view ? (
        <DrillSheet
          open
          onOpenChange={(v) => !v && setDrill(null)}
          dataset={drill.dataset}
          def={metricDef(drill.dataset, drill.metric)}
          periodLabel={periodLabel}
          page={d.drillQuery.data}
          loading={d.drillQuery.isFetching}
          error={d.drillQuery.isError}
          onRetry={() => void d.drillQuery.refetch()}
          onPage={(offset) => setDrill({ ...drill, offset })}
          canExport={!!scope.data?.can_export}
          exporting={d.exportList.isPending}
          onExport={() => d.exportList.mutate()}
          onAct={drill.dataset === "alerts" ? (row) => setActOn(row) : undefined}
          readOnly={!!scope.data?.read_only}
        />
      ) : null}
      <AlertActDialog
        key={String(actOn?.id ?? "none")}
        alert={actOn}
        today={summary?.filters.today ?? from}
        pending={d.act.isPending}
        onClose={() => setActOn(null)}
        onSubmit={(v) =>
          d.act.mutate({ alertId: String(actOn?.id), ...v }, { onSuccess: () => setActOn(null) })
        }
      />
      <RiskRulesDialog
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        rules={d.rules.data}
        loading={d.rules.isLoading}
        saving={d.saveRules.isPending}
        onSave={(rules, note) =>
          d.saveRules.mutate({ rules, note }, { onSuccess: () => setRulesOpen(false) })
        }
      />
    </div>
  );
}
