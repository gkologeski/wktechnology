import { randomUUID } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildRawMime,
  ensureAccessToken,
  gmailGetMessageIdHeader,
  gmailSendRaw,
  type EmailAccountRow,
} from "@/lib/gmail.server";
import { injectTracking } from "@/lib/email-tracking.server";

const emailListSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(/[,;]\s*/).filter(Boolean)))
  .pipe(z.array(z.string().email()).max(50));

const inputSchema = z.object({
  account_id: z.string().uuid().optional(),
  to: emailListSchema,
  cc: emailListSchema.optional(),
  bcc: emailListSchema.optional(),
  subject: z.string().min(1).max(998),
  body_html: z.string().optional(),
  body_text: z.string().optional(),
  contact_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
});

export const sendGmailEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Resolve account (use specified or first connected for this user)
    let q = supabaseAdmin
      .from("email_accounts")
      .select("id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
      .eq("owner_id", context.userId)
      .eq("provider", "gmail");
    if (data.account_id) q = q.eq("id", data.account_id);
    const { data: rows, error: accErr } = await q.order("created_at", { ascending: false }).limit(1);
    if (accErr) throw new Error(accErr.message);
    const account = rows?.[0] as EmailAccountRow | undefined;
    if (!account) throw new Error("Nenhuma conta Gmail conectada");

    const accessToken = await ensureAccessToken(account);

    const messageDbId = randomUUID();
    const tracked = injectTracking({
      messageId: messageDbId,
      bodyHtml: data.body_html,
      bodyText: data.body_text,
    });

    const raw = buildRawMime({
      from: account.email,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      bodyHtml: tracked.html,
      bodyText: tracked.text,
    });

    const sent = await gmailSendRaw(accessToken, raw);
    const messageIdHeader = await gmailGetMessageIdHeader(accessToken, sent.id);

    // Upsert thread
    const { data: existingThread } = await supabaseAdmin
      .from("email_threads")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("account_id", account.id)
      .eq("provider_thread_id", sent.threadId)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const snippet = (data.body_text ?? (data.body_html ? data.body_html.replace(/<[^>]+>/g, " ") : ""))
      .slice(0, 200);

    let threadDbId: string;
    if (existingThread) {
      threadDbId = existingThread.id;
      const { data: agg } = await supabaseAdmin
        .from("email_messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", threadDbId);
      void agg;
      await supabaseAdmin
        .from("email_threads")
        .update({ last_message_at: nowIso, snippet, subject: data.subject })
        .eq("id", threadDbId);
    } else {
      const { data: ins, error: tErr } = await supabaseAdmin
        .from("email_threads")
        .insert({
          owner_id: context.userId,
          account_id: account.id,
          provider_thread_id: sent.threadId,
          subject: data.subject,
          snippet,
          last_message_at: nowIso,
          contact_id: data.contact_id ?? null,
          lead_id: data.lead_id ?? null,
          deal_id: data.deal_id ?? null,
          company_id: data.company_id ?? null,
        })
        .select("id")
        .single();
      if (tErr) throw new Error(tErr.message);
      threadDbId = ins.id;
    }

    const { error: mErr } = await supabaseAdmin.from("email_messages").insert({
      id: messageDbId,
      owner_id: context.userId,
      account_id: account.id,
      thread_id: threadDbId,
      provider_message_id: sent.id,
      message_id_header: messageIdHeader,
      direction: "outbound",
      from_email: account.email,
      to_emails: data.to,
      cc_emails: data.cc ?? [],
      bcc_emails: data.bcc ?? [],
      subject: data.subject,
      body_html: tracked.html,
      body_text: tracked.text,
      snippet,
      sent_at: nowIso,
    });
    if (mErr) throw new Error(mErr.message);

    // Bump message_count
    const { count } = await supabaseAdmin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadDbId);
    await supabaseAdmin
      .from("email_threads")
      .update({ message_count: count ?? 1 })
      .eq("id", threadDbId);

    return { ok: true, thread_id: threadDbId, message_id: messageDbId, gmail_message_id: sent.id };
  });
