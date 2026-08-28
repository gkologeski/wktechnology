// Resolve IDs presentes no histórico de propriedades para nomes legíveis
// (responsável, pipeline, etapa, substatus, empresa, contato).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { NEUTRAL_LABELS, STAGE_VALUE_LABELS, isUuid } from "@/lib/timeline/property-labels";
import type { PropertyChangeRow } from "@/lib/timeline/history-groups";

type LabelMap = Map<string, string>;

const USER_PROPS = new Set(["owner_id", "assigned_to", "assigned_user_id", "changed_by"]);

/** Propriedades cujo valor é uma etapa de pipeline (slug ou id legado). */
const STAGE_PROPS = new Set(["stage", "stage_id"]);

/** `property_history.entity` (plural) -> `pipelines.entity` (singular). */
const PIPELINE_ENTITY: Record<string, string> = {
  leads: "lead",
  deals: "deal",
  tickets: "ticket",
};

export function useHistoryLabels(rows: PropertyChangeRow[]) {
  const { nameFor } = useWorkspaceMembers();
  const [labels, setLabels] = useState<LabelMap>(new Map());
  // Enquanto as consultas não terminam, evitamos o rótulo neutro (que seria
  // exibido e depois substituído pelo nome real).
  const [loaded, setLoaded] = useState(false);

  // IDs por tipo de referência, derivados das propriedades alteradas.
  const wanted = useMemo(() => {
    const pipelines = new Set<string>();
    const substatuses = new Set<string>();
    const companies = new Set<string>();
    const contacts = new Set<string>();
    const sources = new Set<string>();
    const stageEntities = new Set<string>();
    for (const r of rows) {
      if (STAGE_PROPS.has(r.property)) {
        const pe = PIPELINE_ENTITY[r.entity];
        if (pe) stageEntities.add(pe);
      }
      for (const v of [r.old_value, r.new_value]) {
        if (!isUuid(v)) continue;
        if (r.property === "pipeline_id") pipelines.add(v);
        else if (r.property === "stage_substatus_id") substatuses.add(v);
        else if (r.property === "company_id") companies.add(v);
        else if (r.property === "contact_id" || r.property === "primary_contact_id")
          contacts.add(v);
        else if (r.property === "source_id") sources.add(v);
      }
    }
    return { pipelines, substatuses, companies, contacts, sources, stageEntities };
  }, [rows]);

  const key = useMemo(
    () =>
      JSON.stringify([
        [...wanted.pipelines].sort(),
        [...wanted.substatuses].sort(),
        [...wanted.companies].sort(),
        [...wanted.contacts].sort(),
        [...wanted.sources].sort(),
        [...wanted.stageEntities].sort(),
      ]),
    [wanted],
  );

  useEffect(() => {
    const { pipelines, substatuses, companies, contacts, sources, stageEntities } = wanted;
    const total =
      pipelines.size +
      substatuses.size +
      companies.size +
      contacts.size +
      sources.size +
      stageEntities.size;
    if (total === 0) {
      setLabels((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    const next: LabelMap = new Map();

    const tasks: Array<PromiseLike<unknown>> = [];
    if (pipelines.size > 0) {
      tasks.push(
        supabase
          .from("pipelines")
          .select("id, name")
          .in("id", [...pipelines])
          .then(({ data }) => {
            for (const p of data ?? []) next.set(p.id, p.name ?? p.id);
          }),
      );
    }
    if (substatuses.size > 0) {
      tasks.push(
        supabase
          .from("pipeline_stage_substatuses")
          .select("id, name")
          .in("id", [...substatuses])
          .then(({ data }) => {
            for (const s of data ?? []) next.set(s.id, s.name ?? s.id);
          }),
      );
    }
    if (companies.size > 0) {
      tasks.push(
        supabase
          .from("companies")
          .select("id, name")
          .in("id", [...companies])
          .then(({ data }) => {
            for (const c of data ?? []) next.set(c.id, c.name ?? c.id);
          }),
      );
    }
    if (contacts.size > 0) {
      tasks.push(
        supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .in("id", [...contacts])
          .then(({ data }) => {
            for (const c of data ?? []) {
              const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
              next.set(c.id, full || c.id);
            }
          }),
      );
    }
    if (sources.size > 0) {
      tasks.push(
        supabase
          .from("lead_sources")
          .select("id, label")
          .in("id", [...sources])
          .then(({ data }) => {
            for (const s of (data ?? []) as Array<{ id: string; label: string | null }>) {
              next.set(s.id, s.label ?? s.id);
            }
          }),
      );
    }

    if (stageEntities.size > 0) {
      tasks.push(
        supabase
          .from("pipelines")
          .select("id, entity, stages")
          .in("entity", [...stageEntities])
          .then(({ data }) => {
            for (const p of (data ?? []) as Array<{ stages: unknown }>) {
              const stages = Array.isArray(p.stages)
                ? (p.stages as Array<Record<string, unknown>>)
                : [];
              for (const st of stages) {
                const label = String(st["label"] ?? "").trim();
                if (!label) continue;
                // Pipelines importados guardam o id do provedor em `value`;
                // outros usam `id`. Indexamos as duas chaves.
                for (const key of [st["value"], st["id"]]) {
                  const raw = key === null || key === undefined ? "" : String(key);
                  if (raw) next.set(`stage:${raw}`, label);
                }
              }
            }
          }),
      );
    }

    void Promise.allSettled(tasks).then(() => {
      if (!cancelled) setLabels(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Rótulo de um valor de propriedade, resolvendo IDs conhecidos. */
  const resolveValue = (property: string, value: unknown): string | null => {
    if (STAGE_PROPS.has(property)) {
      if (value === null || value === undefined || value === "") return null;
      const raw = String(value);
      // 1) catálogo do pipeline; 2) enum pt-BR; 3) rótulo neutro.
      const label = labels.get(`stage:${raw}`);
      if (label) return label;
      const enumLabel = STAGE_VALUE_LABELS[raw.toLowerCase()];
      if (enumLabel) return enumLabel;
      if (/^\d{4,}$/.test(raw) || isUuid(raw)) return NEUTRAL_LABELS.legacyStage;
      return null;
    }
    if (!isUuid(value)) return null;
    if (USER_PROPS.has(property)) {
      const name = nameFor(value);
      return name && name !== "—" ? name : null;
    }
    // UUID sem correspondência nunca deve aparecer cru na timeline.
    return labels.get(value) ?? NEUTRAL_LABELS.missingRecord;
  };

  const resolveActor = (id: string | null) => (id ? nameFor(id) : "Sistema");

  return { resolveValue, resolveActor };
}
