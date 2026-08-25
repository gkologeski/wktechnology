/**
 * Suíte de Prospecção — Questionários de qualificação.
 *
 * CRUD de questionários (BANT/MEDDIC/CHAMP/GPCT/custom) + suas perguntas
 * pontuadas. Score é calculado como soma de `option.points * weight` para
 * respostas single/multi, e passado diretamente para `number`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import {
  QUESTIONNAIRES_CREATE,
  QUESTIONNAIRES_DELETE,
  QUESTIONNAIRES_UPDATE,
  asKeys,
} from "@/lib/prospecting/permission-keys";

const FRAMEWORK = z.enum(["bant", "meddic", "champ", "gpct", "custom"]);
const QUESTION_TYPE = z.enum(["single", "multi", "number", "text", "boolean"]);

const OptionSchema = z.object({
  label: z.string().min(1).max(200),
  points: z.number().int().min(-1000).max(1000).default(0),
});

export const listQuestionnaires = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prospecting_questionnaires")
      .select("id, name, description, framework, pipeline_id, enabled, pass_threshold, is_template, updated_at")
      .order("is_template", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const [{ data: q }, { data: questions }] = await Promise.all([
      context.supabase
        .from("prospecting_questionnaires")
        .select("*")
        .eq("id", data.id)
        .maybeSingle(),
      context.supabase
        .from("prospecting_questions")
        .select("*")
        .eq("questionnaire_id", data.id)
        .order("position", { ascending: true }),
    ]);
    if (!q) throw new Error("Questionário não encontrado");
    return { questionnaire: q, questions: questions ?? [] };
  });

export const upsertQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        framework: FRAMEWORK.default("custom"),
        pipeline_id: z.string().uuid().nullable().optional(),
        enabled: z.boolean().default(true),
        pass_threshold: z.number().int().min(-100000).max(100000).default(0),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(data.id ? QUESTIONNAIRES_UPDATE : QUESTIONNAIRES_CREATE));
    const payload = {
      owner_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      framework: data.framework,
      pipeline_id: data.pipeline_id ?? null,
      enabled: data.enabled,
      pass_threshold: data.pass_threshold,
    } as never;
    if (data.id) {
      // Não sobrescreve owner_id ao editar registro de outro usuário.
      const { owner_id: _owner, ...updatable } = payload as Record<string, unknown>;
      const { error } = await context.supabase
        .from("prospecting_questionnaires")
        .update(updatable as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("prospecting_questionnaires")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_DELETE));
    const { error } = await context.supabase
      .from("prospecting_questionnaires")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Salva apenas o layout de campos de entidades exibidos na qualificação
 * (blocos antes/depois das perguntas) — configurável por questionário.
 */
export const saveQuestionnaireFieldLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        field_layout: z.array(
          z.object({
            id: z.string().min(1).max(80),
            entity: z.enum(["leads", "companies", "contacts"]),
            position: z.enum(["before", "after"]),
            title: z.string().min(1).max(120),
            fields: z
              .array(
                z.object({
                  key: z.string().min(1).max(120),
                  label: z.string().min(1).max(200),
                  type: z.enum(["text", "number", "date", "select", "boolean"]),
                  required: z.boolean().optional(),
                  options: z
                    .array(z.object({ value: z.string(), label: z.string() }))
                    .max(200)
                    .optional(),
                }),
              )
              .max(60),
          }),
        ).max(12),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_UPDATE));
    const { error } = await context.supabase
      .from("prospecting_questionnaires")
      .update({ field_layout: data.field_layout } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        questionnaire_id: z.string().uuid(),
        position: z.number().int().min(0).max(500),
        label: z.string().min(1).max(500),
        help_text: z.string().max(1000).nullable().optional(),
        type: QUESTION_TYPE,
        options: z.array(OptionSchema).default([]),
        weight: z.number().int().min(1).max(100).default(1),
        required: z.boolean().default(false),
        // Perguntas abertas podem pontuar quando respondidas com conteúdo mínimo.
        text_points: z.number().int().min(0).max(1000).default(0),
        text_min_chars: z.number().int().min(1).max(2000).default(10),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_UPDATE));
    const payload = {
      ...(data.id ? { id: data.id } : {}),
      owner_id: context.userId,
      questionnaire_id: data.questionnaire_id,
      position: data.position,
      label: data.label,
      help_text: data.help_text ?? null,
      type: data.type,
      options: data.options,
      weight: data.weight,
      required: data.required,
      text_points: data.text_points,
      text_min_chars: data.text_min_chars,
    } as never;
    const { data: row, error } = await context.supabase
      .from("prospecting_questions")
      .upsert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_UPDATE));
    const { error } = await context.supabase
      .from("prospecting_questions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        questionnaire_id: z.string().uuid(),
        ordered_ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_UPDATE));
    const { data: qn, error: qErr } = await context.supabase
      .from("prospecting_questionnaires")
      .select("id, is_template, owner_id")
      .eq("id", data.questionnaire_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!qn) throw new Error("Questionário não encontrado");
    if ((qn as { is_template: boolean }).is_template) {
      throw new Error("Modelos não podem ser reordenados. Duplique primeiro.");
    }
    for (let i = 0; i < data.ordered_ids.length; i++) {
      const { error } = await context.supabase
        .from("prospecting_questions")
        .update({ position: i } as never)
        .eq("id", data.ordered_ids[i])
        .eq("questionnaire_id", data.questionnaire_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const duplicateQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(QUESTIONNAIRES_CREATE));
    const { data: src, error: srcErr } = await context.supabase
      .from("prospecting_questionnaires")
      .select("name, description, framework, pipeline_id, pass_threshold")
      .eq("id", data.id)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src) throw new Error("Questionário não encontrado");

    const { data: qs, error: qsErr } = await context.supabase
      .from("prospecting_questions")
      .select("position, label, help_text, type, options, weight, required, text_points, text_min_chars")
      .eq("questionnaire_id", data.id)
      .order("position", { ascending: true });
    if (qsErr) throw new Error(qsErr.message);

    const { data: created, error: insErr } = await context.supabase
      .from("prospecting_questionnaires")
      .insert({
        owner_id: context.userId,
        name: `${src.name} (cópia)`,
        description: src.description,
        framework: src.framework,
        pipeline_id: src.pipeline_id,
        pass_threshold: src.pass_threshold,
        enabled: true,
        is_template: false,
      } as never)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (qs && qs.length > 0) {
      const rows = qs.map((q) => ({
        owner_id: context.userId,
        questionnaire_id: created.id,
        position: q.position,
        label: q.label,
        help_text: q.help_text,
        type: q.type,
        options: q.options,
        weight: q.weight,
        text_points: q.text_points,
        text_min_chars: q.text_min_chars,
        required: q.required,
      }));
      const { error: qInsErr } = await context.supabase
        .from("prospecting_questions")
        .insert(rows as never);
      if (qInsErr) throw new Error(qInsErr.message);
    }

    return { id: created.id };
  });

/**
 * Semeia um questionário pronto a partir de um dos frameworks. Cria o
 * questionário e todas as perguntas com pesos e opções padrão de mercado.
 */
export const seedFramework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ framework: FRAMEWORK, name: z.string().min(1).max(120).optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const template = FRAMEWORK_TEMPLATES[data.framework];
    if (!template) throw new Error("Framework desconhecido");
    const { data: qn, error } = await context.supabase
      .from("prospecting_questionnaires")
      .insert({
        owner_id: context.userId,
        name: data.name ?? template.name,
        description: template.description,
        framework: data.framework,
        enabled: true,
        pass_threshold: template.pass_threshold,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rows = template.questions.map((q, idx) => ({
      owner_id: context.userId,
      questionnaire_id: qn.id,
      position: idx,
      label: q.label,
      type: q.type,
      options: q.options ?? [],
      weight: q.weight ?? 1,
      required: q.required ?? false,
    }));
    const { error: qErr } = await context.supabase
      .from("prospecting_questions")
      .insert(rows as never);
    if (qErr) throw new Error(qErr.message);
    return { id: qn.id };
  });

// ============================================================================
// Templates de frameworks (BANT, MEDDIC, CHAMP, GPCT)
// ============================================================================

type TemplateQuestion = {
  label: string;
  type: z.infer<typeof QUESTION_TYPE>;
  options?: z.infer<typeof OptionSchema>[];
  weight?: number;
  required?: boolean;
};

type Template = {
  name: string;
  description: string;
  pass_threshold: number;
  questions: TemplateQuestion[];
};

const YES_NO = [
  { label: "Sim", points: 10 },
  { label: "Não", points: 0 },
];

const FRAMEWORK_TEMPLATES: Record<z.infer<typeof FRAMEWORK>, Template> = {
  bant: {
    name: "BANT",
    description: "Budget, Authority, Need, Timeline — clássico de qualificação B2B.",
    pass_threshold: 60,
    questions: [
      {
        label: "Budget: existe orçamento disponível?",
        type: "single",
        options: [
          { label: "Sim, aprovado", points: 25 },
          { label: "Em análise", points: 10 },
          { label: "Não", points: 0 },
        ],
        weight: 1,
        required: true,
      },
      {
        label: "Authority: o contato é decisor?",
        type: "single",
        options: [
          { label: "Decisor final", points: 25 },
          { label: "Influenciador", points: 15 },
          { label: "Usuário final", points: 5 },
        ],
        weight: 1,
        required: true,
      },
      {
        label: "Need: qual a dor principal?",
        type: "text",
        weight: 1,
      },
      {
        label: "Timeline: quando pretende decidir?",
        type: "single",
        options: [
          { label: "Este mês", points: 25 },
          { label: "Próximos 3 meses", points: 15 },
          { label: "Sem prazo definido", points: 0 },
        ],
        weight: 1,
        required: true,
      },
    ],
  },
  meddic: {
    name: "MEDDIC",
    description: "Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion.",
    pass_threshold: 70,
    questions: [
      { label: "Metrics: quais métricas o cliente quer melhorar?", type: "text", weight: 1 },
      {
        label: "Economic buyer: identificamos o comprador econômico?",
        type: "single",
        options: YES_NO,
        weight: 2,
        required: true,
      },
      { label: "Decision criteria: quais critérios técnicos e comerciais?", type: "text", weight: 1 },
      { label: "Decision process: como é o processo de decisão?", type: "text", weight: 1 },
      { label: "Identify pain: qual a dor real quantificada?", type: "text", weight: 2 },
      {
        label: "Champion: temos um champion interno?",
        type: "single",
        options: YES_NO,
        weight: 2,
        required: true,
      },
    ],
  },
  champ: {
    name: "CHAMP",
    description: "Challenges, Authority, Money, Prioritization — foco em dor primeiro.",
    pass_threshold: 60,
    questions: [
      { label: "Challenges: quais desafios o cliente enfrenta hoje?", type: "text", weight: 2, required: true },
      {
        label: "Authority: nível de autoridade do contato",
        type: "single",
        options: [
          { label: "Decisor", points: 25 },
          { label: "Influenciador", points: 15 },
          { label: "Sem autoridade", points: 0 },
        ],
        weight: 1,
      },
      {
        label: "Money: capacidade financeira",
        type: "single",
        options: [
          { label: "Orçamento aprovado", points: 25 },
          { label: "Precisa aprovação", points: 10 },
          { label: "Sem verba", points: 0 },
        ],
        weight: 1,
      },
      {
        label: "Prioritization: prioridade do projeto",
        type: "single",
        options: [
          { label: "Alta", points: 25 },
          { label: "Média", points: 10 },
          { label: "Baixa", points: 0 },
        ],
        weight: 1,
      },
    ],
  },
  gpct: {
    name: "GPCT",
    description: "Goals, Plans, Challenges, Timeline — orientado a resultado.",
    pass_threshold: 60,
    questions: [
      { label: "Goals: quais metas mensuráveis?", type: "text", weight: 2, required: true },
      { label: "Plans: qual o plano atual para atingir?", type: "text", weight: 1 },
      { label: "Challenges: o que impede alcançar as metas?", type: "text", weight: 2 },
      {
        label: "Timeline: prazo para atingir",
        type: "single",
        options: [
          { label: "≤ 30 dias", points: 25 },
          { label: "1–3 meses", points: 15 },
          { label: "> 3 meses", points: 5 },
        ],
        weight: 1,
      },
    ],
  },
  custom: {
    name: "Questionário customizado",
    description: "Comece do zero e defina suas próprias perguntas.",
    pass_threshold: 0,
    questions: [],
  },
};

export const FRAMEWORKS = Object.keys(FRAMEWORK_TEMPLATES) as z.infer<typeof FRAMEWORK>[];
