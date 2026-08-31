// Onda 6 — Scheduling avançado.
// Server functions para pools de entrevistadores, disponibilidade semanal e
// cálculo de slots em comum (interseção multi-entrevistador).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

// ----- types ----------------------------------------------------------------

export type Pool = {
  id: string;
  name: string;
  description: string | null;
  rotation_strategy: "round_robin" | "load_balanced";
  rotation_cursor: number;
  load_window_days: number;
  members: { id: string; interviewer_id: string; weight: number }[];
};

export type AvailabilityWindow = {
  id: string;
  interviewer_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  timezone: string;
};

// ----- pools ----------------------------------------------------------------

export const listPools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Pool[]> => {
    const { supabase } = context;
    const { data: pools, error } = await supabase
      .from("ats_interviewer_pools")
      .select("id, name, description, rotation_strategy, rotation_cursor, load_window_days")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (pools ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];
    const { data: members } = await supabase
      .from("ats_interviewer_pool_members")
      .select("id, pool_id, interviewer_id, weight")
      .in("pool_id", ids);
    return (pools ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      description: (p.description as string | null) ?? null,
      rotation_strategy: p.rotation_strategy as "round_robin" | "load_balanced",
      rotation_cursor: (p.rotation_cursor as number) ?? 0,
      load_window_days: (p.load_window_days as number) ?? 14,
      members: (members ?? [])
        .filter((m) => m.pool_id === p.id)
        .map((m) => ({
          id: m.id as string,
          interviewer_id: m.interviewer_id as string,
          weight: (m.weight as number) ?? 1,
        })),
    }));
  });

export const upsertPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        rotation_strategy: z.enum(["round_robin", "load_balanced"]).default("round_robin"),
        load_window_days: z.number().int().min(1).max(90).default(14),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("ats_interviewer_pools")
        .update({
          name: data.name,
          description: data.description ?? null,
          rotation_strategy: data.rotation_strategy,
          load_window_days: data.load_window_days,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_interviewer_pools")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description ?? null,
        rotation_strategy: data.rotation_strategy,
        load_window_days: data.load_window_days,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deletePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await deleteByIdGuarded(
      context.supabase,
      "ats_interviewer_pools",
      data.id,
      "Você não tem permissão para excluir este pool de entrevistadores.",
    );
    return { ok: true };
  });

export const addPoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pool_id: z.string().uuid(),
        interviewer_id: z.string().uuid(),
        weight: z.number().int().min(0).max(100).default(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ats_interviewer_pool_members").upsert(
      {
        owner_id: userId,
        pool_id: data.pool_id,
        interviewer_id: data.interviewer_id,
        weight: data.weight,
      } as never,
      { onConflict: "pool_id,interviewer_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await deleteByIdGuarded(
      context.supabase,
      "ats_interviewer_pool_members",
      data.id,
      "Você não tem permissão para excluir este membro do pool.",
    );
    return { ok: true };
  });

// ----- availability ---------------------------------------------------------

export const listAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ interviewer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<AvailabilityWindow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("ats_interviewer_availability")
      .select("id, interviewer_id, weekday, start_minute, end_minute, timezone")
      .order("weekday", { ascending: true })
      .order("start_minute", { ascending: true });
    if (data.interviewer_id) q = q.eq("interviewer_id", data.interviewer_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AvailabilityWindow[];
  });

export const upsertAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        interviewer_id: z.string().uuid(),
        weekday: z.number().int().min(0).max(6),
        start_minute: z.number().int().min(0).max(1439),
        end_minute: z.number().int().min(1).max(1440),
        timezone: z.string().default("America/Sao_Paulo"),
      })
      .refine((v) => v.end_minute > v.start_minute, "end_minute deve ser maior")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload = {
      interviewer_id: data.interviewer_id,
      weekday: data.weekday,
      start_minute: data.start_minute,
      end_minute: data.end_minute,
      timezone: data.timezone,
    };
    if (data.id) {
      const { error } = await supabase
        .from("ats_interviewer_availability")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_interviewer_availability")
      .insert({ owner_id: userId, ...payload } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await deleteByIdGuarded(
      context.supabase,
      "ats_interviewer_availability",
      data.id,
      "Você não tem permissão para excluir esta disponibilidade.",
    );
    return { ok: true };
  });

// ----- assignment (round-robin / load-balanced) -----------------------------

export const assignFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pool_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ interviewer_id: string }> => {
    const { supabase } = context;
    const { data: pool, error: pErr } = await supabase
      .from("ats_interviewer_pools")
      .select("id, rotation_strategy, rotation_cursor, load_window_days")
      .eq("id", data.pool_id)
      .single();
    if (pErr || !pool) throw new Error(pErr?.message || "Pool não encontrada");

    const { data: members } = await supabase
      .from("ats_interviewer_pool_members")
      .select("interviewer_id, weight")
      .eq("pool_id", data.pool_id);
    const eligible = (members ?? []).filter((m) => (m.weight as number) > 0);
    if (eligible.length === 0) throw new Error("Pool sem membros ativos");

    if (pool.rotation_strategy === "round_robin") {
      const cursor = (pool.rotation_cursor as number) % eligible.length;
      const chosen = eligible[cursor].interviewer_id as string;
      await supabase
        .from("ats_interviewer_pools")
        .update({ rotation_cursor: (cursor + 1) % eligible.length } as never)
        .eq("id", data.pool_id);
      return { interviewer_id: chosen };
    }

    // load_balanced: contar interviews agendadas na janela
    const since = new Date(
      Date.now() - (pool.load_window_days as number) * 86_400_000,
    ).toISOString();
    const ids = eligible.map((m) => m.interviewer_id as string);
    const { data: counts } = await supabase
      .from("ats_interviews")
      .select("interviewer_id")
      .in("interviewer_id", ids)
      .gte("scheduled_at", since);
    const loadMap = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const row of counts ?? []) {
      const k = row.interviewer_id as string;
      loadMap.set(k, (loadMap.get(k) ?? 0) + 1);
    }
    // score = load / weight (menor é melhor)
    let best = eligible[0].interviewer_id as string;
    let bestScore = Infinity;
    for (const m of eligible) {
      const id = m.interviewer_id as string;
      const w = Math.max(1, m.weight as number);
      const score = (loadMap.get(id) ?? 0) / w;
      if (score < bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return { interviewer_id: best };
  });

// ----- slot intersection (panel availability) -------------------------------

/**
 * Calcula slots de N minutos em comum entre vários entrevistadores, dentro de
 * uma janela de datas. Ignora timezones (assume armazenamento UTC-naive nas
 * janelas de availability) — uma evolução futura usa luxon/temporal por tz.
 */
export const findCommonSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        interviewer_ids: z.array(z.string().uuid()).min(1).max(8),
        from: z.string().datetime(),
        to: z.string().datetime(),
        duration_min: z.number().int().min(15).max(240).default(45),
        step_min: z.number().int().min(15).max(120).default(30),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("ats_interviewer_availability")
      .select("interviewer_id, weekday, start_minute, end_minute")
      .in("interviewer_id", data.interviewer_ids);
    const { data: busyRows } = await supabase
      .from("ats_interviews")
      .select("interviewer_id, scheduled_at, duration_min, panel_interviewer_ids")
      .in("status", ["scheduled", "pending_candidate"])
      .gte("scheduled_at", data.from)
      .lte("scheduled_at", data.to);

    type Win = { weekday: number; start: number; end: number };
    const byInterviewer = new Map<string, Win[]>();
    for (const r of rows ?? []) {
      const id = r.interviewer_id as string;
      const arr = byInterviewer.get(id) ?? [];
      arr.push({
        weekday: r.weekday as number,
        start: r.start_minute as number,
        end: r.end_minute as number,
      });
      byInterviewer.set(id, arr);
    }

    type Busy = { interviewer_id: string; start: number; end: number };
    const busy: Busy[] = [];
    for (const b of busyRows ?? []) {
      const start = new Date(b.scheduled_at as string).getTime();
      const end = start + (b.duration_min as number) * 60_000;
      const panel = (b.panel_interviewer_ids as string[] | null) ?? [];
      const ids = new Set<string>([b.interviewer_id as string, ...panel]);
      for (const id of ids) {
        if (data.interviewer_ids.includes(id)) busy.push({ interviewer_id: id, start, end });
      }
    }

    const fromMs = new Date(data.from).getTime();
    const toMs = new Date(data.to).getTime();
    const stepMs = data.step_min * 60_000;
    const durMs = data.duration_min * 60_000;

    const isAvailable = (id: string, slotStart: number) => {
      const wins = byInterviewer.get(id);
      if (!wins || wins.length === 0) return false;
      const d = new Date(slotStart);
      const wd = d.getUTCDay();
      const startMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      const endMin = startMin + data.duration_min;
      const inWindow = wins.some((w) => w.weekday === wd && startMin >= w.start && endMin <= w.end);
      if (!inWindow) return false;
      const slotEnd = slotStart + durMs;
      const collide = busy.some(
        (b) => b.interviewer_id === id && slotStart < b.end && slotEnd > b.start,
      );
      return !collide;
    };

    const slots: string[] = [];
    // alinhar ao próximo múltiplo de step_min
    const alignedStart = Math.ceil(fromMs / stepMs) * stepMs;
    for (let t = alignedStart; t + durMs <= toMs; t += stepMs) {
      const allOk = data.interviewer_ids.every((id) => isAvailable(id, t));
      if (allOk) slots.push(new Date(t).toISOString());
      if (slots.length >= 50) break;
    }
    return { slots };
  });

// ----- SLA monitor ---------------------------------------------------------

export type SlaBreach = {
  application_id: string;
  candidate_id: string;
  job_id: string;
  stage_value: string;
  moved_at: string;
  hours_stuck: number;
  candidate_name: string | null;
  job_title: string | null;
};

/** Applications stuck in interview-bound stages without a scheduled interview. */
export const listOpenSchedulingSlaBreaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threshold_hours: z.number().int().min(1).max(720).default(48),
        stages: z.array(z.string()).default(["interview", "onsite", "panel"]),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<SlaBreach[]> => {
    const { supabase } = context;
    const { data: apps, error } = await supabase
      .from("ats_applications")
      .select("id, candidate_id, job_id, stage_value, moved_at, status")
      .in("stage_value", data.stages)
      .eq("status", "active")
      .order("moved_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const list = (apps ?? []) as Array<{
      id: string;
      candidate_id: string;
      job_id: string;
      stage_value: string;
      moved_at: string;
    }>;
    if (list.length === 0) return [];

    const appIds = list.map((a) => a.id);
    const { data: scheduled } = await supabase
      .from("ats_interviews")
      .select("application_id")
      .in("application_id", appIds)
      .in("status", ["scheduled", "completed"]);
    const hasInterview = new Set((scheduled ?? []).map((r) => r.application_id as string));

    const now = Date.now();
    const breaches: Array<{ a: (typeof list)[number]; hours: number }> = [];
    for (const a of list) {
      if (hasInterview.has(a.id)) continue;
      const hours = (now - new Date(a.moved_at).getTime()) / 3_600_000;
      if (hours >= data.threshold_hours) breaches.push({ a, hours });
    }
    if (breaches.length === 0) return [];

    const candIds = Array.from(new Set(breaches.map((b) => b.a.candidate_id)));
    const jobIds = Array.from(new Set(breaches.map((b) => b.a.job_id)));
    const [cands, jobs] = await Promise.all([
      supabase.from("ats_candidates").select("id, full_name").in("id", candIds),
      supabase.from("ats_jobs").select("id, title").in("id", jobIds),
    ]);
    const cMap = new Map(
      (cands.data ?? []).map((c) => [c.id as string, (c.full_name as string | null) ?? null]),
    );
    const jMap = new Map(
      (jobs.data ?? []).map((j) => [j.id as string, (j.title as string | null) ?? null]),
    );

    return breaches
      .map(({ a, hours }) => ({
        application_id: a.id,
        candidate_id: a.candidate_id,
        job_id: a.job_id,
        stage_value: a.stage_value,
        moved_at: a.moved_at,
        hours_stuck: Math.round(hours * 10) / 10,
        candidate_name: cMap.get(a.candidate_id) ?? null,
        job_title: jMap.get(a.job_id) ?? null,
      }))
      .sort((x, y) => y.hours_stuck - x.hours_stuck);
  });
