// CRUD de Interview Kits (perguntas reaproveitáveis por etapa do pipeline).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const QuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(2000),
  kind: z.enum(["text", "video"]).default("text"),
  time_limit_sec: z.number().int().min(15).max(600).optional(),
  max_takes: z.number().int().min(1).max(5).optional(),
});
export type InterviewKitQuestion = z.infer<typeof QuestionSchema>;

const KitSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_value: z.string().max(80).nullable().optional(),
  is_default: z.boolean().default(false),
  questions: z.array(QuestionSchema).min(1).max(30),
});

export const listInterviewKits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("ats_interview_kits")
      .select("id, name, pipeline_id, stage_value, questions, is_default, updated_at")
      .eq("workspace_id", workspaceId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getInterviewKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("ats_interview_kits")
      .select("id, name, pipeline_id, stage_value, questions, is_default, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Kit não encontrado");
    return row;
  });

export const saveInterviewKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KitSaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (data.is_default) {
      // garante 1 default por (pipeline_id, stage_value)
      let q = supabase
        .from("ats_interview_kits")
        .update({ is_default: false } as never)
        .eq("workspace_id", workspaceId);
      q = data.pipeline_id ? q.eq("pipeline_id", data.pipeline_id) : q.is("pipeline_id", null);
      q = data.stage_value ? q.eq("stage_value", data.stage_value) : q.is("stage_value", null);
      await q;
    }
    const row = {
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      pipeline_id: data.pipeline_id ?? null,
      stage_value: data.stage_value ?? null,
      is_default: data.is_default,
      questions: data.questions as never,
    };
    if (data.id) {
      const { error } = await supabase
        .from("ats_interview_kits")
        .update(row as never)
        .eq("workspace_id", workspaceId)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("ats_interview_kits")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteInterviewKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("ats_interview_kits")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Resolve melhor kit para uma combinação (pipeline_id, stage_value):
// prioridade: match exato e is_default → match exato → match pipeline default → primeiro do owner.
export const resolveKitForStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pipeline_id: z.string().uuid().nullable().optional(),
        stage_value: z.string().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("ats_interview_kits")
      .select("id, name, pipeline_id, stage_value, questions, is_default")
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const pid = data.pipeline_id ?? null;
    const sv = data.stage_value ?? null;
    const exactDefault = list.find(
      (k) => k.pipeline_id === pid && k.stage_value === sv && k.is_default,
    );
    if (exactDefault) return exactDefault;
    const exact = list.find((k) => k.pipeline_id === pid && k.stage_value === sv);
    if (exact) return exact;
    const pipelineDefault = list.find((k) => k.pipeline_id === pid && k.is_default);
    if (pipelineDefault) return pipelineDefault;
    return list[0] ?? null;
  });
