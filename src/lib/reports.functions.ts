import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Whitelist of entities + group-by fields + numeric (sumable) fields + date fields
export const REPORT_ENTITIES = {
  deals: {
    label: "Negócios",
    table: "deals",
    groupBy: ["stage", "stage_id", "pipeline_id", "owner_id", "source"],
    numeric: ["amount", "probability"],
    date: ["created_at", "close_date", "updated_at"],
  },
  leads: {
    label: "Leads",
    table: "leads",
    groupBy: ["status", "source", "owner_id", "pipeline_id"],
    numeric: ["score"],
    date: ["created_at", "updated_at"],
  },
  contacts: {
    label: "Contatos",
    table: "contacts",
    groupBy: ["owner_id", "lifecycle_stage", "lead_status"],
    numeric: [],
    date: ["created_at"],
  },
  tickets: {
    label: "Tickets",
    table: "tickets",
    groupBy: ["status", "priority", "owner_id", "source", "pipeline_id"],
    numeric: [],
    date: ["created_at", "closed_at"],
  },
  activities: {
    label: "Atividades",
    table: "activities",
    groupBy: ["type", "owner_id", "status"],
    numeric: [],
    date: ["created_at", "scheduled_at", "completed_at"],
  },
  tasks: {
    label: "Tarefas",
    table: "tasks",
    groupBy: ["status", "priority", "owner_id"],
    numeric: [],
    date: ["created_at", "due_at", "completed_at"],
  },
  subscriptions: {
    label: "Assinaturas",
    table: "subscriptions",
    groupBy: ["status", "interval", "owner_id", "plan_id"],
    numeric: ["amount"],
    date: ["start_date", "created_at"],
  },
} as const;

export type ReportEntity = keyof typeof REPORT_ENTITIES;

const ConfigSchema = z.object({
  entity: z.enum(Object.keys(REPORT_ENTITIES) as [ReportEntity, ...ReportEntity[]]),
  groupBy: z.string().min(1).max(64),
  metric: z.enum(["count", "sum", "avg"]).default("count"),
  metricField: z.string().max(64).optional(),
  chartType: z.enum(["bar", "line", "pie", "table"]).default("bar"),
  dateField: z.string().max(64).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

// ---------- CRUD ----------
export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("custom_reports").select("*")
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).nullable().optional(),
    config: ConfigSchema,
    is_favorite: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      description: data.description ?? null,
      entity: data.config.entity,
      config: data.config,
      is_favorite: data.is_favorite,
    };
    if (data.id) {
      const { error } = await supabase.from("custom_reports").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("custom_reports").insert({ ...payload, owner_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Run ----------
export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ config: ConfigSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cfg = data.config;
    const ent = REPORT_ENTITIES[cfg.entity];
    if (!ent.groupBy.includes(cfg.groupBy as never)) {
      throw new Error(`Campo de agrupamento inválido para ${ent.label}.`);
    }
    if (cfg.metric !== "count") {
      if (!cfg.metricField || !ent.numeric.includes(cfg.metricField as never)) {
        throw new Error("Campo numérico inválido para soma/média.");
      }
    }
    // Select only what we need
    const selectCols = cfg.metric === "count"
      ? cfg.groupBy
      : `${cfg.groupBy},${cfg.metricField}`;
    let q = supabase.from(ent.table).select(selectCols).limit(5000);
    if (cfg.dateField && ent.date.includes(cfg.dateField as never)) {
      if (cfg.dateFrom) q = q.gte(cfg.dateField, cfg.dateFrom);
      if (cfg.dateTo) q = q.lte(cfg.dateField, cfg.dateTo);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Aggregate in JS (safe, no dynamic SQL)
    const buckets = new Map<string, { key: string; count: number; sum: number }>();
    for (const r of (rows ?? []) as Record<string, unknown>[]) {
      const k = String(r[cfg.groupBy] ?? "—");
      const b = buckets.get(k) ?? { key: k, count: 0, sum: 0 };
      b.count += 1;
      if (cfg.metric !== "count" && cfg.metricField) {
        const v = Number(r[cfg.metricField] ?? 0);
        if (!Number.isNaN(v)) b.sum += v;
      }
      buckets.set(k, b);
    }
    const arr = Array.from(buckets.values()).map((b) => ({
      key: b.key,
      value: cfg.metric === "count" ? b.count : cfg.metric === "sum" ? b.sum : (b.count ? b.sum / b.count : 0),
      count: b.count,
    }));
    arr.sort((a, b) => b.value - a.value);
    return { rows: arr.slice(0, cfg.limit), total: arr.length };
  });

export const toggleReportFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_favorite: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("custom_reports").update({ is_favorite: data.is_favorite }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
