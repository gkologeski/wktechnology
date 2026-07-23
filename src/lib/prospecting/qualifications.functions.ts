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

const EntityEnum = z.enum(["lead", "contact"]);
const DecisionEnum = z.enum(["pending", "qualified", "disqualified", "nurture", "scheduled"]);

type Option = { label: string; points: number };
type Question = {
  id: string;
  type: string;
  weight: number;
  options: Option[] | null;
};

function computeScore(questions: Question[], answers: Record<string, unknown>): number {
  let total = 0;
  for (const q of questions) {
    const raw = answers[q.id];
    if (raw == null) continue;
    const weight = q.weight ?? 1;
    if (q.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) total += n * weight;
      continue;
    }
    if (q.type === "boolean") {
      if (raw === true || raw === "true") total += 10 * weight;
      continue;
    }
    const opts = Array.isArray(q.options) ? q.options : [];
    if (q.type === "single") {
      const opt = opts.find((o) => o.label === raw);
      if (opt) total += (opt.points ?? 0) * weight;
      continue;
    }
    if (q.type === "multi" && Array.isArray(raw)) {
      for (const label of raw) {
        const opt = opts.find((o) => o.label === label);
        if (opt) total += (opt.points ?? 0) * weight;
      }
    }
    // text: sem pontuação
  }
  return total;
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
      .select("id, type, weight, options")
      .eq("questionnaire_id", data.questionnaire_id);
    if (qsErr) throw new Error(qsErr.message);
    const score = computeScore((qs ?? []) as Question[], data.answers);

    const patch = {
      owner_id: context.userId,
      questionnaire_id: data.questionnaire_id,
      entity: data.entity,
      entity_id: data.entity_id,
      answers: data.answers,
      score,
      ...(data.decision
        ? {
            decision: data.decision,
            decision_reason: data.decision_reason ?? null,
            qualified_by: context.userId,
            qualified_at: new Date().toISOString(),
          }
        : {}),
    } as never;

    if (data.id) {
      const { error } = await context.supabase
        .from("prospecting_qualifications")
        .update(patch)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, score };
    }
    const { data: row, error } = await context.supabase
      .from("prospecting_qualifications")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, score };
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
