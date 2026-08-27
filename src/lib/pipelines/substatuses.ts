// Substatus por etapa de pipeline (Pipeline → Etapa → Substatus).
// Camada única compartilhada por Leads e Negócios: tipos, leitura e mutações.
// A visibilidade e a permissão de escrita são decididas pela RLS do banco.
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StageSubstatus = {
  id: string;
  pipeline_id: string;
  stage_value: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  is_active: boolean;
  is_default: boolean;
};

/** Evita a inferência custosa do supabase-js sobre a string de select. */
const sel = (s: string): string => s;

const COLUMNS =
  "id, pipeline_id, stage_value, name, description, color, position, is_active, is_default";

export const substatusesKey = (pipelineId?: string | null) =>
  ["pipeline-substatuses", pipelineId ?? "none"] as const;

export async function fetchPipelineSubstatuses(pipelineId: string): Promise<StageSubstatus[]> {
  const { data, error } = await supabase
    .from("pipeline_stage_substatuses")
    .select(sel(COLUMNS))
    .eq("pipeline_id", pipelineId)
    .order("stage_value", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<StageSubstatus[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Todos os substatus de um pipeline (ativos e inativos). */
export function usePipelineSubstatuses(pipelineId?: string | null) {
  return useQuery({
    queryKey: substatusesKey(pipelineId),
    enabled: !!pipelineId,
    staleTime: 60_000,
    queryFn: () => fetchPipelineSubstatuses(pipelineId as string),
  });
}

export function substatusesForStage(
  list: StageSubstatus[] | undefined,
  stageValue?: string | null,
  opts?: { includeInactive?: boolean },
): StageSubstatus[] {
  if (!list || !stageValue) return [];
  return list.filter(
    (s) => s.stage_value === stageValue && (opts?.includeInactive ? true : s.is_active),
  );
}

/** Substatus ativos da etapa atual, prontos para um seletor. */
export function useStageSubstatuses(pipelineId?: string | null, stageValue?: string | null) {
  const q = usePipelineSubstatuses(pipelineId);
  const options = useMemo(
    () => substatusesForStage(q.data, stageValue),
    [q.data, stageValue],
  );
  return { options, all: q.data ?? [], isLoading: q.isLoading, error: q.error };
}

export function findSubstatus(
  list: StageSubstatus[] | undefined,
  id?: string | null,
): StageSubstatus | undefined {
  if (!list || !id) return undefined;
  return list.find((s) => s.id === id);
}

export function defaultSubstatusFor(
  list: StageSubstatus[] | undefined,
  stageValue?: string | null,
): StageSubstatus | undefined {
  return substatusesForStage(list, stageValue).find((s) => s.is_default);
}

export type SubstatusDraft = {
  id?: string;
  pipeline_id: string;
  stage_value: string;
  name: string;
  description?: string | null;
  color?: string | null;
  position?: number;
  is_active?: boolean;
  is_default?: boolean;
};

export async function saveSubstatus(draft: SubstatusDraft): Promise<StageSubstatus> {
  const payload = {
    pipeline_id: draft.pipeline_id,
    stage_value: draft.stage_value,
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    color: draft.color?.trim() || null,
    position: draft.position ?? 0,
    is_active: draft.is_active ?? true,
    is_default: draft.is_default ?? false,
  };

  // Um só padrão por etapa: desmarca os demais antes de gravar.
  if (payload.is_default) {
    let q = supabase
      .from("pipeline_stage_substatuses")
      .update({ is_default: false })
      .eq("pipeline_id", payload.pipeline_id)
      .eq("stage_value", payload.stage_value);
    if (draft.id) q = q.neq("id", draft.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }

  if (draft.id) {
    const { data, error } = await supabase
      .from("pipeline_stage_substatuses")
      .update(payload)
      .eq("id", draft.id)
      .select(sel(COLUMNS))
      .maybeSingle<StageSubstatus>();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Você não tem permissão para editar este substatus.");
    return data;
  }

  const { data, error } = await supabase
    .from("pipeline_stage_substatuses")
    // workspace_id é herdado do pipeline por gatilho no banco.
    .insert(payload as never)
    .select(sel(COLUMNS))
    .maybeSingle<StageSubstatus>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você não tem permissão para criar substatus.");
  return data;
}

export async function deleteSubstatus(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("pipeline_stage_substatuses")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para excluir este substatus.");
  }
}

/** Grava a ordem informada (índice do array vira `position`). */
export async function reorderSubstatuses(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("pipeline_stage_substatuses")
      .update({ position: i })
      .eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }
}

/** Invalida o cache de substatus de um pipeline (ou de todos). */
export function useInvalidateSubstatuses() {
  const qc = useQueryClient();
  return (pipelineId?: string | null) =>
    void qc.invalidateQueries({
      queryKey: pipelineId ? substatusesKey(pipelineId) : ["pipeline-substatuses"],
    });
}

/** Sugestões editáveis oferecidas na configuração da etapa. */
export function suggestedSubstatuses(stageType?: "open" | "won" | "lost" | null): string[] {
  if (stageType === "won") return ["Assinado", "Implantação iniciada"];
  if (stageType === "lost") return ["Sem orçamento", "Perdido para concorrente", "Sem resposta"];
  return ["Aguardando retorno", "Em análise interna", "Reunião agendada", "Follow-up agendado"];
}
