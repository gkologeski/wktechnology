/**
 * Talent CRM — Onda 5 / Slice 2 / Fase 1.
 *
 * Pools de candidatos (estáticos e smart), membros e status de relacionamento.
 * Smart lists são resolvidas server-side a partir de `filters` (jsonb) com
 * LIMIT para evitar queries custosas. Eventos registrados via recordAtsEvent.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

const POOL_TYPE = z.enum(["static", "smart"]);
const RELATIONSHIP_STATUS = z.enum(["cold", "engaged", "nurturing", "do_not_contact"]);

export const listPools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_talent_pools")
      .select("id, name, description, type, filters, color, system_key, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // contagem por pool
    const ids = (data ?? []).map((p) => p.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: members } = await context.supabase
        .from("ats_talent_pool_members")
        .select("pool_id")
        .in("pool_id", ids);
      counts = (members ?? []).reduce<Record<string, number>>((acc, m) => {
        acc[m.pool_id] = (acc[m.pool_id] ?? 0) + 1;
        return acc;
      }, {});
    }
    return { pools: (data ?? []).map((p) => ({ ...p, member_count: counts[p.id] ?? 0 })) };
  });

export const getPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: pool, error } = await context.supabase
      .from("ats_talent_pools")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pool) throw new Error("Pool não encontrado");
    return { pool };
  });

export const createPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        type: POOL_TYPE.default("static"),
        filters: z.record(z.unknown()).optional(),
        color: z.string().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ats_talent_pools")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        filters: data.filters ?? {},
        color: data.color ?? null,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updatePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        type: POOL_TYPE.optional(),
        filters: z.record(z.unknown()).optional(),
        color: z.string().max(20).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("ats_talent_pools")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("ats_talent_pools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addToPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pool_id: z.string().uuid(),
        candidate_ids: z.array(z.string().uuid()).min(1).max(500),
        source: z
          .enum(["manual", "auto", "referral", "silver_medalist", "sequence", "import"])
          .default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const rows = data.candidate_ids.map((cid) => ({
      pool_id: data.pool_id,
      candidate_id: cid,
      owner_id: context.userId,
      added_by: context.userId,
      source: data.source,
    }));
    const { error } = await context.supabase
      .from("ats_talent_pool_members")
      .upsert(rows as never, { onConflict: "pool_id,candidate_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    for (const cid of data.candidate_ids) {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.candidate.added_to_pool",
        entityType: "candidate",
        entityId: cid,
        payload: { pool_id: data.pool_id, source: data.source },
      });
    }
    return { added: rows.length };
  });

export const removeFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pool_id: z.string().uuid(),
        candidate_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_talent_pool_members")
      .delete()
      .eq("pool_id", data.pool_id)
      .eq("candidate_id", data.candidate_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPoolMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pool_id: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_talent_pool_members")
      .select(
        "id, candidate_id, source, added_at, candidate:ats_candidates(id, full_name, email, phone, location, headline, relationship_status, last_touch_at, next_action_at)",
      )
      .eq("pool_id", data.pool_id)
      .order("added_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { members: rows ?? [] };
  });

export const updateRelationshipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        status: RELATIONSHIP_STATUS,
        owner_user_id: z.string().uuid().nullable().optional(),
        next_action_at: z.string().datetime().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {
      relationship_status: data.status,
      last_touch_at: new Date().toISOString(),
    };
    if (data.owner_user_id !== undefined) patch.relationship_owner_id = data.owner_user_id;
    if (data.next_action_at !== undefined) patch.next_action_at = data.next_action_at;

    const { error } = await context.supabase
      .from("ats_candidates")
      .update(patch as never)
      .eq("id", data.candidate_id);
    if (error) throw new Error(error.message);

    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.candidate.relationship_changed",
      entityType: "candidate",
      entityId: data.candidate_id,
      payload: { status: data.status },
    });
    return { ok: true };
  });

export const getCandidatePools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ candidate_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_talent_pool_members")
      .select("pool_id, source, added_at, pool:ats_talent_pools(id, name, color, type)")
      .eq("candidate_id", data.candidate_id);
    if (error) throw new Error(error.message);
    return { pools: rows ?? [] };
  });

/**
 * Re-engaja membros de um pool em uma sequência existente (Onda 5 / 5.5).
 * Loop com cap 200 membros para evitar runs longos.
 */
export const enqueueReEngageNurture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pool_id: z.string().uuid(),
        sequence_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(200),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: members, error } = await context.supabase
      .from("ats_talent_pool_members")
      .select("candidate_id")
      .eq("pool_id", data.pool_id)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const candidateIds = (members ?? []).map((m) => m.candidate_id as string);
    if (candidateIds.length === 0) return { enrolled: 0 };

    const rows = candidateIds.map((cid) => ({
      sequence_id: data.sequence_id,
      candidate_id: cid,
      owner_id: context.userId,
      status: "active",
      current_step: 0,
      next_run_at: new Date().toISOString(),
      started_by: context.userId,
    }));
    const { error: insErr } = await context.supabase
      .from("ats_sourcing_enrollments")
      .upsert(rows as never, {
        onConflict: "sequence_id,candidate_id",
        ignoreDuplicates: true,
      });
    if (insErr) throw new Error(insErr.message);

    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.sequence.started",
      entityType: "talent_pool",
      entityId: data.pool_id,
      payload: { sequence_id: data.sequence_id, count: candidateIds.length },
    });
    return { enrolled: candidateIds.length };
  });
