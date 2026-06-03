import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEAL_STAGES } from "@/lib/crm";

export type PipelineStage = {
  value: string;
  label: string;
  color?: string;
  probability?: number;
  type?: "open" | "won" | "lost";
};

export type Pipeline = {
  id: string;
  name: string;
  entity: string;
  is_default: boolean;
  default_view?: string | null;
  stages: PipelineStage[];
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
    { value: "waiting_on_contact", label: "Aguardando contato", color: "var(--hs-stage-2)", type: "open" },
    { value: "waiting_on_us", label: "Aguardando nós", color: "var(--hs-stage-3)", type: "open" },
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
      return ((data ?? []) as unknown as Pipeline[]).map((p) => ({
        ...p,
        stages: Array.isArray(p.stages) ? p.stages : [],
      }));
    },
  });

  // Seed default pipeline if user has none
  useEffect(() => {
    if (!user || q.isLoading || q.data === undefined) return;
    if (q.data.length > 0) return;
    (async () => {
      const seedStages =
        entity === "ticket" ? defaultTicketStages() : defaultDealStages();
      const seedName =
        entity === "deal" ? "Pipeline padrão" : entity === "lead" ? "Funil de Leads" : "Pipeline de Tickets";
      const { error } = await supabase.from("pipelines").insert({
        owner_id: user.id,
        entity,
        name: seedName,
        is_default: true,
        stages: seedStages as unknown as never,
      });
      if (!error) qc.invalidateQueries({ queryKey: ["pipelines", entity] });
    })();
  }, [user, entity, q.isLoading, q.data, qc]);

  const pipelines = q.data ?? [];

  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(LS_KEY(entity));
    if (stored) setSelectedIdState(stored);
  }, [entity]);

  useEffect(() => {
    if (pipelines.length === 0) return;
    if (selectedId && pipelines.some((p) => p.id === selectedId)) return;
    const def = pipelines.find((p) => p.is_default) ?? pipelines[0];
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

  const selected = pipelines.find((p) => p.id === selectedId) ?? pipelines[0] ?? null;

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
