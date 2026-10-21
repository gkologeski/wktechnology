// Dados do painel por perfil (TechProjects): escopo, resumo, lista, alertas e regras.
// Chaves de cache incluem workspace + usuário + visão + filtros, para nunca reaproveitar números de outro escopo.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  actOnAlert,
  exportDashList,
  getDashDrill,
  getDashScope,
  getDashSummary,
  getRiskRules,
  reevaluateDashAlerts,
  saveRiskRules,
  searchDashFilterOptions,
} from "@/lib/projects/dashboard-views.functions";
import {
  DASH_PAGE_SIZE,
  type DashDataset,
  type DashFilters,
  type DashView,
} from "@/lib/projects/dashboard-views.shared";
import type { DashRuleConfig } from "@/lib/projects/dashboard-views.types";

export type DrillState = { dataset: DashDataset; metric: string; offset: number };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

export function useDashScope() {
  const fn = useServerFn(getDashScope);
  return useQuery({ queryKey: ["projects-dash-scope"], queryFn: () => fn(), staleTime: 60_000 });
}

export function useProjectDashboardViews(opts: {
  ws: string | undefined;
  uid: string | undefined;
  view: DashView | null;
  filters: DashFilters;
  drill: DrillState | null;
  rulesOpen: boolean;
}) {
  const { ws, uid, view, filters, drill, rulesOpen } = opts;
  const qc = useQueryClient();
  const summaryFn = useServerFn(getDashSummary);
  const drillFn = useServerFn(getDashDrill);
  const exportFn = useServerFn(exportDashList);
  const searchFn = useServerFn(searchDashFilterOptions);
  const refreshFn = useServerFn(reevaluateDashAlerts);
  const actFn = useServerFn(actOnAlert);
  const rulesFn = useServerFn(getRiskRules);
  const saveRulesFn = useServerFn(saveRiskRules);
  const base = ["projects-dash", ws, uid] as const;

  const summary = useQuery({
    queryKey: [...base, "summary", view, filters],
    queryFn: () => summaryFn({ data: { view: view as DashView, filters } }),
    enabled: !!ws && !!uid && !!view,
    staleTime: 60_000,
  });

  const drillQuery = useQuery({
    queryKey: [...base, "drill", view, filters, drill?.dataset, drill?.metric, drill?.offset],
    queryFn: () =>
      drillFn({
        data: {
          view: view as DashView,
          dataset: (drill as DrillState).dataset,
          metric: (drill as DrillState).metric,
          filters,
          limit: DASH_PAGE_SIZE,
          offset: (drill as DrillState).offset,
        },
      }),
    enabled: !!ws && !!uid && !!view && !!drill,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects-dash", ws, uid] });

  const exportList = useMutation({
    mutationFn: () =>
      exportFn({
        data: {
          view: view as DashView,
          dataset: (drill as DrillState).dataset,
          metric: (drill as DrillState).metric,
          filters,
        },
      }),
    onSuccess: (r) => {
      const blob = new Blob(["\ufeff" + r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        r.truncated
          ? `Exportados ${r.exported.toLocaleString("pt-BR")} de ${r.total.toLocaleString("pt-BR")} registros (limite por arquivo).`
          : `Exportados ${r.exported.toLocaleString("pt-BR")} registros.`,
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const reevaluate = useMutation({
    mutationFn: () => refreshFn({ data: { tz: filters.tz } }),
    onSuccess: (r) => {
      if (r.status === "busy") toast.info("Outra avaliação está em andamento. Tente em instantes.");
      else toast.success("Alertas reavaliados.");
      void invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const act = useMutation({
    mutationFn: (v: {
      alertId: string;
      action: "ack" | "snooze" | "resolve" | "reopen";
      note: string;
      until: string | null;
    }) => actFn({ data: v }),
    onSuccess: () => {
      toast.success("Alerta atualizado.");
      void invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rules = useQuery({
    queryKey: [...base, "rules"],
    queryFn: () => rulesFn({ data: { projectId: null } }),
    enabled: !!ws && !!uid && rulesOpen,
  });

  const saveRules = useMutation({
    mutationFn: (v: { rules: Record<string, DashRuleConfig>; note: string }) =>
      saveRulesFn({
        data: {
          projectId: null,
          rules: v.rules as Record<string, Record<string, boolean | number | string>>,
          note: v.note,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Regras salvas (versão ${r.version}). Reavalie para aplicar.`);
      void invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const searchOptions = useCallback(
    (kind: "project" | "company" | "service" | "leader" | "person", q: string) =>
      searchFn({ data: { kind, q } }),
    [searchFn],
  );

  return { summary, drillQuery, exportList, reevaluate, act, rules, saveRules, searchOptions };
}
