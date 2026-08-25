// Resolve UUIDs de FKs comuns (usuário, empresa, pipeline, sequência,
// regra de rotação) para nomes amigáveis. Faz pré-carregamento leve dos
// primeiros N registros e resolve IDs desconhecidos sob demanda via server
// functions autenticadas (respeitando RLS).
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  searchCompanies,
  searchContacts,
  searchPipelines,
  searchUsers,
} from "@/lib/workflow-refs.functions";

type Pipeline = { id: string; name: string; stages: unknown };

const LOADING_LABEL = "Carregando…";

export function useReferenceLabels() {
  const { nameFor: nameForUser, byId: userByIdMembers } = useWorkspaceMembers();
  const fetchCompanies = useServerFn(searchCompanies);
  const fetchContacts = useServerFn(searchContacts);
  const fetchPipelines = useServerFn(searchPipelines);
  const fetchUsers = useServerFn(searchUsers);

  const { data: companies = [] } = useQuery({
    queryKey: ["ref-companies-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["ref-pipelines-basic"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("id, name, stages");
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
      const { data, error } = await supabase.from("rotation_rules").select("id, name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const maps = useMemo(() => {
    const co = new Map(companies.map((c) => [c.id, c.name]));
    const pi = new Map(pipelines.map((p) => [p.id, p.name]));
    const seq = new Map(sequences.map((s) => [s.id, s.name]));
    const rr = new Map(rules.map((r) => [r.id, r.name]));
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

  // Resolução por demanda de IDs desconhecidos. Cada `labelFor*` enfileira
  // o ID; um efeito debounced dispara o server function em lote.
  const [pending, setPending] = useState<{
    company: Set<string>;
    pipeline: Set<string>;
    user: Set<string>;
    contact: Set<string>;
  }>({ company: new Set(), pipeline: new Set(), user: new Set(), contact: new Set() });
  const resolvedRef = useRef<{
    company: Map<string, string>;
    pipeline: Map<string, string>;
    user: Map<string, string>;
    contact: Map<string, string>;
  }>({ company: new Map(), pipeline: new Map(), user: new Map(), contact: new Map() });
  const requestedRef = useRef<{
    company: Set<string>;
    pipeline: Set<string>;
    user: Set<string>;
    contact: Set<string>;
  }>({ company: new Set(), pipeline: new Set(), user: new Set(), contact: new Set() });
  const [tick, setTick] = useState(0);

  function enqueue(kind: "company" | "pipeline" | "user" | "contact", id: string) {
    if (!id) return;
    if (resolvedRef.current[kind].has(id)) return;
    if (requestedRef.current[kind].has(id)) return;
    if (pending[kind].has(id)) return;
    setPending((prev) => {
      const next = new Set(prev[kind]);
      next.add(id);
      return { ...prev, [kind]: next };
    });
  }

  useEffect(() => {
    const hasWork =
      pending.company.size > 0 ||
      pending.pipeline.size > 0 ||
      pending.user.size > 0 ||
      pending.contact.size > 0;
    if (!hasWork) return;
    const t = setTimeout(async () => {
      const batches = {
        company: Array.from(pending.company),
        pipeline: Array.from(pending.pipeline),
        user: Array.from(pending.user),
        contact: Array.from(pending.contact),
      };
      // marcar como requested para evitar reenvios enquanto in-flight
      batches.company.forEach((id) => requestedRef.current.company.add(id));
      batches.pipeline.forEach((id) => requestedRef.current.pipeline.add(id));
      batches.user.forEach((id) => requestedRef.current.user.add(id));
      batches.contact.forEach((id) => requestedRef.current.contact.add(id));
      setPending({ company: new Set(), pipeline: new Set(), user: new Set(), contact: new Set() });

      await Promise.all([
        batches.company.length > 0 &&
          fetchCompanies({ data: { ids: batches.company } })
            .then((rows) => {
              rows.forEach((r) => resolvedRef.current.company.set(r.id, r.name));
            })
            .catch(() => {}),
        batches.pipeline.length > 0 &&
          fetchPipelines({ data: { ids: batches.pipeline } })
            .then((rows) => {
              rows.forEach((r) => resolvedRef.current.pipeline.set(r.id, r.name));
            })
            .catch(() => {}),
        batches.user.length > 0 &&
          fetchUsers({ data: { ids: batches.user } })
            .then((rows) => {
              // Grava mesmo com nome vazio para sinalizar "resolvido sem nome"
              rows.forEach((r) => resolvedRef.current.user.set(r.id, r.name ?? ""));
            })
            .catch(() => {}),
        batches.contact.length > 0 &&
          fetchContacts({ data: { ids: batches.contact } })
            .then((rows) => {
              rows.forEach((r) => resolvedRef.current.contact.set(r.id, r.name));
            })
            .catch(() => {}),
      ]);
      setTick((v) => v + 1);
    }, 120);
    return () => clearTimeout(t);
  }, [pending, fetchCompanies, fetchContacts, fetchPipelines, fetchUsers]);

  // Silence unused-variable warning: tick is only used to force re-render.
  void tick;

  function short(id: string | null | undefined, prefix: string) {
    if (!id) return "—";
    return `${prefix} ${id.slice(0, 8)}…`;
  }

  return {
    userById: userByIdMembers,
    companies,
    pipelines,
    sequences,
    rules,
    labelForUser: (id: string | null | undefined) => {
      if (!id) return "—";
      const m = userByIdMembers.get(id)?.full_name?.trim();
      if (m) return m;
      const resolved = resolvedRef.current.user.get(id);
      if (resolved && resolved.length > 0) return resolved;
      if (resolved === "") return "Usuário removido";
      enqueue("user", id);
      // fallback enquanto resolve: nome curto original do hook
      const fallback = nameForUser(id);
      return fallback && !/^[0-9a-f]{8}…$/i.test(fallback) ? fallback : LOADING_LABEL;
    },
    labelForCompany: (id: string | null | undefined) => {
      if (!id) return "—";
      const hit = maps.co.get(id);
      if (hit) return hit;
      const resolved = resolvedRef.current.company.get(id);
      if (resolved) return resolved;
      enqueue("company", id);
      return LOADING_LABEL;
    },
    labelForContact: (id: string | null | undefined) => {
      if (!id) return "—";
      const resolved = resolvedRef.current.contact.get(id);
      if (resolved && resolved.length > 0) return resolved;
      if (resolved === "") return "Contato removido";
      enqueue("contact", id);
      return LOADING_LABEL;
    },
    labelForPipeline: (id: string | null | undefined) => {
      if (!id) return "—";
      const hit = maps.pi.get(id);
      if (hit) return hit;
      const resolved = resolvedRef.current.pipeline.get(id);
      if (resolved) return resolved;
      enqueue("pipeline", id);
      return LOADING_LABEL;
    },
    labelForSequence: (id: string | null | undefined) =>
      !id ? "—" : (maps.seq.get(id) ?? short(id, "sequência")),
    labelForRule: (id: string | null | undefined) =>
      !id ? "—" : (maps.rr.get(id) ?? short(id, "regra")),
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
