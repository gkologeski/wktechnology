// Perguntas dos modelos de pesquisa (formulário padronizado).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(300),
  help_text: z.string().max(500).optional().nullable(),
  type: z.string().min(2).max(40),
  options: z.array(z.object({ label: z.string().min(1).max(200) })).max(30).default([]),
  settings: z
    .object({
      min: z.number().optional().nullable(),
      max: z.number().optional().nullable(),
      min_label: z.string().max(60).optional().nullable(),
      max_label: z.string().max(60).optional().nullable(),
      stars: z.number().optional().nullable(),
      placeholder: z.string().max(120).optional().nullable(),
    })
    .default({}),
  required: z.boolean().default(false),
});

export const listSurveyTemplateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ survey_template_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("survey_template_questions")
      .select("id, label, help_text, type, options, settings, required, position")
      .eq("survey_template_id", data.survey_template_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Substitui o conjunto de perguntas do modelo, preservando ids existentes. */
export const saveSurveyTemplateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        survey_template_id: z.string().uuid(),
        questions: z.array(QuestionSchema).max(60),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ws = await getActiveWorkspaceId(supabase, userId);

    const { data: existing, error: exErr } = await supabase
      .from("survey_template_questions")
      .select("id")
      .eq("survey_template_id", data.survey_template_id);
    if (exErr) throw new Error(exErr.message);

    const keep = new Set(data.questions.map((q) => q.id).filter(Boolean) as string[]);
    const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("survey_template_questions")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    for (const [index, q] of data.questions.entries()) {
      const base = {
        survey_template_id: data.survey_template_id,
        owner_id: userId,
        workspace_id: ws,
        label: q.label,
        help_text: q.help_text ?? null,
        type: q.type,
        options: q.options,
        settings: q.settings,
        required: q.required,
        position: index,
      };
      if (q.id) {
        const { error } = await supabase
          .from("survey_template_questions")
          .update(base as never)
          .eq("id", q.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("survey_template_questions")
          .insert(base as never);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true, count: data.questions.length };
  });
