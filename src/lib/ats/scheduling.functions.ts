import { getActiveWorkspaceId, assertAnyPermission } from "@/lib/access-control/enforce.server";
import { assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import {
  commonAvailabilitySlots,
  type WeeklyWindow,
  type BusyInterval,
} from "./availability-slots";
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
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    const { data: pools, error } = await supabase
      .from("ats_interviewer_pools")
      .select("id, name, description, rotation_strategy, rotation_cursor, load_window_days")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (pools ?? []).map((p) => p.id as string);
    if (ids.length === 0) return [];
    const { data: members, error: membersError } = await supabase
      .from("ats_interviewer_pool_members")
      .select("id, pool_id, interviewer_id, weight")
      .in("pool_id", ids)
      .eq("workspace_id", workspaceId);
    if (membersError) throw new Error(membersError.message);
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
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    if (data.id) await assertHrRecordAccess(supabase, "interviewer_pools", "update", data.id);
    else
      await assertAnyPermission(supabase, userId, workspaceId, [
        "techhire.interviewer_pools.create.own",
        "techhire.interviewer_pools.create.workspace",
      ]);
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("ats_interviewer_pools")
        .update({
          name: data.name,
          description: data.description ?? null,
          rotation_strategy: data.rotation_strategy,
          load_window_days: data.load_window_days,
        } as never)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single();
      if (!updated && !error) throw new Error("Pool indisponível ou sem permissão.");
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_interviewer_pools")
      .insert({
        owner_id: userId,
        workspace_id: workspaceId,
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
    await assertHrRecordAccess(context.supabase, "interviewer_pools", "delete", data.id);
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
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    await assertHrRecordAccess(supabase, "interviewer_pools", "update", data.pool_id);
    const { data: existing, error: readError } = await supabase
      .from("ats_interviewer_pool_members")
      .select("id")
      .eq("pool_id", data.pool_id)
      .eq("interviewer_id", data.interviewer_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const result = existing
      ? await supabase
          .from("ats_interviewer_pool_members")
          .update({ weight: data.weight } as never)
          .eq("id", existing.id)
          .eq("workspace_id", workspaceId)
          .select("id")
          .single()
      : await supabase
          .from("ats_interviewer_pool_members")
          .insert({
            owner_id: userId,
            workspace_id: workspaceId,
            pool_id: data.pool_id,
            interviewer_id: data.interviewer_id,
            weight: data.weight,
          } as never)
          .select("id")
          .single();
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const removePoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: member, error } = await context.supabase
      .from("ats_interviewer_pool_members")
      .select("pool_id")
      .eq("id", data.id)
      .single();
    if (error || !member) throw new Error("Membro indisponível.");
    await assertHrRecordAccess(context.supabase, "interviewer_pools", "update", member.pool_id);
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
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    let q = supabase
      .from("ats_interviewer_availability")
      .select("id, interviewer_id, weekday, start_minute, end_minute, timezone")
      .eq("workspace_id", workspaceId)
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
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    if (data.id)
      await assertHrRecordAccess(supabase, "interviewer_availability", "update", data.id);
    else {
      const access = await supabase.rpc(
        "ats_config_action_access" as never,
        {
          _workspace: workspaceId,
          _resource: "interviewer_availability",
          _action: "create",
          _subject: data.interviewer_id,
        } as never,
      );
      if (access.error || !access.data)
        throw new Error("Sem permissão para configurar esta agenda.");
    }
    const payload = {
      interviewer_id: data.interviewer_id,
      weekday: data.weekday,
      start_minute: data.start_minute,
      end_minute: data.end_minute,
      timezone: data.timezone,
    };
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("ats_interviewer_availability")
        .update(payload as never)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single();
      if (!updated && !error) throw new Error("Janela indisponível ou sem permissão.");
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_interviewer_availability")
      .insert({ owner_id: userId, workspace_id: workspaceId, ...payload } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertHrRecordAccess(context.supabase, "interviewer_availability", "delete", data.id);
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
    const { data: chosen, error } = await context.supabase.rpc(
      "ats_assign_interviewer_pool" as never,
      { _pool: data.pool_id } as never,
    );
    if (error) throw new Error(error.message);
    if (!chosen) throw new Error("Pool sem entrevistador disponível.");
    return { interviewer_id: chosen as string };
  });

// ----- slot intersection (panel availability) -------------------------------

/**
 * Calcula slots de N minutos em comum entre vários entrevistadores, dentro de
 * uma janela de datas. Respeita fusos IANA e usa apenas intervalos ocupados sem PII.
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
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    const { data: busy, error: busyError } = await supabase.rpc(
      "ats_busy_intervals" as never,
      { _interviewers: data.interviewer_ids, _from: data.from, _to: data.to } as never,
    );
    if (busyError) throw new Error(busyError.message);
    const { data: rows, error } = await supabase
      .from("ats_interviewer_availability")
      .select("interviewer_id,weekday,start_minute,end_minute,timezone")
      .eq("workspace_id", workspaceId)
      .in("interviewer_id", data.interviewer_ids);
    if (error) throw new Error(error.message);
    return {
      slots: commonAvailabilitySlots(
        data.interviewer_ids,
        rows as WeeklyWindow[],
        (busy ?? []) as BusyInterval[],
        data.from,
        data.to,
        data.duration_min,
        data.step_min,
      ),
    };
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
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techhire.interviews.view.workspace",
    ]);
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
    const { data: scheduled, error: scheduledError } = await supabase
      .from("ats_interviews")
      .select("application_id")
      .in("application_id", appIds)
      .in("status", ["scheduled", "done", "pending_candidate"]);
    if (scheduledError) throw new Error(scheduledError.message);
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

export const listAvailabilityCreateTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase.rpc("ats_availability_create_targets" as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as string[];
  });
