// Templates de e-mail por etapa do funil + envio enfileirado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { data, error } = await supabase
      .from("ats_stage_emails")
      .select("id, stage_value, enabled, subject, body, updated_at")
      .eq("owner_id", userId)
      .order("stage_value");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertStageEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TemplateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_stage_emails")
      .upsert(
        {
          owner_id: userId,
          stage_value: data.stage_value,
          enabled: data.enabled,
          subject: data.subject,
          body: data.body,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "owner_id,stage_value" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStageEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stage_value: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_stage_emails")
      .delete()
      .eq("owner_id", userId)
      .eq("stage_value", data.stage_value);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStageEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ application_id: z.string().uuid().optional() }).optional().parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("ats_stage_email_log")
      .select("id, application_id, candidate_id, job_id, stage_value, to_email, subject, status, error, created_at, sent_at")
      .eq("owner_id", userId)
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
    z.object({ id: z.string().uuid(), status: z.enum(["sent", "failed"]), error: z.string().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_stage_email_log")
      .update({
        status: data.status,
        error: data.error ?? null,
        sent_at: new Date().toISOString(),
      } as never)
      .eq("owner_id", userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
