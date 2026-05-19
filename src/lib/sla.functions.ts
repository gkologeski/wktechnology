// Server functions for SLA por pipeline stage.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EntityEnum = z.enum(["leads", "deals"]);

export interface SlaBreach {
  id: string;
  entity: "leads" | "deals";
  entity_id: string;
  pipeline_id: string | null;
  stage_id: string;
  sla_hours: number;
  entered_at: string;
  elapsed_hours: number;
  overdue_hours: number;
  entity_label: string;
}

export const listSlaBreaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SlaBreach[]> => {
    const { supabase } = context;
    const { data: open, error } = await supabase
      .from("stage_entries")
      .select("id, entity, entity_id, pipeline_id, stage_id, sla_hours, entered_at")
      .is("exited_at", null)
      .not("sla_hours", "is", null)
      .order("entered_at", { ascending: true });
    if (error) throw new Error(error.message);

    const now = Date.now();
    const breaches = (open ?? []).map((r) => {
      const elapsed = (now - new Date(r.entered_at as string).getTime()) / 36e5;
      const sla = Number(r.sla_hours);
      return {
        ...r,
        elapsed_hours: elapsed,
        overdue_hours: elapsed - sla,
      } as Omit<SlaBreach, "entity_label">;
    }).filter((r) => r.overdue_hours > 0);

    // Buscar nomes
    const leadIds = breaches.filter((b) => b.entity === "leads").map((b) => b.entity_id);
    const dealIds = breaches.filter((b) => b.entity === "deals").map((b) => b.entity_id);
    const [leadsRes, dealsRes] = await Promise.all([
      leadIds.length
        ? supabase.from("leads").select("id, first_name, last_name, company_name").in("id", leadIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name?: string | null; company_name?: string | null }> }),
      dealIds.length
        ? supabase.from("deals").select("id, name").in("id", dealIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const labelMap = new Map<string, string>();
    for (const l of (leadsRes.data ?? [])) {
      labelMap.set(`leads:${l.id}`, [l.first_name, l.last_name].filter(Boolean).join(" ").trim() || l.company_name || l.id.slice(0, 8));
    }
    for (const d of (dealsRes.data ?? [])) {
      labelMap.set(`deals:${d.id}`, d.name || d.id.slice(0, 8));
    }

    return breaches.map((b) => ({
      ...b,
      entity: b.entity as "leads" | "deals",
      sla_hours: Number(b.sla_hours),
      entity_label: labelMap.get(`${b.entity}:${b.entity_id}`) ?? b.entity_id.slice(0, 8),
    }));
  });

/** Lista pipelines (leads + deals) para o editor de SLA. */
export const listPipelinesForSla = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pipelines")
      .select("id, name, entity, stages, is_default")
      .order("entity", { ascending: true })
      .order("is_default", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      ...p,
      stages: Array.isArray(p.stages) ? (p.stages as Array<{ value: string; label: string; sla_hours?: number | null }>) : [],
    }));
  });

/** Atualiza sla_hours por estágio em uma pipeline. */
export const setPipelineSla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    pipeline_id: z.string().uuid(),
    sla: z.record(z.string().min(1).max(100), z.number().min(0).max(100000).nullable()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pipe, error } = await supabase
      .from("pipelines")
      .select("stages")
      .eq("id", data.pipeline_id)
      .single();
    if (error || !pipe) throw new Error("Pipeline não encontrado");
    const stages = (Array.isArray(pipe.stages) ? pipe.stages : []) as Array<Record<string, unknown>>;
    const next = stages.map((s) => {
      const v = String(s.value ?? "");
      if (!(v in data.sla)) return s;
      const h = data.sla[v];
      const copy: Record<string, unknown> = { ...s };
      if (h === null || h === undefined) delete copy.sla_hours;
      else copy.sla_hours = h;
      return copy;
    });
    const { error: upErr } = await supabase
      .from("pipelines")
      .update({ stages: next as never })
      .eq("id", data.pipeline_id);
    if (upErr) throw new Error(upErr.message);

    // Atualiza sla_hours das entradas abertas (sem mudar entered_at)
    for (const s of next) {
      const v = String(s.value ?? "");
      if (!(v in data.sla)) continue;
      await supabase
        .from("stage_entries")
        .update({ sla_hours: (s as { sla_hours?: number }).sla_hours ?? null })
        .is("exited_at", null)
        .eq("stage_id", v);
    }
    return { ok: true };
  });

/** Conta breaches ativos (para badge no menu). */
export const countSlaBreaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stage_entries")
      .select("entered_at, sla_hours")
      .is("exited_at", null)
      .not("sla_hours", "is", null);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const count = (data ?? []).filter((r) => {
      const elapsed = (now - new Date(r.entered_at as string).getTime()) / 36e5;
      return elapsed > Number(r.sla_hours);
    }).length;
    return { count };
  });
