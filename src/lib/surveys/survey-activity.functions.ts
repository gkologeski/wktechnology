/**
 * Pesquisa como tipo de atividade.
 *
 * Permite acionar uma pesquisa (modelo de `/surveys` ou questionário de
 * prospecção) diretamente na timeline de uma entidade, responder o formulário e
 * registrar a atividade com as respostas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import {
  computeQualificationMaxScore,
  computeQualificationScore,
  type ScoreQuestion,
} from "@/lib/prospecting/score";

const RELATED_KEYS = [
  "related_lead_id",
  "related_contact_id",
  "related_company_id",
  "related_deal_id",
  "related_ticket_id",
] as const;

const SOURCE = z.enum(["survey_template", "prospecting_questionnaire"]);

export type SurveySourceKind = z.infer<typeof SOURCE>;

export type SurveyFormQuestion = {
  id: string;
  label: string;
  help_text: string | null;
  type: string;
  options: Json;
  settings: Json;
  required: boolean;
  position: number;
};

/** Dados de pontuação das perguntas de um questionário de vendas. */
export type SalesScoreQuestion = {
  id: string;
  type: string;
  weight: number;
  options: Json;
  text_points: number | null;
  text_min_chars: number | null;
};

/** Pesquisas disponíveis para responder, agrupadas por tipo. */
export const listAvailableSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [templates, questionnaires] = await Promise.all([
      context.supabase
        .from("survey_templates")
        .select("id, name, description, kind, is_active, updated_at")
        .order("name", { ascending: true }),
      context.supabase
        .from("prospecting_questionnaires")
        .select("id, name, description, framework, enabled, is_template, updated_at")
        .order("name", { ascending: true }),
    ]);
    if (templates.error) throw new Error(templates.error.message);
    if (questionnaires.error) throw new Error(questionnaires.error.message);
    const active = (templates.data ?? []).filter((t) => t.is_active !== false);
    const sales = (questionnaires.data ?? []).filter((q) => q.enabled !== false);
    return {
      /** Compatibilidade: todos os modelos de pesquisa ativos. */
      templates: active,
      questionnaires: sales,
      csat: active.filter((t) => t.kind === "csat"),
      nps: active.filter((t) => t.kind === "nps"),
      free: active.filter((t) => t.kind === "form"),
      salesModels: sales.filter((q) => q.is_template === true),
      salesQuestionnaires: sales.filter((q) => q.is_template !== true),
    };
  });

/** Perguntas do formulário de uma pesquisa. */
export const getSurveyForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ source: SOURCE, source_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    if (data.source === "survey_template") {
      const [{ data: tpl }, { data: rows, error }] = await Promise.all([
        context.supabase
          .from("survey_templates")
          .select("id, name, description, kind")
          .eq("id", data.source_id)
          .maybeSingle(),
        context.supabase
          .from("survey_template_questions")
          .select("id, label, help_text, type, options, settings, required, position")
          .eq("survey_template_id", data.source_id)
          .order("position", { ascending: true }),
      ]);
      if (error) throw new Error(error.message);
      if (!tpl) throw new Error("Modelo de pesquisa não encontrado.");
      return {
        source: data.source,
        kind: (tpl.kind ?? "form") as string,
        id: tpl.id,
        name: tpl.name,
        description: tpl.description ?? null,
        pass_threshold: null as number | null,
        field_layout: null as Json,
        scoring: [] as SalesScoreQuestion[],

        questions: (rows ?? []).map(
          (r) =>
            ({
              id: r.id,
              label: r.label,
              help_text: r.help_text ?? null,
              type: r.type,
              options: (r.options ?? null) as Json,
              settings: (r.settings ?? null) as Json,
              required: !!r.required,
              position: r.position ?? 0,
            }) satisfies SurveyFormQuestion,
        ),
      };
    }

    const [{ data: q }, { data: rows, error }] = await Promise.all([
      context.supabase
        .from("prospecting_questionnaires")
        .select("id, name, description, framework, pass_threshold, field_layout")
        .eq("id", data.source_id)
        .maybeSingle(),
      context.supabase
        .from("prospecting_questions")
        .select(
          "id, label, help_text, type, options, required, position, weight, text_points, text_min_chars",
        )
        .eq("questionnaire_id", data.source_id)
        .order("position", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Questionário não encontrado.");
    // Mapeia os tipos do questionário de prospecção para os tipos de formulário.
    const typeMap: Record<string, string> = {
      single: "single_choice",
      multi: "multi_choice",
      number: "number",
      text: "short_text",
      textarea: "long_text",
      boolean: "boolean",
    };
    return {
      source: data.source,
      kind: "sales",
      id: q.id,
      name: q.name,
      description: q.description ?? null,
      pass_threshold: (q.pass_threshold as number | null) ?? null,
      field_layout: (q.field_layout ?? null) as Json,
      scoring: (rows ?? []).map(
        (r) =>
          ({
            id: r.id,
            type: r.type,
            weight: Number(r.weight ?? 1),
            options: (r.options ?? null) as Json,
            text_points: (r.text_points as number | null) ?? null,
            text_min_chars: (r.text_min_chars as number | null) ?? null,
          }) satisfies SalesScoreQuestion,
      ),

      questions: (rows ?? []).map(
        (r) =>
          ({
            id: r.id,
            label: r.label,
            help_text: r.help_text ?? null,
            type: typeMap[r.type] ?? "short_text",
            options: (r.options ?? null) as Json,
            settings: {} as Json,
            required: !!r.required,
            position: r.position ?? 0,
          }) satisfies SurveyFormQuestion,
      ),
    };
  });

const SaveSchema = z.object({
  activity_id: z.string().uuid().optional(),
  source: SOURCE,
  source_id: z.string().uuid(),
  related_key: z.enum(RELATED_KEYS),
  related_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  notes: z.string().max(4000).optional().nullable(),
});

/** Cria (ou atualiza) a atividade de pesquisa com as respostas. */
export const saveSurveyActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ws = await getActiveWorkspaceId(supabase, userId);

    // Nome da pesquisa + score (quando questionário de prospecção).
    let sourceName = "Pesquisa";
    let score: number | null = null;
    let maxScore: number | null = null;

    if (data.source === "survey_template") {
      const { data: tpl } = await supabase
        .from("survey_templates")
        .select("name")
        .eq("id", data.source_id)
        .maybeSingle();
      sourceName = tpl?.name ?? sourceName;
    } else {
      const [{ data: q }, { data: questions }] = await Promise.all([
        supabase
          .from("prospecting_questionnaires")
          .select("name")
          .eq("id", data.source_id)
          .maybeSingle(),
        supabase
          .from("prospecting_questions")
          .select("id, type, weight, options, text_points, text_min_chars")
          .eq("questionnaire_id", data.source_id),
      ]);
      sourceName = q?.name ?? sourceName;
      const list = (questions ?? []) as unknown as ScoreQuestion[];
      score = computeQualificationScore(list, data.answers);
      const { max } = computeQualificationMaxScore(list);
      maxScore = max > 0 ? max : null;
    }

    const subject = `Pesquisa — ${sourceName}`;

    let activityId = data.activity_id ?? null;
    if (activityId) {
      const { error } = await supabase
        .from("activities")
        .update({ subject, body: data.notes ?? null, completed: true } as never)
        .eq("id", activityId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabase
        .from("activities")
        .insert({
          owner_id: userId,
          created_by: userId,
          type: "survey",
          subject,
          body: data.notes ?? null,
          completed: true,
          [data.related_key]: data.related_id,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      activityId = (inserted as { id: string }).id;
    }

    const payload = {
      activity_id: activityId,
      owner_id: userId,
      workspace_id: ws,
      source: data.source,
      source_id: data.source_id,
      source_name: sourceName,
      answers: data.answers,
      score,
      max_score: maxScore,
      responded_by: userId,
      responded_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase
      .from("activity_survey_responses")
      .upsert(payload as never, { onConflict: "activity_id" });
    if (upErr) throw new Error(upErr.message);

    return { activity_id: activityId, score, max_score: maxScore };
  });

/** Respostas + perguntas para renderizar cards de pesquisa na timeline. */
export const getActivitySurveyResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ activity_ids: z.array(z.string().uuid()).max(500) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    if (data.activity_ids.length === 0) return [];
    const { data: rows, error } = await context.supabase
      .from("activity_survey_responses")
      .select(
        "id, activity_id, source, source_id, source_name, answers, score, max_score, responded_by, responded_at",
      )
      .in("activity_id", data.activity_ids);
    if (error) throw new Error(error.message);
    const responses = rows ?? [];
    if (responses.length === 0) return [];

    const templateIds = responses
      .filter((r) => r.source === "survey_template")
      .map((r) => r.source_id);
    const questionnaireIds = responses
      .filter((r) => r.source === "prospecting_questionnaire")
      .map((r) => r.source_id);

    const [tplQ, prospQ] = await Promise.all([
      templateIds.length
        ? context.supabase
            .from("survey_template_questions")
            .select("id, survey_template_id, label, help_text, type, options, settings, position")
            .in("survey_template_id", templateIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      questionnaireIds.length
        ? context.supabase
            .from("prospecting_questions")
            .select("id, questionnaire_id, label, help_text, type, options, position")
            .in("questionnaire_id", questionnaireIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const bySource = new Map<string, SurveyFormQuestion[]>();
    for (const r of (tplQ.data ?? []) as Array<Record<string, unknown>>) {
      const key = String(r.survey_template_id);
      const list = bySource.get(key) ?? [];
      list.push({
        id: String(r.id),
        label: String(r.label),
        help_text: (r.help_text as string | null) ?? null,
        type: String(r.type),
        options: (r.options ?? null) as Json,
        settings: (r.settings ?? null) as Json,
        required: false,
        position: Number(r.position ?? 0),
      });
      bySource.set(key, list);
    }
    const typeMap: Record<string, string> = {
      single: "single_choice",
      multi: "multi_choice",
      number: "number",
      text: "short_text",
      textarea: "long_text",
      boolean: "boolean",
    };
    for (const r of (prospQ.data ?? []) as Array<Record<string, unknown>>) {
      const key = String(r.questionnaire_id);
      const list = bySource.get(key) ?? [];
      list.push({
        id: String(r.id),
        label: String(r.label),
        help_text: (r.help_text as string | null) ?? null,
        type: typeMap[String(r.type)] ?? "short_text",
        options: (r.options ?? null) as Json,
        settings: {} as Json,
        required: false,
        position: Number(r.position ?? 0),
      });
      bySource.set(key, list);
    }

    return responses.map((r) => ({
      ...r,
      questions: bySource.get(r.source_id) ?? [],
    }));
  });

/**
 * Pesquisa pendente (criada por workflow) de um registro: atividade do tipo
 * `survey` ainda sem resposta registrada.
 */
export const getPendingSurveyActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ related_key: z.enum(RELATED_KEYS), related_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("activities")
      .select("id, subject, custom_fields, completed")
      .eq("type", "survey")
      .eq(data.related_key, data.related_id)
      .eq("completed", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    const candidates = (rows ?? []) as Array<{
      id: string;
      subject: string | null;
      custom_fields: Json | null;
    }>;
    if (candidates.length === 0) return null;

    const answered = await context.supabase
      .from("activity_survey_responses")
      .select("activity_id")
      .in(
        "activity_id",
        candidates.map((c) => c.id),
      );
    const done = new Set(
      (answered.data ?? []).map((r) => (r as { activity_id: string }).activity_id),
    );

    for (const c of candidates) {
      if (done.has(c.id)) continue;
      const cf = (c.custom_fields ?? {}) as Record<string, unknown>;
      const source = cf.survey_source;
      const sourceId = cf.survey_source_id;
      if (
        (source === "survey_template" || source === "prospecting_questionnaire") &&
        typeof sourceId === "string" &&
        sourceId
      ) {
        return {
          activity_id: c.id,
          source: source as SurveySourceKind,
          source_id: sourceId,
          subject: c.subject,
        };
      }
    }
    return null;
  });
