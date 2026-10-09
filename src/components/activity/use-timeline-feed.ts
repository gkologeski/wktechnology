// Camada de dados da timeline: carregamento, filtro de período, histórico,
// respostas de pesquisa e assinatura de realtime.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import type { Activity } from "@/lib/db-types";
import type { CustomRange, DatePreset } from "@/lib/date-presets";
import {
  createTimelineFeed,
  nextTimelinePage,
  TIMELINE_PAGE_SIZE,
  type TimelineFeedSession,
} from "@/lib/timeline/activity-fetch";
import type { HistoryGroup } from "@/lib/timeline/history-groups";
import { getActivitySurveyResponses } from "@/lib/surveys/survey-activity.functions";
import type { SurveyResponseSummary } from "@/components/surveys/survey-timeline-card";
import type { EmailMeta, RelatedKey } from "@/components/activity/timeline-shared";
import { mergeTimelinePage } from "@/lib/timeline/timeline-page";
import { useHistoryLabels } from "@/components/activity/use-history-labels";
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
  // Resumo de e-mails da página (corpo/anexos/rastreamento vêm sob demanda).
  const [emailMeta, setEmailMeta] = useState<Map<string, EmailMeta>>(new Map());
  // Respostas de pesquisas, indexadas pelo id da atividade do tipo "survey".
  const [surveyMeta, setSurveyMeta] = useState<Map<string, SurveyResponseSummary>>(new Map());
  // Contador incrementado por eventos de realtime para refazer o fetch das respostas.
  const [surveyTick, setSurveyTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [serverCounts, setServerCounts] = useState<Map<TimelineCategory, number>>(new Map());
  // Grupos de histórico já agrupados no servidor (indivisíveis entre páginas).
  const [historyGroups, setHistoryGroups] = useState<HistoryGroup[]>([]);
  // Versão da requisição: respostas de contexto anterior (registro, filtros,
  // identidade) são descartadas.
  const requestVersion = useRef(0);
  const sessionRef = useRef<TimelineFeedSession | null>(null);
  const loadedCountRef = useRef(0);

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

  // Busca com debounce: o servidor filtra antes de paginar.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);
  const serverFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.tab, filters.categories, filters.assignees, debouncedSearch],
  );

  /**
   * Carrega a primeira página. Em modo silencioso (realtime, foco, modal
   * fechado) recarrega a mesma quantidade já exibida e troca tudo de uma vez:
   * não volta para a primeira página nem mostra estado de carregamento, então
   * scroll e rascunhos (que vivem fora da lista) são preservados.
   */
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const version = ++requestVersion.current;
      const target = opts?.silent
        ? Math.max(TIMELINE_PAGE_SIZE, loadedCountRef.current)
        : TIMELINE_PAGE_SIZE;
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      try {
        const session = createTimelineFeed({
          relatedKey,
          relatedId,
          datePreset,
          dateCustom,
          filters: serverFilters,
        });
        const page = await nextTimelinePage(session, target);
        if (version !== requestVersion.current) return;
        sessionRef.current = session;
        loadedCountRef.current = page.activities.length + page.historyGroups.length;
        setItems(page.activities);
        setHistoryGroups(page.historyGroups);
        setEmailMeta(page.emailMeta);
        setHasMore(page.hasMore);
        setTotalCount(page.totalCount);
        setServerCounts(page.categoryCounts);
      } catch (error) {
        // Falha não vira lista vazia: mantém o que já estava na tela.
        if (version === requestVersion.current) toast.error((error as Error).message);
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [relatedKey, relatedId, datePreset, dateCustom, serverFilters],
  );
  const loadRef = useRef(load);
  loadRef.current = load;

  const loadMore = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || loadingMore || !hasMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    try {
      const page = await nextTimelinePage(session);
      if (version !== requestVersion.current) return;
      loadedCountRef.current += page.activities.length + page.historyGroups.length;
      setItems((current) => mergeTimelinePage(current, page.activities));
      setHistoryGroups((current) => {
        const seen = new Set(current.map((g) => g.id));
        return [...current, ...page.historyGroups.filter((g) => !seen.has(g.id))];
      });
      setEmailMeta((current) => new Map([...current, ...page.emailMeta]));
      setHasMore(page.hasMore);
    } catch (error) {
      if (version === requestVersion.current) toast.error((error as Error).message);
    } finally {
      // Sempre libera o botão, mesmo se o contexto mudou no meio.
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => {
    loadedCountRef.current = 0;
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const historyRows = useMemo(() => historyGroups.flatMap((g) => g.changes), [historyGroups]);
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
  const counts = serverCounts.size ? serverCounts : loadedCounts;

  // O servidor já aplicou período, tipos, responsável e busca antes de paginar.
  // No cliente só se reaplicam tipos/responsável (sem busca) para refletir de
  // imediato uma mudança de filtro enquanto a nova página chega.
  const timelineEntries = useMemo(
    () => applyTimelineFilters(allEntries, { ...filters, search: "" }) as TimelineEntry[],
    [allEntries, filters],
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
    void loadRef.current({ silent: true });
  });

  // Recarrega quando uma associação é criada/removida em outro componente
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadRef.current({ silent: true });
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
          () => schedule(() => void loadRef.current({ silent: true })),
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
        void loadRef.current({ silent: true });
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
    totalCount,
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
