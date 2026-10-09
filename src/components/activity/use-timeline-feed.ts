// Camada de dados da timeline: carregamento, filtro de período, histórico,
// respostas de pesquisa e assinatura de realtime.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import type { Activity } from "@/lib/db-types";
import type { CustomRange, DatePreset } from "@/lib/date-presets";
import { fetchTimelineData, type TimelineCursor } from "@/lib/timeline/activity-fetch";
import {
  groupPropertyChanges,
  type HistoryGroup,
  type PropertyChangeRow,
} from "@/lib/timeline/history-groups";
import { getActivitySurveyResponses } from "@/lib/surveys/survey-activity.functions";
import type { SurveyResponseSummary } from "@/components/surveys/survey-timeline-card";
import type { EmailMeta, RelatedKey } from "@/components/activity/timeline-shared";
import { useHistoryLabels } from "@/components/activity/use-history-labels";
import { labelProperty, labelValue } from "@/lib/timeline/property-labels";
import {
  ALL_CATEGORIES,
  DEFAULT_TIMELINE_FILTERS,
  applyTimelineFilters,
  countByCategory,
  type TimelineFilters,
  type TimelineCategory,
} from "@/lib/timeline/timeline-filters";

export type TimelineEntry = { t: number; activity?: Activity; history?: HistoryGroup };

export function useTimelineFeed(relatedKey: RelatedKey, relatedId: string) {
  const [items, setItems] = useState<Activity[]>([]);
  // Metadados enriquecidos de e-mails (corpo, anexos, aberturas, cliques),
  // indexados pelo id da atividade correspondente.
  const [emailMeta, setEmailMeta] = useState<Map<string, EmailMeta>>(new Map());
  // Respostas de pesquisas, indexadas pelo id da atividade do tipo "survey".
  const [surveyMeta, setSurveyMeta] = useState<Map<string, SurveyResponseSummary>>(new Map());
  // Contador incrementado por eventos de realtime para refazer o fetch das respostas.
  const [surveyTick, setSurveyTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<TimelineCursor | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [serverCounts, setServerCounts] = useState<Map<TimelineCategory, number>>(new Map());
  const requestVersion = useRef(0);

  // Histórico de alterações/movimentações (property_history) exibido na timeline.
  const [historyRows, setHistoryRows] = useState<PropertyChangeRow[]>([]);
  // Filtros no padrão HubSpot, salvos por tipo de ficha neste navegador.
  const storageKey = `timeline-filters:${relatedKey}`;
  const [filters, setFiltersState] = useState<TimelineFilters>(DEFAULT_TIMELINE_FILTERS);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<TimelineFilters>;
      setFiltersState({
        ...DEFAULT_TIMELINE_FILTERS,
        tab: saved.tab ?? "all",
        categories: (saved.categories ?? ALL_CATEGORIES).filter((c) => ALL_CATEGORIES.includes(c)),
        assignees: saved.assignees ?? [],
      });
    } catch {
      /* preferências inválidas são ignoradas */
    }
  }, [storageKey]);
  const setFilters = (f: TimelineFilters) => {
    setFiltersState(f);
    try {
      const { search: _search, ...persisted } = f;
      window.localStorage.setItem(storageKey, JSON.stringify(persisted));
    } catch {
      /* armazenamento indisponível */
    }
  };

  // Filtro de período da timeline (presets + datas customizadas)
  const [datePreset, setDatePreset] = useState<DatePreset>("any");
  const [dateCustom, setDateCustom] = useState<CustomRange>({});

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const version = ++requestVersion.current;
      if (opts?.silent) setRefreshing(true);
      const data = await fetchTimelineData({
        relatedKey,
        relatedId,
        datePreset,
        dateCustom,
        filters,
      });
      if (version !== requestVersion.current) return;
      if (data.error) toast.error(data.error);
      setEmailMeta(data.emailMeta);
      setItems(data.items);
      setHistoryRows(data.historyRows);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      setTotalCount(data.totalCount);
      setServerCounts(data.categoryCounts);
      setLoading(false);
      setRefreshing(false);
    },
    [relatedKey, relatedId, datePreset, dateCustom, filters],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    const data = await fetchTimelineData({
      relatedKey,
      relatedId,
      datePreset,
      dateCustom,
      filters,
      cursor: nextCursor,
    });
    if (version !== requestVersion.current) return setLoadingMore(false);
    if (data.error) toast.error(data.error);
    setItems((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of data.items) byId.set(item.id, item);
      return [...byId.values()].sort((a, b) => {
        const ta = new Date(a.hs_createdate ?? a.created_at ?? 0).getTime();
        const tb = new Date(b.hs_createdate ?? b.created_at ?? 0).getTime();
        return tb - ta || b.id.localeCompare(a.id);
      });
    });
    setEmailMeta((current) => new Map([...current, ...data.emailMeta]));
    setHasMore(data.hasMore);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }, [nextCursor, loadingMore, relatedKey, relatedId, datePreset, dateCustom, filters]);

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [load]);

  // Histórico agrupado + resolução de IDs para nomes.
  const historyGroups = useMemo(() => groupPropertyChanges(historyRows), [historyRows]);
  const { resolveValue: resolveHistoryValue, resolveActor: resolveHistoryActor } =
    useHistoryLabels(historyRows);

  // Lista única, cronológica, de atividades + eventos de histórico.
  const allEntries = useMemo(() => {
    const entries: TimelineEntry[] = items.map((a) => ({
      t: new Date(a.hs_createdate ?? a.created_at ?? 0).getTime(),
      activity: a,
    }));
    for (const g of historyGroups) {
      entries.push({ t: new Date(g.changed_at).getTime(), history: g });
    }
    return entries.sort((a, b) => b.t - a.t);
  }, [items, historyGroups]);

  const loadedCounts = useMemo(() => countByCategory(allEntries), [allEntries]);
  const counts = useMemo(() => {
    if (!serverCounts.size) return loadedCounts;
    const merged = new Map(serverCounts);
    // Reuniões virtuais do calendário não pertencem à tabela de atividades.
    const virtualMeetings = items.filter((item) => item.id.startsWith("cal_")).length;
    if (virtualMeetings) merged.set("meeting", (merged.get("meeting") ?? 0) + virtualMeetings);
    return merged;
  }, [serverCounts, loadedCounts, items]);

  const timelineEntries = useMemo(
    () =>
      applyTimelineFilters(allEntries, filters, {
        extraText: (a) => {
          const m = a.id ? emailMeta.get(a.id) : undefined;
          return m
            ? `${m.from_name ?? ""} ${m.from_email ?? ""} ${m.body_text ?? (m.body_html ?? "").replace(/<[^>]*>/g, " ")}`
            : "";
        },
        historyText: (g) =>
          g.changes
            .map(
              (c) =>
                `${labelProperty(c.property)} ${resolveHistoryValue(c.property, c.old_value) ?? labelValue(c.old_value)} ${resolveHistoryValue(c.property, c.new_value) ?? labelValue(c.new_value)}`,
            )
            .join(" "),
      }) as TimelineEntry[],
    [allEntries, filters, emailMeta, resolveHistoryValue],
  );

  // Carrega as respostas das atividades do tipo "pesquisa" exibidas na timeline.
  useEffect(() => {
    const ids = items.filter((a) => a.type === "survey").map((a) => a.id);
    if (ids.length === 0) {
      setSurveyMeta((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    void getActivitySurveyResponses({ data: { activity_ids: ids } })
      .then((rows) => {
        if (cancelled) return;
        setSurveyMeta(
          new Map((rows as SurveyResponseSummary[]).map((r) => [r.activity_id, r] as const)),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [items, surveyTick]);

  // Re-sincroniza silenciosamente quando a janela volta a focar ou um modal fecha
  useRefreshCallback(() => {
    void load({ silent: true });
  });

  // Recarrega quando uma associação é criada/removida em outro componente
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load({ silent: true });
      }, 150);
    };
    window.addEventListener("timeline:refresh", handler);
    window.addEventListener("activities:changed", handler);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("timeline:refresh", handler);
      window.removeEventListener("activities:changed", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedId, datePreset, dateCustom.start, dateCustom.end]);

  // Realtime: atualiza a timeline assim que uma atividade (ou resposta de
  // pesquisa) deste registro é criada/alterada/removida — inclusive quando a
  // gravação acontece no servidor após o modal fechar, ou por outro usuário.
  useEffect(() => {
    if (typeof window === "undefined" || !relatedId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (fn: () => void) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 250);
    };

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(`timeline:${relatedKey}:${relatedId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "activities",
            filter: `${relatedKey}=eq.${relatedId}`,
          },
          () => schedule(() => void load({ silent: true })),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activity_survey_responses" },
          () => schedule(() => setSurveyTick((t) => t + 1)),
        )
        .subscribe();
    };

    const unsubscribe = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) unsubscribe();
      else {
        subscribe();
        void load({ silent: true });
      }
    };

    if (!document.hidden) subscribe();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedKey, relatedId, datePreset, dateCustom.start, dateCustom.end]);

  return {
    items,
    emailMeta,
    surveyMeta,
    loading,
    refreshing,
    load,
    filters,
    setFilters,
    counts,
    totalCount: totalCount + items.filter((item) => item.id.startsWith("cal_")).length,
    hasMore,
    loadingMore,
    loadMore,
    datePreset,
    setDatePreset,
    dateCustom,
    setDateCustom,
    timelineEntries,
    resolveHistoryValue,
    resolveHistoryActor,
  };
}
