import { assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
// CRUD de Interview Kits (perguntas reaproveitáveis por etapa do pipeline).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteWhereGuarded } from "@/lib/db/delete-guarded";

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
  is_active: z.boolean().default(true),
  questions: z.array(QuestionSchema).min(1).max(30),
});

export const listInterviewKits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ editor: z.boolean().optional() }).optional().parse(d))
  .handler(async ({ context, data: input }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    if (input?.editor)
      await assertAnyPermission(supabase, userId, workspaceId, [
        "techhire.interview_kits.view.own",
        "techhire.interview_kits.view.team",
        "techhire.interview_kits.view.workspace",
      ]);
    const { data, error } = await supabase
      .from("ats_interview_kits")
      .select("id, name, pipeline_id, stage_value, questions, is_default, is_active, updated_at")
      .eq("workspace_id", workspaceId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).filter((k) => input?.editor || k.is_active);
  });

export const getInterviewKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("ats_interview_kits")
      .select("id, name, pipeline_id, stage_value, questions, is_default, is_active, updated_at")
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
    if (data.id) await assertHrRecordAccess(supabase, "interview_kits", "update", data.id);
    else
      await assertAnyPermission(supabase, userId, workspaceId, [
        "techhire.interview_kits.create.own",
        "techhire.interview_kits.create.workspace",
      ]);
    const { data: id, error } = await supabase.rpc(
      "ats_save_interview_kit" as never,
      {
        _id: data.id ?? null,
        _payload: {
          ...data,
          pipeline_id: data.pipeline_id ?? null,
          stage_value: data.stage_value ?? null,
        },
      } as never,
    );
    if (error) throw new Error(error.message);
    if (!id) throw new Error("Kit indisponível ou sem permissão.");
    return { id: id as string };
  });

export const deleteInterviewKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertHrRecordAccess(supabase, "interview_kits", "delete", data.id);
    await deleteWhereGuarded(
      supabase,
      "ats_interview_kits",
      { id: data.id, workspace_id: workspaceId },
      "Você não tem permissão para excluir este kit de entrevista.",
    );
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
      .eq("is_active", true)
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
