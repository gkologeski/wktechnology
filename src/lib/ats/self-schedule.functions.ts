// Self-scheduling (Fase 2): candidato escolhe um slot via token.
// O token é validado no handler; usamos o admin client porque as policies
// anônimas em ats_interviews foram removidas (evita exposição em massa).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSelfScheduleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        application_id: z.string().uuid(),
        candidate_id: z.string().uuid(),
        job_id: z.string().uuid(),
        slots: z.array(z.string()).min(1).max(20),
        duration_min: z.number().int().min(15).max(240).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: row, error } = await supabase
      .from("ats_interviews")
      .insert({
        owner_id: userId,
        application_id: data.application_id,
        candidate_id: data.candidate_id,
        job_id: data.job_id,
        kind: "self_schedule",
        offered_slots: data.slots,
        duration_min: data.duration_min,
        self_schedule_token: token,
        status: "pending_candidate",
      })
      .select("id, self_schedule_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getSelfScheduleByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await sb
      .from("ats_interviews")
      .select("id, offered_slots, duration_min, status, scheduled_at, self_scheduled_at")
      .eq("self_schedule_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Link inválido");
    return row;
  });

export const confirmSelfSchedule = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8), slot: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e0 } = await sb
      .from("ats_interviews")
      .select("id, offered_slots, status, owner_id, application_id, job_id, candidate_id, kind")
      .eq("self_schedule_token", data.token)
      .maybeSingle();
    if (e0 || !row) throw new Error("Link inválido");
    if (row.status !== "pending_candidate") throw new Error("Link já utilizado");
    const slots = (row.offered_slots as string[]) ?? [];
    if (!slots.includes(data.slot)) throw new Error("Horário inválido");
    const { error } = await sb
      .from("ats_interviews")
      .update({
        scheduled_at: data.slot,
        self_scheduled_at: new Date().toISOString(),
        status: "scheduled",
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    try {
      const { recordAtsEvent } = await import("./audit.server");
      await recordAtsEvent(sb, {
        ownerId: row.owner_id as string,
        name: "ats.interview.scheduled",
        entityType: "interview",
        entityId: row.id as string,
        payload: {
          applicationId: row.application_id as string,
          candidateId: row.candidate_id as string,
          jobId: row.job_id as string,
          scheduledAt: data.slot,
          kind: row.kind as string,
          source: "self_schedule",
        },
      });
    } catch {
      /* não bloqueia confirmação */
    }
    return { ok: true };
  });
