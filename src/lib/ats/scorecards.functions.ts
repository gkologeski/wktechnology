// Scorecards de entrevista: templates (critérios + pesos) e respostas por candidatura.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const CriterionSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  weight: z.number().min(0.1).max(10).default(1),
});

const ScorecardSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  criteria: z.array(CriterionSchema).min(1).max(20),
});

export type Criterion = z.infer<typeof CriterionSchema>;

export const listScorecards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ job_id: z.string().uuid().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    let q = supabase
      .from("ats_scorecards")
      .select("id, name, description, job_id, is_active, criteria, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (data?.job_id) q = q.or(`job_id.eq.${data.job_id},job_id.is.null`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScorecardSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const base = {
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      description: data.description ?? null,
      job_id: data.job_id ?? null,
      is_active: data.is_active,
      criteria: data.criteria,
    };
    if (data.id) {
      const { error } = await supabase
        .from("ats_scorecards")
        .update(base as never)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_scorecards")
      .insert(base as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins as { id: string };
  });

export const deleteScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("ats_scorecards")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ResponseSchema = z.object({
  id: z.string().uuid().optional(),
  scorecard_id: z.string().uuid(),
  application_id: z.string().uuid(),
  scores: z.record(z.string(), z.number().min(0).max(5)),
  recommendation: z.enum(["strong_yes", "yes", "maybe", "no", "strong_no"]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const submitScorecardResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResponseSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    // Buscar critérios pra computar score ponderado.
    const { data: sc, error: scErr } = await supabase
      .from("ats_scorecards")
      .select("criteria")
      .eq("id", data.scorecard_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (scErr || !sc) throw new Error("Scorecard não encontrado");
    const criteria = (sc as { criteria: Criterion[] }).criteria ?? [];
    let total = 0;
    let weightSum = 0;
    for (const c of criteria) {
      const v = data.scores[c.key];
      if (typeof v === "number") {
        total += v * (c.weight ?? 1);
        weightSum += c.weight ?? 1;
      }
    }
    const total_score = weightSum > 0 ? +(total / weightSum).toFixed(2) : null;

    const base = {
      owner_id: userId,
      workspace_id: workspaceId,
      scorecard_id: data.scorecard_id,
      application_id: data.application_id,
      evaluator_id: userId,
      scores: data.scores,
      total_score,
      recommendation: data.recommendation ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("ats_scorecard_responses")
        .update(base as never)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id, total_score };
    }
    const { data: ins, error } = await supabase
      .from("ats_scorecard_responses")
      .insert(base as never)
      .select("id, application_id")
      .single();
    if (error) throw new Error(error.message);
    const created = ins as { id: string; application_id: string };
    // Auditoria: registrar submissão do scorecard
    const { data: app } = await supabase
      .from("ats_applications")
      .select("job_id, candidate_id")
      .eq("id", created.application_id)
      .maybeSingle();
    if (app) {
      const a = app as { job_id: string; candidate_id: string };
      await supabase
        .from("ats_application_events")
        .insert({
          owner_id: userId,
          workspace_id: workspaceId,
          application_id: created.application_id,
          job_id: a.job_id,
          candidate_id: a.candidate_id,
          event_type: "scorecard_submitted",
          actor_id: userId,
          metadata: {
            scorecard_id: data.scorecard_id,
            total_score,
            recommendation: data.recommendation ?? null,
          },
        } as never)
        .then(
          () => undefined,
          () => undefined,
        );
    }
    return { id: created.id, total_score };
  });

export const listScorecardResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ application_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("ats_scorecard_responses")
      .select(
        "id, scorecard_id, scores, total_score, recommendation, notes, evaluator_id, created_at, scorecard:ats_scorecards(name, criteria)",
      )
      .eq("workspace_id", workspaceId)
      .eq("application_id", data.application_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Para o Kanban: melhor score por candidatura de uma vaga. */
export const listJobScorecardSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ application_ids: z.array(z.string().uuid()).min(0).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.application_ids.length === 0)
      return {} as Record<string, { avg: number; count: number }>;
    const { data: rows, error } = await supabase
      .from("ats_scorecard_responses")
      .select("application_id, total_score")
      .eq("workspace_id", workspaceId)
      .in("application_id", data.application_ids);
    if (error) throw new Error(error.message);
    const acc: Record<string, { sum: number; count: number }> = {};
    for (const r of rows ?? []) {
      const ap = r.application_id as string;
      const v = r.total_score as number | null;
      if (typeof v !== "number") continue;
      const a = acc[ap] ?? { sum: 0, count: 0 };
      a.sum += v;
      a.count += 1;
      acc[ap] = a;
    }
    const out: Record<string, { avg: number; count: number }> = {};
    for (const [k, v] of Object.entries(acc)) {
      out[k] = { avg: +(v.sum / v.count).toFixed(2), count: v.count };
    }
    return out;
  });
