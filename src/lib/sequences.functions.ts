import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickSequences } from "@/lib/sequences/engine.server";
import type { SequenceEntity, SequenceStep } from "@/lib/sequences/types";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const stepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task"),
    wait_days: z.number().min(0).max(365),
    subject: z.string().min(1).max(255),
    body: z.string().max(5000).optional(),
  }),
  z.object({
    type: z.literal("email"),
    wait_days: z.number().min(0).max(365),
    subject: z.string().min(1).max(255),
    body: z.string().max(10000).optional(),
  }),
  z.object({ type: z.literal("wait"), wait_days: z.number().min(0).max(365) }),
]);

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: z.enum(["leads", "contacts"]),
  enabled: z.boolean(),
  steps: z.array(stepSchema).min(1).max(50),
});

export const listSequences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: seqs, error } = await supabase
      .from("sequences")
      .select("id, name, entity, enabled, steps, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: counts } = await supabase
      .from("sequence_enrollments")
      .select("sequence_id, status")
      .eq("workspace_id", workspaceId);
    const byId: Record<string, { active: number; completed: number }> = {};
    for (const r of (counts ?? []) as Array<{ sequence_id: string; status: string }>) {
      byId[r.sequence_id] ||= { active: 0, completed: 0 };
      if (r.status === "active") byId[r.sequence_id].active++;
      if (r.status === "completed") byId[r.sequence_id].completed++;
    }
    return (seqs ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      entity: s.entity as SequenceEntity,
      enabled: s.enabled as boolean,
      steps: (s.steps as unknown as SequenceStep[]) ?? [],
      updated_at: s.updated_at as string,
      active_enrollments: byId[s.id]?.active ?? 0,
      completed_enrollments: byId[s.id]?.completed ?? 0,
    }));
  });

export const saveSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const payload = {
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      steps: data.steps as unknown as SequenceStep[],
    };
    if (data.id) {
      const { error } = await supabase.from("sequences").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("sequences")
      .insert({ ...payload, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sequences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEnrollments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sequenceId: z.string().uuid().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("sequence_enrollments")
      .select(
        "id, sequence_id, entity_id, current_step, status, enrolled_at, next_run_at, finished_at",
      )
      .order("enrolled_at", { ascending: false })
      .limit(data.limit);
    if (data.sequenceId) q = q.eq("sequence_id", data.sequenceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const enrollInSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sequenceId: z.string().uuid(),
        entityIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: seq } = await supabase
      .from("sequences")
      .select("id, steps")
      .eq("id", data.sequenceId)
      .maybeSingle();
    if (!seq) throw new Error("Sequência não encontrada");
    const steps = (seq.steps as SequenceStep[] | null) ?? [];
    const firstWait = steps[0]?.wait_days ?? 0;
    const nextRun = new Date(Date.now() + firstWait * 86_400_000).toISOString();
    const rows = data.entityIds.map((id) => ({
      owner_id: userId,
      workspace_id: workspaceId,
      sequence_id: data.sequenceId,
      entity_id: id,
      status: "active",
      current_step: 0,
      next_run_at: nextRun,
    }));
    const { error } = await supabase.from("sequence_enrollments").insert(rows);
    if (error) throw new Error(error.message);
    return { enrolled: rows.length };
  });

export const updateEnrollmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "paused", "removed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { status: string; next_run_at?: string | null } = { status: data.status };
    if (data.status === "removed") patch.next_run_at = null;
    if (data.status === "active") patch.next_run_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("sequence_enrollments")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const triggerSequencesTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => tickSequences(supabaseAdmin, 100));

export type SequenceListItem = Awaited<ReturnType<typeof listSequences>>[number];
export type EnrollmentListItem = Awaited<ReturnType<typeof listEnrollments>>[number];
export type SequenceEntityT = SequenceEntity;
