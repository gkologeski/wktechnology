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
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const nowIso = new Date().toISOString();

    // 1) Atualiza status do lead
    const { error: leadErr } = await context.supabase
      .from("leads")
      .update({ status: "nurturing", nurture_started_at: nowIso } as never)
      .eq("id", data.lead_id);
    if (leadErr) throw new Error(leadErr.message);

    // 2) Registra a qualificação (se houver questionário)
    if (data.questionnaire_id) {
      const { data: qs, error: qsErr } = await context.supabase
        .from("prospecting_questions")
        .select("id, type, weight, options")
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
    if (!cadenceId) {
      const { data: setting } = await context.supabase
        .from("app_settings")
        .select("value")
        .eq("key", "prospecting.default_nurture_cadence_id")
        .maybeSingle();
      const val = (setting as { value?: string } | null)?.value ?? null;
      if (val && /^[0-9a-f-]{36}$/i.test(val)) cadenceId = val;
    }

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

