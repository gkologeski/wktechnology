import { recordUpdatePayload } from "@/lib/access-control/record-update-payload";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  subject: z.string().max(500).optional().default(""),
  body_html: z.string().max(200_000).optional().default(""),
  body_text: z.string().max(200_000).optional().default(""),
});

const snippetSchema = z.object({
  id: z.string().uuid().optional(),
  shortcut: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9_\-/]+$/, "use só letras, números, _ - /"),
  body: z.string().min(1).max(10_000),
});

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.automation.email_templates", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.automation.email_templates", ["create", "update"])])
  .inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      owner_id: context.userId,
    };
    const query = data.id
      ? context.supabase
          .from("email_templates")
          .update(recordUpdatePayload(payload))
          .eq("id", data.id)
      : context.supabase.from("email_templates").insert(payload);
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.automation.email_templates", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "email_templates", data.id, "delete");

    const { error } = await context.supabase.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmailSnippets = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.snippets", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_snippets")
      .select("*")
      .order("shortcut", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const upsertEmailSnippet = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.snippets", ["create", "update"])])
  .inputValidator((input) => snippetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = { ...data, owner_id: context.userId };
    const query = data.id
      ? context.supabase
          .from("email_snippets")
          .update(recordUpdatePayload(payload))
          .eq("id", data.id)
      : context.supabase.from("email_snippets").insert(payload);
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteEmailSnippet = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.snippets", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "email_snippets", data.id, "delete");

    const { error } = await context.supabase.from("email_snippets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
