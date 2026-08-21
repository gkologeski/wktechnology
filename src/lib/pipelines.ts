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

const DEFAULT_STAGE_COLORS = [
  "var(--hs-stage-1)",
  "var(--hs-stage-2)",
  "var(--hs-stage-3)",
  "var(--hs-stage-4)",
  "var(--hs-stage-won)",
  "var(--hs-stage-lost)",
];
const DEFAULT_PROBABILITIES = [10, 30, 50, 70, 100, 0];
const DEFAULT_TYPES: PipelineStage["type"][] = ["open", "open", "open", "open", "won", "lost"];

export function defaultDealStages(): PipelineStage[] {
  return DEAL_STAGES.map((s, i) => ({
    value: s.value,
    label: s.label,
    color: DEFAULT_STAGE_COLORS[i],
    probability: DEFAULT_PROBABILITIES[i],
    type: DEFAULT_TYPES[i],
  }));
}

const LS_KEY = (entity: string) => `pipeline:selected:${entity}`;

export function defaultTicketStages(): PipelineStage[] {
  return [
    { value: "new", label: "Novo", color: "var(--hs-stage-1)", type: "open" },
    { value: "open", label: "Em atendimento", color: "var(--hs-stage-2)", type: "open" },
    { value: "waiting", label: "Aguardando cliente", color: "var(--hs-stage-3)", type: "open" },
    { value: "resolved", label: "Resolvido", color: "var(--hs-stage-4)", type: "open" },
    { value: "closed", label: "Fechado", color: "var(--hs-stage-won)", type: "won" },
  ];
}

export function usePipelines(entity: "deal" | "lead" | "ticket" = "deal") {
  const { user } = useAuth();
  const qc = useQueryClient();

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

  // Seed default pipeline if user has none
  useEffect(() => {
    if (!user || q.isLoading || q.data === undefined) return;
    if (q.data.length > 0) return;
    (async () => {
      const seedStages = entity === "ticket" ? defaultTicketStages() : defaultDealStages();
      const seedName =
        entity === "deal"
          ? "Pipeline padrão"
          : entity === "lead"
            ? "Funil de Leads"
            : "Pipeline de Tickets";
      // Resolve workspace ativo p/ não depender da ordem dos triggers de RLS.
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      const workspaceId =
        (profile as { active_workspace_id?: string | null } | null)?.active_workspace_id ?? null;
      const { error } = await supabase.from("pipelines").insert({
        owner_id: user.id,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        entity,
        name: seedName,
        is_default: true,
        stages: seedStages as unknown as never,
      } as never);
      if (error) {
        console.error("[pipelines] seed default falhou:", error);
      } else {
        qc.invalidateQueries({ queryKey: ["pipelines", entity] });
      }
    })();
  }, [user, entity, q.isLoading, q.data, qc]);

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
