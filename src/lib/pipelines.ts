import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  defaultDealStages as seedDealStages,
  defaultTicketStages as seedTicketStages,
} from "@/lib/pipelines-defaults";
import { ensureDefaultPipeline } from "@/lib/pipelines.functions";

export type PipelineStage = {
  value: string;
  label: string;
  color?: string;
  probability?: number;
  type?: "open" | "won" | "lost";
};

export type PipelineConfig = {
  card_fields?: string[];
};

export type Pipeline = {
  id: string;
  name: string;
  entity: string;
  is_default: boolean;
  default_view?: string | null;
  stages: PipelineStage[];
  config?: PipelineConfig;
};

const LS_KEY = (entity: string) => `pipeline:selected:${entity}`;

export function defaultDealStages(): PipelineStage[] {
  return seedDealStages() as PipelineStage[];
}

export function defaultTicketStages(): PipelineStage[] {
  return seedTicketStages() as PipelineStage[];
}

/**
 * Garante (uma única vez por entidade, no servidor) que o workspace tenha um
 * pipeline padrão. Idempotente: nunca cria duplicatas, mesmo com várias telas
 * montando ao mesmo tempo — a chave da query deduplica a chamada.
 */
export function useEnsureDefaultPipeline(entity: "deal" | "lead" | "ticket") {
  const { user } = useAuth();
  const ensure = useServerFn(ensureDefaultPipeline);
  return useQuery({
    queryKey: ["pipelines", "ensure-default", entity, user?.id],
    enabled: !!user,
    queryFn: () => ensure({ data: { entity } }),
    staleTime: Infinity,
    retry: false,
  });
}

export function usePipelines(entity: "deal" | "lead" | "ticket" = "deal") {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["pipelines", entity, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .eq("entity", entity)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as (Pipeline & { config?: unknown })[]).map((p) => ({
        ...p,
        config: (p.config && typeof p.config === "object" ? p.config : {}) as PipelineConfig,
        stages: Array.isArray(p.stages)
          ? (p.stages as unknown as Array<Record<string, unknown>>).map((s, i) => {
              const value = String(
                (s.value as string | undefined) ??
                  (s.id as string | undefined) ??
                  (s.hubspot_id as string | undefined) ??
                  i,
              );
              const isClosed =
                (s.type as string | undefined) === "won" ||
                (s.is_closed as boolean | undefined) === true;
              return {
                value,
                label: (s.label as string | undefined) ?? value,
                color: (s.color as string | undefined) ?? undefined,
                probability: (s.probability as number | undefined) ?? undefined,
                type: (s.type as PipelineStage["type"]) ?? (isClosed ? "won" : "open"),
              } as PipelineStage;
            })
          : [],
      }));
    },
  });

  // A criação do pipeline padrão é feita no servidor (useEnsureDefaultPipeline),
  // chamada apenas pelas telas de listagem — nunca aqui, para não duplicar
  // registros quando vários componentes usam este hook na mesma tela.

  const pipelines = q.data ?? [];

  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(LS_KEY(entity));
    } catch {
      return null;
    }
  });

  // Re-hydrate when entity changes (hook reused across entities)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSelectedIdState(localStorage.getItem(LS_KEY(entity)));
    } catch {
      setSelectedIdState(null);
    }
  }, [entity]);

  useEffect(() => {
    if (pipelines.length === 0) return;
    if (selectedId === "__all__") return;
    if (selectedId && pipelines.some((p) => p.id === selectedId)) return;
    // Sem seleção persistida (1ª entrada) ou seleção inválida:
    // Em Negócios, preferimos "Serviços" (regra de negócio); nas demais entidades,
    // usamos o is_default e depois o primeiro pipeline.
    const servicos =
      entity === "deal"
        ? pipelines.find((p) => (p.name ?? "").trim().toLowerCase() === "serviços")
        : undefined;
    const def = servicos ?? pipelines.find((p) => p.is_default) ?? pipelines[0];
    setSelectedIdState(def.id);
    try {
      localStorage.setItem(LS_KEY(entity), def.id);
    } catch {
      // ignore
    }
  }, [pipelines, selectedId, entity]);

  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    try {
      localStorage.setItem(LS_KEY(entity), id);
    } catch {
      // ignore
    }
  };

  const selected =
    selectedId === "__all__"
      ? null
      : (pipelines.find((p) => p.id === selectedId) ?? pipelines[0] ?? null);

  return {
    pipelines,
    selected,
    selectedId: selected?.id ?? null,
    setSelectedId,
    isLoading: q.isLoading,
  };
}

/** Resolve which pipeline-stage a deal belongs to. Falls back to legacy `stage` enum. */
export function resolveStage(
  pipeline: Pipeline | null,
  deal: { stage?: string | null; stage_id?: string | null },
): PipelineStage | null {
  if (!pipeline) return null;
  const key = deal.stage_id || deal.stage;
  return pipeline.stages.find((s) => s.value === key) ?? null;
}
