// Server functions para templates de cobrança (Fase 7 - Régua).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const TemplateZ = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  channel: z.enum(["email", "whatsapp"]),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(4000),
  active: z.boolean().default(true),
});

export const listChargingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("charging_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertChargingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TemplateZ.parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const payload = {
      workspace_id: workspaceId,
      owner_id: context.userId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      active: data.active,
    };
    const q = data.id
      ? context.supabase
          .from("charging_templates")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : context.supabase.from("charging_templates").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { template: row };
  });

export const deleteChargingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("charging_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
