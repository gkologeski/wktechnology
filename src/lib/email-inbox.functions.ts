import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEmailThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_threads")
      .select("id, subject, snippet, last_message_at, message_count, contact_id, account_id")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const getEmailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ thread_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: tErr } = await context.supabase
      .from("email_threads")
      .select("id, subject, snippet, last_message_at, message_count, contact_id, account_id, provider_thread_id")
      .eq("id", data.thread_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread não encontrada");

    const { data: messages, error: mErr } = await context.supabase
      .from("email_messages")
      .select(
        "id, direction, from_email, from_name, to_emails, cc_emails, subject, body_html, body_text, snippet, sent_at, received_at, created_at, open_count, click_count, first_opened_at, has_attachments, attachments, message_id_header",
      )
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    return { thread, messages: messages ?? [] };
  });
