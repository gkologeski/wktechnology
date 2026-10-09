// Histórico paginado das conversas da Inbox (sob RLS do usuário).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isHistoryTimestamp } from "@/lib/inbox/message-history";

const cursorSchema = z.object({
  at: z.string().max(40).refine(isHistoryTimestamp, "cursor inválido"),
  id: z.string().uuid(),
});

export const listConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        channel: z.enum(["email", "whatsapp", "chat"]),
        conversation_id: z.string().uuid(),
        before: cursorSchema.optional(),
        after: cursorSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .refine((v) => !(v.before && v.after), "use before ou after")
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    type Res = { data: unknown[] | null; error: { message: string } | null };
    type Q = PromiseLike<Res> & {
      eq(c: string, v: string): Q;
      or(f: string): Q;
      order(c: string, o: { ascending: boolean }): Q;
      limit(n: number): Q;
    };
    const SPEC = {
      email: {
        table: "email_messages",
        fk: "thread_id",
        select:
          "id, thread_id, direction, from_email, from_name, to_emails, cc_emails, subject, snippet, sent_at, received_at, created_at, open_count, click_count, first_opened_at, has_attachments, message_id_header",
        limit: 20,
      },
      whatsapp: {
        table: "whatsapp_messages",
        fk: "conversation_id",
        select:
          "id, conversation_id, direction, body, media_url, media_content_type, status, created_at, sent_at, delivered_at, read_at, wa_message_id, template_name, is_template",
        limit: 50,
      },
      chat: {
        table: "live_chat_messages",
        fk: "session_id",
        select: "id, session_id, direction, author_user_id, body, created_at",
        limit: 50,
      },
    } as const;
    const spec = SPEC[data.channel];
    const limit = data.limit ?? spec.limit;
    const from = context.supabase.from as unknown as (t: string) => { select(s: string): Q };
    let q = from.call(context.supabase, spec.table).select(spec.select).eq(spec.fk, data.conversation_id);
    if (data.channel === "chat") {
      const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
      q = q.eq("owner_id", await resolveActiveWorkspace(context.userId));
    }
    const cur = data.before ?? data.after;
    const asc = !!data.after;
    if (cur) {
      const op = data.before ? "lt" : "gt";
      q = q.or(`created_at.${op}."${cur.at}",and(created_at.eq."${cur.at}",id.${op}.${cur.id})`);
    }
    q = q
      .order("created_at", { ascending: asc })
      .order("id", { ascending: asc })
      .limit(limit + 1);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Record<string, unknown> & { id: string; created_at: string }>;
    const hasMore = list.length > limit;
    const page = list.slice(0, limit);
    if (!asc) page.reverse();
    return { items: page, hasMore };
  });

export const getEmailThreadMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ thread_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("email_threads")
      .select(
        "id, subject, snippet, last_message_at, message_count, contact_id, lead_id, identity_status, account_id, provider_thread_id, assigned_to",
      )
      .eq("id", data.thread_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread não encontrada");
    return thread;
  });

export const getEmailMessageBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ message_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("email_messages")
      .select("id, body_html, body_text, attachments")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Mensagem não encontrada");
    return row;
  });
