// Server functions para gerenciamento de listas (segments).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SEGMENT_ENTITIES = ["leads", "contacts", "companies", "deals"] as const;
export type SegmentEntity = (typeof SEGMENT_ENTITIES)[number];

const FilterNodeSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("group"),
      op: z.enum(["and", "or"]),
      conditions: z.array(FilterNodeSchema),
    }),
    z.object({
      type: z.literal("condition"),
      field: z.string(),
      op: z.string(),
      value: z.unknown().optional(),
    }),
  ]),
);

export const listSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("segments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { segments: data ?? [] };
  });

export const upsertSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        entity: z.enum(SEGMENT_ENTITIES),
        kind: z.enum(["static", "dynamic"]),
        filters: FilterNodeSchema.optional(),
        enabled: z.boolean().optional(),
        refresh_interval_minutes: z.number().int().min(5).max(1440).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      kind: data.kind,
      filters: data.filters ?? { type: "group", op: "and", conditions: [] },
      enabled: data.enabled ?? true,
      refresh_interval_minutes: data.refresh_interval_minutes ?? 60,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("segments")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return { segment: row };
    }
    const { data: row, error } = await supabase.from("segments").insert(payload).select().single();
    if (error) throw error;
    return { segment: row };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("segments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listSegmentMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        segmentId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: seg, error: segErr } = await supabase
      .from("segments")
      .select("entity")
      .eq("id", data.segmentId)
      .single();
    if (segErr || !seg) throw new Error(segErr?.message ?? "Lista não encontrada");

    const { data: members, error: memErr } = await supabase
      .from("segment_members")
      .select("entity_id, added_at")
      .eq("segment_id", data.segmentId)
      .order("added_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (memErr) throw memErr;

    const ids = (members ?? []).map((m) => m.entity_id);
    if (ids.length === 0) return { entity: seg.entity, rows: [] };

    const selectCols =
      seg.entity === "deals"
        ? "id, name, amount, stage, created_at"
        : seg.entity === "companies"
          ? "id, name, domain, industry, created_at"
          : "id, first_name, last_name, email, created_at";
    const { data: entRows, error: entErr } = await supabase
      .from(seg.entity as "leads" | "contacts" | "companies" | "deals")
      .select(selectCols)
      .in("id", ids);
    if (entErr) throw entErr;
    return { entity: seg.entity, rows: entRows ?? [] };
  });

export const refreshSegmentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // ownership check via RLS
    const { data: seg, error } = await context.supabase
      .from("segments")
      .select("id")
      .eq("id", data.id)
      .single();
    if (error || !seg) throw new Error("Lista não encontrada");
    const { refreshDynamicSegment } = await import("@/lib/segments/engine.server");
    return await refreshDynamicSegment(data.id);
  });

export const addStaticMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        segmentId: z.string().uuid(),
        entityIds: z.array(z.string().uuid()).min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const rows = data.entityIds.map((eid) => ({ segment_id: data.segmentId, entity_id: eid }));
    const { error } = await supabase
      .from("segment_members")
      .upsert(rows, { onConflict: "segment_id,entity_id" });
    if (error) throw error;
    const { count } = await supabase
      .from("segment_members")
      .select("entity_id", { count: "exact", head: true })
      .eq("segment_id", data.segmentId);
    await supabase
      .from("segments")
      .update({ member_count: count ?? 0 })
      .eq("id", data.segmentId);
    return { ok: true, count: count ?? 0 };
  });

export const removeStaticMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        segmentId: z.string().uuid(),
        entityId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("segment_members")
      .delete()
      .eq("segment_id", data.segmentId)
      .eq("entity_id", data.entityId);
    if (error) throw error;
    const { count } = await supabase
      .from("segment_members")
      .select("entity_id", { count: "exact", head: true })
      .eq("segment_id", data.segmentId);
    await supabase
      .from("segments")
      .update({ member_count: count ?? 0 })
      .eq("id", data.segmentId);
    return { ok: true, count: count ?? 0 };
  });
