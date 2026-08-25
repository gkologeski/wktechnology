import { randomUUID } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024),
});

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
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const sendGmailEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Resolve account (use specified or first connected for this user)
    let q = supabaseAdmin
      .from("email_accounts")
      .select("id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
      .eq("owner_id", context.userId)
      .eq("provider", "gmail");
    if (data.account_id) q = q.eq("id", data.account_id);
    const { data: rows, error: accErr } = await q
      .order("created_at", { ascending: false })
      .limit(1);
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

    // Download attachments from storage (each path must live under the user's folder)
    const attachmentInputs = data.attachments ?? [];
    const mimeAttachments: { filename: string; contentType: string; data: Buffer }[] = [];
    const attachmentMeta: { filename: string; content_type: string; size: number; path: string }[] =
      [];
    let totalBytes = 0;
    for (const a of attachmentInputs) {
      if (!a.path.startsWith(`${context.userId}/`)) {
        throw new Error("Anexo inválido: caminho fora da pasta do usuário");
      }
      const { data: file, error: dErr } = await supabaseAdmin.storage
        .from("email-attachments")
        .download(a.path);
      if (dErr || !file)
        throw new Error(
          `Falha ao ler anexo ${a.filename}: ${dErr?.message ?? "arquivo não encontrado"}`,
        );
      const buf = Buffer.from(await file.arrayBuffer());
      totalBytes += buf.length;
      if (totalBytes > 25 * 1024 * 1024) throw new Error("Total de anexos excede 25 MB");
      mimeAttachments.push({ filename: a.filename, contentType: a.content_type, data: buf });
      attachmentMeta.push({
        filename: a.filename,
        content_type: a.content_type,
        size: buf.length,
        path: a.path,
      });
    }

    const raw = buildRawMime({
      from: account.email,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      bodyHtml: tracked.html,
      bodyText: tracked.text,
      attachments: mimeAttachments.length ? mimeAttachments : undefined,
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
    const snippet = (
      data.body_text ?? (data.body_html ? data.body_html.replace(/<[^>]+>/g, " ") : "")
    ).slice(0, 200);

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
      has_attachments: attachmentMeta.length > 0,
      attachments: attachmentMeta.length ? attachmentMeta : [],
    });
    if (mErr) throw new Error(mErr.message);

    // Anexos permanecem no bucket privado `email-attachments` para que a timeline
    // possa gerar signed URLs de download depois do envio (RLS restringe leitura ao owner).

    // Bump message_count
    const { count } = await supabaseAdmin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadDbId);
    await supabaseAdmin
      .from("email_threads")
      .update({ message_count: count ?? 1 })
      .eq("id", threadDbId);

    // Create activity entry so the sent email shows up in the timeline
    if (data.contact_id || data.lead_id || data.deal_id || data.company_id) {
      const fallbackPlain = (
        data.body_text ?? (data.body_html ? data.body_html.replace(/<[^>]+>/g, " ") : "")
      ).slice(0, 4000);
      const { error: actErr } = await supabaseAdmin.from("activities").insert({
        owner_id: context.userId,
        created_by: context.userId,
        type: "email",
        subject: data.subject,
        body: tracked.html || fallbackPlain,
        email_direction: "outbound",
        email_status: "sent",
        related_contact_id: data.contact_id ?? null,
        related_lead_id: data.lead_id ?? null,
        related_deal_id: data.deal_id ?? null,
        related_company_id: data.company_id ?? null,
        external_ids: {
          email_message_id: messageDbId,
          email_thread_id: threadDbId,
          gmail_message_id: sent.id,
          gmail_thread_id: sent.threadId,
        },
      } as never);
      if (actErr) console.error("[sendGmailEmail] activity insert failed", actErr.message);
    }

    return { ok: true, thread_id: threadDbId, message_id: messageDbId, gmail_message_id: sent.id };
  });
