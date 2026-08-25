// Templates de e-mail por etapa do funil + envio enfileirado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const TemplateSchema = z.object({
  stage_value: z.string().min(1).max(50),
  enabled: z.boolean().default(true),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

export const listStageEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("ats_stage_emails")
      .select("id, stage_value, enabled, subject, body, updated_at")
      .eq("workspace_id", workspaceId)
      .order("stage_value");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertStageEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TemplateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const base = {
      stage_value: data.stage_value,
      enabled: data.enabled,
      subject: data.subject,
      body: data.body,
      updated_at: new Date().toISOString(),
    };
    // O template é do workspace: atualiza o existente (de qualquer criador)
    // em vez de criar uma linha por usuário.
    const { data: existing } = await supabase
      .from("ats_stage_emails")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("stage_value", data.stage_value)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("ats_stage_emails")
        .update(base as never)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase
      .from("ats_stage_emails")
      .insert({ ...base, owner_id: userId, workspace_id: workspaceId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStageEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stage_value: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("ats_stage_emails")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("stage_value", data.stage_value);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStageEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ application_id: z.string().uuid().optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    let q = supabase
      .from("ats_stage_email_log")
      .select(
        "id, application_id, candidate_id, job_id, stage_value, to_email, subject, status, error, created_at, sent_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data?.application_id) q = q.eq("application_id", data.application_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markStageEmailSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["sent", "failed"]),
        error: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await supabase
      .from("ats_stage_email_log")
      .update({
        status: data.status,
        error: data.error ?? null,
        sent_at: new Date().toISOString(),
      } as never)
      .eq("workspace_id", workspaceId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
