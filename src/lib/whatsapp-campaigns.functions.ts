import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecipientInput = z.object({
  phone: z.string().min(5).max(32),
  contactId: z.string().uuid().nullable().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  body_template: z.string().max(1600).optional().default(""),
  template_name: z.string().max(60).optional(),
  content_sid: z
    .string()
    .regex(/^HX[0-9a-fA-F]{32}$/, "ContentSid inválido")
    .optional()
    .or(z.literal("")),
  content_variables_template: z.record(z.string(), z.string()).optional(),
  media_url: z.string().url().optional().or(z.literal("")),
  media_content_type: z.string().max(120).optional(),
  rate_per_minute: z.number().int().min(1).max(120).default(10),
  scheduled_at: z.string().datetime().optional(),
  recipients: z.array(RecipientInput).min(1).max(5000),
});

export const createWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: camp, error } = await supabase
      .from("whatsapp_campaigns")
      .insert({
        owner_id: userId,
        name: data.name,
        body_template: data.body_template || null,
        template_name: data.template_name || null,
        content_sid: data.content_sid || null,
        content_variables_template: data.content_variables_template ?? {},
        media_url: data.media_url || null,
        media_content_type: data.media_content_type || null,
        rate_per_minute: data.rate_per_minute,
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        status: "draft",
        total: data.recipients.length,
      })
      .select("id")
      .single();
    if (error) throw error;

    const rows = data.recipients.map((r) => ({
      campaign_id: camp.id,
      owner_id: userId,
      contact_id: r.contactId ?? null,
      phone: r.phone.trim(),
      variables: r.variables ?? {},
      status: "pending" as const,
    }));
    // Insere em lotes de 500 para evitar payload gigante
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error: rErr } = await supabase.from("whatsapp_campaign_recipients").insert(slice);
      if (rErr) throw rErr;
    }
    return { id: camp.id as string };
  });

export const listWhatsAppCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("whatsapp_campaigns")
      .select(
        "id, name, status, total, sent, failed, rate_per_minute, scheduled_at, started_at, finished_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const getWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: camp, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { data: recips } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("id, phone, status, twilio_sid, error, sent_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return { campaign: camp, recipients: recips ?? [] };
  });

export const setWhatsAppCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["running", "paused", "canceled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status: "running" | "paused" | "canceled";
      started_at?: string;
      finished_at?: string;
    } = { status: data.status };
    if (data.status === "running") patch.started_at = new Date().toISOString();
    if (data.status === "canceled") patch.finished_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("whatsapp_campaigns")
      .update(patch)
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
