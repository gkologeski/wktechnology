// Camada de dados da timeline: carregamento, filtro de período, histórico,
// respostas de pesquisa e assinatura de realtime.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import type { Activity } from "@/lib/db-types";
import type { CustomRange, DatePreset } from "@/lib/date-presets";
import { fetchTimelineData } from "@/lib/timeline/activity-fetch";
import {
  groupPropertyChanges,
  type HistoryGroup,
  type PropertyChangeRow,
} from "@/lib/timeline/history-groups";
import { getActivitySurveyResponses } from "@/lib/surveys/survey-activity.functions";
import type { SurveyResponseSummary } from "@/components/surveys/survey-timeline-card";
import type { EmailMeta, RelatedKey } from "@/components/activity/timeline-shared";
import { useHistoryLabels } from "@/components/activity/use-history-labels";

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

  // Histórico de alterações/movimentações (property_history) exibido na timeline.
  const [historyRows, setHistoryRows] = useState<PropertyChangeRow[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Filtro de período da timeline (presets + datas customizadas)
  const [datePreset, setDatePreset] = useState<DatePreset>("any");
  const [dateCustom, setDateCustom] = useState<CustomRange>({});

  const load = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    const data = await fetchTimelineData({ relatedKey, relatedId, datePreset, dateCustom });
    if (data.error) toast.error(data.error);
    setEmailMeta(data.emailMeta);
    setItems(data.items);
    setHistoryRows(data.historyRows);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [relatedId, datePreset, dateCustom.start, dateCustom.end]);

  // Histórico agrupado + resolução de IDs para nomes.
  const historyGroups = useMemo(() => groupPropertyChanges(historyRows), [historyRows]);
  const { resolveValue: resolveHistoryValue, resolveActor: resolveHistoryActor } =
    useHistoryLabels(historyRows);

  // Lista única, cronológica, de atividades + eventos de histórico.
  const timelineEntries = useMemo(() => {
    const entries: TimelineEntry[] = items.map((a) => ({
      t: new Date(a.hs_createdate ?? a.created_at ?? 0).getTime(),
      activity: a,
    }));
    if (showHistory) {
      for (const g of historyGroups) {
        entries.push({ t: new Date(g.changed_at).getTime(), history: g });
      }
    }
    return entries.sort((a, b) => b.t - a.t);
  }, [items, historyGroups, showHistory]);

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
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("timeline:refresh", handler);
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
    showHistory,
    setShowHistory,
    datePreset,
    setDatePreset,
    dateCustom,
    setDateCustom,
    timelineEntries,
    resolveHistoryValue,
    resolveHistoryActor,
  };
}
