// Resolve UUIDs de FKs comuns (usuário, empresa, pipeline, sequência,
// regra de rotação) para nomes amigáveis, para uso em descrições / chips
// do construtor de workflows.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

type Pipeline = { id: string; name: string; stages: unknown };

export function useReferenceLabels() {
  const { nameFor: nameForUser, byId: userById } = useWorkspaceMembers();

  const { data: companies = [] } = useQuery({
    queryKey: ["ref-companies-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["ref-pipelines-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, stages");
      if (error) throw error;
      return (data ?? []) as Pipeline[];
    },
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["ref-sequences-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("sequences").select("id, name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["ref-rotation-rules-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotation_rules")
        .select("id, name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const maps = useMemo(() => {
    const co = new Map(companies.map((c) => [c.id, c.name]));
    const pi = new Map(pipelines.map((p) => [p.id, p.name]));
    const seq = new Map(sequences.map((s) => [s.id, s.name]));
    const rr = new Map(rules.map((r) => [r.id, r.name]));
    // Map de stages: value → label amigável (por pipeline)
    const stageByPipeline = new Map<string, Map<string, string>>();
    const stageGlobal = new Map<string, string>();
    for (const p of pipelines) {
      const stages = Array.isArray(p.stages)
        ? (p.stages as Array<{ value?: string; label?: string }>)
        : [];
      const m = new Map<string, string>();
      for (const s of stages) {
        if (!s?.value) continue;
        const label = s.label ?? s.value;
        m.set(s.value, label);
        if (!stageGlobal.has(s.value)) stageGlobal.set(s.value, label);
      }
      stageByPipeline.set(p.id, m);
    }
    return { co, pi, seq, rr, stageByPipeline, stageGlobal };
  }, [companies, pipelines, sequences, rules]);

  function short(id: string | null | undefined, prefix: string) {
    if (!id) return "—";
    return `${prefix} ${id.slice(0, 8)}…`;
  }

  return {
    userById,
    companies,
    pipelines,
    sequences,
    rules,
    labelForUser: (id: string | null | undefined) => nameForUser(id),
    labelForCompany: (id: string | null | undefined) =>
      !id ? "—" : maps.co.get(id) ?? short(id, "empresa"),
    labelForPipeline: (id: string | null | undefined) =>
      !id ? "—" : maps.pi.get(id) ?? short(id, "pipeline"),
    labelForSequence: (id: string | null | undefined) =>
      !id ? "—" : maps.seq.get(id) ?? short(id, "sequência"),
    labelForRule: (id: string | null | undefined) =>
      !id ? "—" : maps.rr.get(id) ?? short(id, "regra"),
    labelForStage: (
      pipelineId: string | null | undefined,
      stageValue: string | null | undefined,
    ) => {
      if (!stageValue) return "—";
      if (pipelineId) {
        const m = maps.stageByPipeline.get(pipelineId);
        const l = m?.get(stageValue);
        if (l) return l;
      }
      return maps.stageGlobal.get(stageValue) ?? stageValue;
    },
  };
}

export type ReferenceLabels = ReturnType<typeof useReferenceLabels>;
