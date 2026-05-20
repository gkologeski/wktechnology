import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "email", "tel", "textarea", "select", "number"]),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().max(120)).max(50).optional(),
  placeholder: z.string().max(120).optional(),
});

const PopupConfigSchema = z.object({
  trigger: z.enum(["load", "time", "scroll", "exit_intent"]).default("time"),
  delay_seconds: z.number().int().min(0).max(600).default(5),
  scroll_percent: z.number().int().min(1).max(100).default(50),
  frequency_days: z.number().int().min(0).max(365).default(7),
  position: z.enum(["center", "bottom-right", "bottom-left"]).default("center"),
  title: z.string().max(160).optional(),
  description: z.string().max(500).optional(),
}).partial().default({});

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/, "minúsculas, números e hífen"),
  target: z.enum(["lead", "contact"]),
  fields: z.array(FieldSchema).min(1).max(30),
  success_message: z.string().max(500).optional(),
  redirect_url: z.string().url().max(500).optional().or(z.literal("")),
  active: z.boolean().optional(),
  display_mode: z.enum(["inline", "popup", "slidein"]).optional().default("inline"),
  popup_config: PopupConfigSchema.optional(),
});

export const listForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("forms")
      .select("id, name, slug, target, fields, success_message, redirect_url, active, submit_count, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      owner_id: context.userId,
      name: data.name,
      slug: data.slug,
      target: data.target,
      fields: data.fields,
      success_message: data.success_message ?? "Obrigado pelo contato!",
      redirect_url: data.redirect_url || null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("forms").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("forms").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listFormSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ form_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("form_submissions")
      .select("id, data, lead_id, contact_id, referer, created_at")
      .eq("form_id", data.form_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
