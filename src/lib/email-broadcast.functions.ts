// Server fns para campanhas de email (broadcast).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyOf = (x: any) => x;

const CreateInput = z.object({
  name: z.string().min(1).max(160),
  subject: z.string().min(1).max(998),
  body_html: z.string().max(200_000).optional().default(""),
  body_text: z.string().max(200_000).optional().default(""),
  template_id: z.string().uuid().nullable().optional(),
  segment_id: z.string().uuid().nullable().optional(),
  email_account_id: z.string().uuid().nullable().optional(),
  rate_per_minute: z.number().int().min(1).max(600).default(30),
  scheduled_at: z.string().datetime().optional(),
  reply_to: z.string().email().nullable().optional(),
});

export const listEmailBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await anyOf(context.supabase)
      .from("email_broadcasts")
      .select("id, name, subject, status, total, sent, failed, rate_per_minute, scheduled_at, started_at, finished_at, segment_id, email_account_id, created_at, last_error")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const getEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = anyOf(context.supabase);
    const { data: b, error } = await sb
      .from("email_broadcasts").select("*").eq("id", data.id).single();
    if (error) throw error;
    const { data: recips } = await sb
      .from("email_broadcast_recipients")
      .select("id, email, name, status, error, sent_at")
      .eq("broadcast_id", data.id)
      .order("created_at", { ascending: true })
      .limit(1000);
    return { broadcast: b, recipients: recips ?? [] };
  });

export const createEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = anyOf(context.supabase);
    const { data: row, error } = await sb
      .from("email_broadcasts")
      .insert({
        owner_id: context.userId,
        name: data.name,
        subject: data.subject,
        body_html: data.body_html || null,
        body_text: data.body_text || null,
        template_id: data.template_id ?? null,
        segment_id: data.segment_id ?? null,
        email_account_id: data.email_account_id ?? null,
        rate_per_minute: data.rate_per_minute,
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        reply_to: data.reply_to ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const updateEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid() }).extend(CreateInput.partial().shape).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await anyOf(context.supabase)
      .from("email_broadcasts")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await anyOf(context.supabase)
      .from("email_broadcasts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const scheduleEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), scheduled_at: z.string().datetime().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { resolveBroadcastRecipients } = await import("@/lib/email-broadcast/engine.server");
    const res = await resolveBroadcastRecipients(data.id);
    const { error } = await anyOf(context.supabase)
      .from("email_broadcasts")
      .update({
        status: "scheduled",
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        started_at: null,
        finished_at: null,
        last_error: null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return res;
  });

export const setEmailBroadcastStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["paused", "running", "canceled"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "canceled") patch.finished_at = new Date().toISOString();
    const { error } = await anyOf(context.supabase)
      .from("email_broadcasts").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const sendTestEmailBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      subject: z.string().min(1),
      body_html: z.string().optional().default(""),
      body_text: z.string().optional().default(""),
      to: z.string().email(),
      email_account_id: z.string().uuid().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { sendGmailEmail } = await import("@/lib/email-send.functions");
    void sendGmailEmail; // referenciado abaixo via supabaseAdmin path
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureAccessToken, gmailSendRaw, buildRawMime, type EmailAccountRow } =
      await import("@/lib/gmail.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    let q = admin
      .from("email_accounts")
      .select("id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
      .eq("provider", "gmail")
      .eq("status", "connected");
    if (data.email_account_id) q = q.eq("id", data.email_account_id);
    const { data: rows } = await q.order("created_at", { ascending: false }).limit(1);
    const acc = rows?.[0] as EmailAccountRow | undefined;
    if (!acc) throw new Error("Nenhuma conta Gmail conectada");
    const token = await ensureAccessToken(acc);
    const raw = buildRawMime({
      from: acc.email,
      to: [data.to],
      subject: `[TESTE] ${data.subject}`,
      bodyHtml: data.body_html || `<p>${data.body_text || ""}</p>`,
      bodyText: data.body_text || "",
    });
    await gmailSendRaw(token, raw);
    return { ok: true };
  });

export const listSegmentsForBroadcast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await anyOf(context.supabase)
      .from("segments")
      .select("id, name, entity, kind, member_count")
      .in("entity", ["lead", "contact", "leads", "contacts"])
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
