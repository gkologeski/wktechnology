/**
 * Suíte de Prospecção — Filas configuráveis de leads/contatos.
 *
 * Cada fila é um conjunto de filtros salvos que o SDR/BDR usa como fonte de
 * trabalho diária. Aplicação dos filtros contra as tabelas `leads`/`contacts`
 * respeita a RLS já existente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EntityEnum = z.enum(["lead", "contact"]);
const KindEnum = z.enum(["dynamic", "manual"]);

const FiltersSchema = z
  .object({
    status: z.array(z.string()).optional(),
    source: z.array(z.string()).optional(),
    owner_id: z.string().uuid().nullable().optional(),
    score_min: z.number().int().optional(),
    score_max: z.number().int().optional(),
    search: z.string().max(100).optional(),
    updated_after: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

const SortSchema = z
  .object({
    field: z.string().min(1).max(50).default("updated_at"),
    dir: z.enum(["asc", "desc"]).default("desc"),
  })
  .partial();

export const listQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prospecting_queues")
      .select("id, name, description, entity, kind, item_ids, filters, sort, is_shared, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        entity: EntityEnum,
        kind: KindEnum.default("dynamic"),
        item_ids: z.array(z.string().uuid()).max(10000).default([]),
        filters: FiltersSchema.default({}),
        sort: SortSchema.default({}),
        is_shared: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const payload = {
      owner_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      entity: data.entity,
      kind: data.kind,
      item_ids: data.item_ids,
      filters: data.filters,
      sort: data.sort,
      is_shared: data.is_shared,
    } as never;
    if (data.id) {
      const { error } = await context.supabase
        .from("prospecting_queues")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("prospecting_queues")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const addToQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        queue_id: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: queue, error: qErr } = await context.supabase
      .from("prospecting_queues")
      .select("id, kind, item_ids")
      .eq("id", data.queue_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!queue) throw new Error("Fila não encontrada");
    if ((queue as { kind: string }).kind !== "manual") {
      throw new Error("Só é possível adicionar itens em filas manuais.");
    }
    const current = ((queue as { item_ids: string[] }).item_ids ?? []) as string[];
    const merged = Array.from(new Set([...current, ...data.ids]));
    const { error } = await context.supabase
      .from("prospecting_queues")
      .update({ item_ids: merged } as never)
      .eq("id", data.queue_id);
    if (error) throw new Error(error.message);
    return { total: merged.length, added: merged.length - current.length };
  });

export const removeFromQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        queue_id: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: queue, error: qErr } = await context.supabase
      .from("prospecting_queues")
      .select("id, item_ids")
      .eq("id", data.queue_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!queue) throw new Error("Fila não encontrada");
    const current = ((queue as { item_ids: string[] }).item_ids ?? []) as string[];
    const remove = new Set(data.ids);
    const next = current.filter((id) => !remove.has(id));
    const { error } = await context.supabase
      .from("prospecting_queues")
      .update({ item_ids: next } as never)
      .eq("id", data.queue_id);
    if (error) throw new Error(error.message);
    return { total: next.length };
  });

export const enrollInCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        cadence_id: z.string().uuid(),
        entity: z.enum(["lead", "contact", "candidate"]),
        ids: z.array(z.string().uuid()).min(1).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    // Deduplica contra inscrições já existentes (mesma cadência + entity_id)
    const { data: existing } = await context.supabase
      .from("prospecting_enrollments")
      .select("entity_id")
      .eq("cadence_id", data.cadence_id)
      .in("entity_id", data.ids);
    const skip = new Set(((existing ?? []) as { entity_id: string }[]).map((r) => r.entity_id));
    const toInsert = data.ids
      .filter((id) => !skip.has(id))
      .map((id) => ({
        cadence_id: data.cadence_id,
        entity: data.entity,
        entity_id: id,
        owner_id: context.userId,
        status: "active",
        current_step: 1,
        next_run_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        started_by: context.userId,
      }));
    if (toInsert.length === 0) return { enrolled: 0, skipped: skip.size };
    const { error } = await context.supabase
      .from("prospecting_enrollments")
      .insert(toInsert as never);
    if (error) throw new Error(error.message);
    return { enrolled: toInsert.length, skipped: skip.size };
  });

export const deleteQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("prospecting_queues")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Aplica os filtros de uma fila contra a tabela alvo (leads/contacts) e retorna
 * a página de itens para o workspace de prospecção.
 */
export const listQueueItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        queue_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: queue, error: qErr } = await context.supabase
      .from("prospecting_queues")
      .select("*")
      .eq("id", data.queue_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!queue) throw new Error("Fila não encontrada");

    const table = queue.entity === "lead" ? "leads" : "contacts";
    const filters = (queue.filters ?? {}) as Record<string, unknown>;
    const sort = (queue.sort ?? {}) as { field?: string; dir?: "asc" | "desc" };

    let query = context.supabase
      .from(table)
      .select(
        queue.entity === "lead"
          ? "id, first_name, last_name, email, phone, company_name, status, source, score, updated_at, owner_id"
          : "id, first_name, last_name, email, phone, company_id, lifecycle_stage, updated_at, owner_id",
        { count: "exact" },
      );

    if ((queue as { kind?: string }).kind === "manual") {
      const ids = (((queue as { item_ids?: string[] }).item_ids) ?? []) as string[];
      if (ids.length === 0) return { items: [], total: 0, entity: queue.entity };
      query = query.in("id", ids);
    } else {
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        query = query.in("status", filters.status as string[]);
      }
      if (Array.isArray(filters.source) && filters.source.length > 0) {
        query = query.in("source", filters.source as string[]);
      }
      if (typeof filters.owner_id === "string") {
        query = query.eq("owner_id", filters.owner_id);
      }
      if (typeof filters.score_min === "number" && queue.entity === "lead") {
        query = query.gte("score", filters.score_min);
      }
      if (typeof filters.score_max === "number" && queue.entity === "lead") {
        query = query.lte("score", filters.score_max);
      }
      if (typeof filters.search === "string" && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        query =
          queue.entity === "lead"
            ? query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},company_name.ilike.${s}`)
            : query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
      }
      if (typeof filters.updated_after === "string") {
        query = query.gte("updated_at", filters.updated_after);
      }
    }
    const sortField = sort.field ?? "updated_at";
    const sortDir = sort.dir ?? "desc";
    query = query.order(sortField, { ascending: sortDir === "asc" });
    query = query.range(data.offset, data.offset + data.limit - 1);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], total: count ?? 0, entity: queue.entity };
  });
