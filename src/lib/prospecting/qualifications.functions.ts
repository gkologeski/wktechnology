/**
 * Suíte de Prospecção — Qualificações.
 *
 * Registra as respostas do SDR/BDR ao questionário para um lead/contato,
 * calcula o score e permite decisão manual (qualificado/desqualificado/
 * nutrição/agendado) que sempre sobrepõe o score.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { applyScoreContribution, getLeadIcpFit } from "@/lib/scoring/icp.server";
import { logQualificationActivity } from "@/lib/prospecting/qualification-activity.server";
import {
  computeQualificationScore,
  computeQualificationMaxScore,
  type ScoreQuestion as Question,
} from "@/lib/prospecting/score";
import { computeUnifiedLeadScore } from "@/lib/prospecting/lead-score";

const EntityEnum = z.enum(["lead", "contact"]);
const DecisionEnum = z.enum(["pending", "qualified", "disqualified", "nurture", "scheduled"]);

const QUESTION_COLUMNS = "id, type, weight, options, text_points, text_min_chars";

const computeScore = computeQualificationScore;

const ENTITY_TABLE = { lead: "leads", contact: "contacts" } as const;

/**
 * Lança o score da qualificação como parcela do score do registro.
 * Idempotente por questionário: reeditar ajusta em vez de somar de novo.
 */
async function pushQualificationScore(
  supabase: Parameters<typeof applyScoreContribution>[0],
  args: {
    userId: string;
    entity: "lead" | "contact";
    entityId: string;
    questionnaireId: string;
    points: number;
    reason: string;
  },
): Promise<void> {
  try {
    const workspaceId = await getActiveWorkspaceId(supabase, args.userId);
    await applyScoreContribution(supabase, {
      ownerId: args.userId,
      workspaceId,
      entity: ENTITY_TABLE[args.entity],
      entityId: args.entityId,
      source: "qualification",
      sourceKey: args.questionnaireId,
      points: args.points,
      reason: args.reason,
    });
  } catch (e) {
    console.error("[qualification] score contribution", e);
  }
}

/**
 * Compõe a nota unificada (0-85) do registro: questionário normalizado (até 50)
 * somado à aderência ao ICP normalizada (até 35). Falhas no ICP não bloqueiam
 * o salvamento — a parcela apenas fica zerada.
 */
async function buildUnifiedScore(
  supabase: Parameters<typeof getLeadIcpFit>[0],
  args: { entity: "lead" | "contact"; entityId: string; questions: Question[]; score: number },
) {
  const { max } = computeQualificationMaxScore(args.questions);
  let icpScore = 0;
  let icpMax = 0;
  if (args.entity === "lead") {
    try {
      const fit = await getLeadIcpFit(supabase, args.entityId);
      icpScore = Number(fit.points ?? 0);
      icpMax = Number(fit.max ?? 0);
    } catch (e) {
      console.error("[qualification] icp fit", e);
    }
  }
  return computeUnifiedLeadScore({
    questionnaireScore: args.score,
    questionnaireMax: max,
    icpScore,
    icpMax,
  });
}

export const listQualificationsForEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ entity: EntityEnum, entity_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("prospecting_qualifications")
      .select("*, questionnaire:prospecting_questionnaires(id, name, framework, pass_threshold)")
      .eq("entity", data.entity)
      .eq("entity_id", data.entity_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        questionnaire_id: z.string().uuid(),
        entity: EntityEnum,
        entity_id: z.string().uuid(),
        answers: z.record(z.string(), z.unknown()).default({}),
        decision: DecisionEnum.optional(),
        decision_reason: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: qs, error: qsErr } = await context.supabase
      .from("prospecting_questions")
      .select(QUESTION_COLUMNS)
      .eq("questionnaire_id", data.questionnaire_id);
    if (qsErr) throw new Error(qsErr.message);
    const score = computeScore((qs ?? []) as Question[], data.answers);
    const unified = await buildUnifiedScore(context.supabase, {
      entity: data.entity,
      entityId: data.entity_id,
      questions: (qs ?? []) as Question[],
      score,
    });

    const patch = {
      owner_id: context.userId,
      questionnaire_id: data.questionnaire_id,
      entity: data.entity,
      entity_id: data.entity_id,
      answers: data.answers,
      score,
      questionnaire_points: unified.questionnairePoints,
      icp_points: unified.icpPoints,
      total_score: unified.total,
      ...(data.decision
        ? {
            decision: data.decision,
            decision_reason: data.decision_reason ?? null,
            qualified_by: context.userId,
            qualified_at: new Date().toISOString(),
          }
        : {}),
    } as never;

    const decided = data.decision && data.decision !== "pending";
    // Qualificado/agendado somam o score; desqualificado/nutrição zeram a parcela.
    const contribution = data.decision === "qualified" || data.decision === "scheduled" ? score : 0;

    const afterDecision = async () => {
      if (!decided) return;
      await pushQualificationScore(context.supabase, {
        userId: context.userId,
        entity: data.entity,
        entityId: data.entity_id,
        questionnaireId: data.questionnaire_id,
        points: contribution,
        reason: "Qualificação",
      });
      let workspaceId: string | null = null;
      try {
        workspaceId = await getActiveWorkspaceId(context.supabase, context.userId);
      } catch {
        workspaceId = null;
      }
      await logQualificationActivity(context.supabase, {
        userId: context.userId,
        workspaceId,
        entity: data.entity,
        entityId: data.entity_id,
        questionnaireId: data.questionnaire_id,
        questions: (qs ?? []) as Question[],
        answers: data.answers,
        score,
        decision: data.decision as "qualified" | "disqualified" | "nurture" | "scheduled",
        decisionReason: data.decision_reason ?? null,
      });
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("prospecting_qualifications")
        .update(patch)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await afterDecision();
      return { id: data.id, score, unified };
    }
    const { data: row, error } = await context.supabase
      .from("prospecting_qualifications")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await afterDecision();
    return { id: row.id, score, unified };
  });

export const setDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: DecisionEnum,
        decision_reason: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("prospecting_qualifications")
      .update({
        decision: data.decision,
        decision_reason: data.decision_reason ?? null,
        qualified_by: context.userId,
        qualified_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Envia um lead para nutrição: marca o status, grava a decisão,
 * remove o lead da fila (se manual), e — quando houver — inscreve o lead
 * numa cadência de nutrição (definida na fila ou padrão do workspace).
 */
export const nurtureLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        lead_id: z.string().uuid(),
        questionnaire_id: z.string().uuid().nullable().optional(),
        answers: z.record(z.string(), z.unknown()).default({}),
        reason: z.string().max(1000).nullable().optional(),
        queue_id: z.string().uuid().nullable().optional(),
        qualification_id: z.string().uuid().nullable().optional(),
        stage_id: z.string().nullable().optional(),
        pipeline_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const nowIso = new Date().toISOString();

    // 1) Atualiza status do lead (e a etapa do funil quando informada)
    const leadPatch: Record<string, unknown> = {
      status: "nurturing",
      nurture_started_at: nowIso,
    };
    if (data.stage_id) {
      leadPatch.stage_id = data.stage_id;
      if (data.pipeline_id) leadPatch.pipeline_id = data.pipeline_id;
    }
    const { error: leadErr } = await context.supabase
      .from("leads")
      .update(leadPatch as never)
      .eq("id", data.lead_id);
    if (leadErr) throw new Error(leadErr.message);

    // 2) Registra a qualificação (se houver questionário)
    if (data.questionnaire_id) {
      const { data: qs, error: qsErr } = await context.supabase
        .from("prospecting_questions")
        .select(QUESTION_COLUMNS)
        .eq("questionnaire_id", data.questionnaire_id);
      if (qsErr) throw new Error(qsErr.message);
      const score = computeScore((qs ?? []) as Question[], data.answers);
      const patch = {
        owner_id: context.userId,
        questionnaire_id: data.questionnaire_id,
        entity: "lead",
        entity_id: data.lead_id,
        answers: data.answers,
        score,
        decision: "nurture",
        decision_reason: data.reason ?? null,
        qualified_by: context.userId,
        qualified_at: nowIso,
      } as never;
      if (data.qualification_id) {
        await context.supabase
          .from("prospecting_qualifications")
          .update(patch)
          .eq("id", data.qualification_id);
      } else {
        await context.supabase.from("prospecting_qualifications").insert(patch);
      }
    }

    // 3) Resolve cadência: fila → padrão do workspace → nenhuma
    let cadenceId: string | null = null;
    let cadenceName: string | null = null;
    if (data.queue_id) {
      const { data: q } = await context.supabase
        .from("prospecting_queues")
        .select("kind, item_ids, nurture_cadence_id")
        .eq("id", data.queue_id)
        .maybeSingle();
      if (q) {
        cadenceId = (q as { nurture_cadence_id: string | null }).nurture_cadence_id;
        // Remove o lead da fila manual
        if ((q as { kind?: string }).kind === "manual") {
          const ids = (((q as { item_ids?: string[] }).item_ids) ?? []) as string[];
          const next = ids.filter((x) => x !== data.lead_id);
          if (next.length !== ids.length) {
            await context.supabase
              .from("prospecting_queues")
              .update({ item_ids: next } as never)
              .eq("id", data.queue_id);
          }
        }
      }
    }
    // (Padrão de workspace pode ser adicionado no futuro via tabela dedicada;
    // por ora, a cadência é resolvida somente ao nível da fila.)


    // 4) Inscreve o lead na cadência resolvida (dedupe)
    let enrolled = false;
    if (cadenceId) {
      const { data: cad } = await context.supabase
        .from("prospecting_cadences")
        .select("id, name, enabled")
        .eq("id", cadenceId)
        .maybeSingle();
      const cadRow = cad as { id: string; name: string; enabled: boolean } | null;
      if (cadRow && cadRow.enabled) {
        cadenceName = cadRow.name;
        const { data: exists } = await context.supabase
          .from("prospecting_enrollments")
          .select("id")
          .eq("cadence_id", cadenceId)
          .eq("entity_id", data.lead_id)
          .eq("status", "active")
          .maybeSingle();
        if (!exists) {
          const { error: enrErr } = await context.supabase
            .from("prospecting_enrollments")
            .insert({
              cadence_id: cadenceId,
              entity: "lead",
              entity_id: data.lead_id,
              owner_id: context.userId,
              status: "active",
              current_step: 1,
              next_run_at: nowIso,
              started_at: nowIso,
              started_by: context.userId,
            } as never);
          if (!enrErr) enrolled = true;
        } else {
          enrolled = true;
        }
      }
    }

    return { ok: true, enrolled, cadence_name: cadenceName };
  });

