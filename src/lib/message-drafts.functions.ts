// Rascunhos automáticos de mensagens (e-mail e WhatsApp), por usuário e por composição.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Channel = z.enum(["email", "whatsapp"]);

const AttachmentSchema = z.object({
  path: z.string(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
});

const KeySchema = z.object({
  channel: Channel,
  scope_key: z.string().min(1).max(300),
});

const SaveSchema = KeySchema.extend({
  to_addr: z.string().max(2000).optional().default(""),
  cc: z.string().max(2000).optional().default(""),
  subject: z.string().max(500).optional().default(""),
  body_html: z.string().max(200_000).optional().default(""),
  body_text: z.string().max(200_000).optional().default(""),
  attachments: z.array(AttachmentSchema).max(20).optional().default([]),
  context: z.record(z.string(), z.string()).optional().default({}),
});

const ExistsSchema = z.object({
  channel: Channel,
  scope_keys: z.array(z.string().min(1).max(300)).min(1).max(50),
});

export type MessageDraftAttachment = z.infer<typeof AttachmentSchema>;

export const hasMessageDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExistsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("message_drafts")
      .select("scope_key")
      .eq("owner_id", userId)
      .eq("channel", data.channel)
      .in("scope_key", data.scope_keys);
    if (error) throw new Error(error.message);
    return { scope_keys: (rows ?? []).map((r) => r.scope_key as string) };
  });

export const getMessageDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KeySchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("message_drafts")
      .select("to_addr, cc, subject, body_html, body_text, attachments, context, updated_at")
      .eq("owner_id", userId)
      .eq("channel", data.channel)
      .eq("scope_key", data.scope_key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      to_addr: row.to_addr ?? "",
      cc: row.cc ?? "",
      subject: row.subject ?? "",
      body_html: row.body_html ?? "",
      body_text: row.body_text ?? "",
      attachments: (row.attachments as MessageDraftAttachment[] | null) ?? [],
      context: (row.context as Record<string, string> | null) ?? {},
      updated_at: row.updated_at as string,
    };
  });

export const saveMessageDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const hasContent =
      Boolean(data.subject.trim()) ||
      Boolean(data.body_text.trim()) ||
      Boolean(data.body_html.replace(/<[^>]*>/g, "").trim()) ||
      Boolean(data.cc.trim()) ||
      data.attachments.length > 0;

    // Composição vazia não gera rascunho — e limpa um rascunho anterior.
    if (!hasContent) {
      const { error } = await supabase
        .from("message_drafts")
        .delete()
        .eq("owner_id", userId)
        .eq("channel", data.channel)
        .eq("scope_key", data.scope_key);
      if (error) throw new Error(error.message);
      return { saved: false, updated_at: null as string | null };
    }

    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from("message_drafts").upsert(
      {
        owner_id: userId,
        channel: data.channel,
        scope_key: data.scope_key,
        to_addr: data.to_addr,
        cc: data.cc,
        subject: data.subject,
        body_html: data.body_html,
        body_text: data.body_text,
        attachments: data.attachments,
        context: data.context,
        updated_at: updatedAt,
      } as never,
      { onConflict: "owner_id,channel,scope_key" },
    );
    if (error) throw new Error(error.message);
    return { saved: true, updated_at: updatedAt };
  });

export const deleteMessageDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KeySchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("message_drafts")
      .delete()
      .eq("owner_id", userId)
      .eq("channel", data.channel)
      .eq("scope_key", data.scope_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
