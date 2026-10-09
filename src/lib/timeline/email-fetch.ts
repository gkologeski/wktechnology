// Resumo de e-mails por página e detalhe sob demanda da timeline (sob RLS).
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "@/lib/db-types";
import type { EmailMeta } from "@/components/activity/timeline-shared";

const messageIdOf = (row: Activity) => {
  const ex = (row as { external_ids?: Record<string, unknown> | null }).external_ids ?? {};
  return typeof ex.email_message_id === "string" ? ex.email_message_id : null;
};

type MsgSummary = {
  id: string;
  direction: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  sent_at: string | null;
  received_at: string | null;
  open_count: number | null;
  click_count: number | null;
  first_opened_at: string | null;
  has_attachments: boolean | null;
};

/** Resumo de e-mail por página: sem corpo, anexos nem eventos de rastreamento. */
export async function loadEmailSummaries(rows: Activity[]): Promise<Map<string, EmailMeta>> {
  const meta = new Map<string, EmailMeta>();
  const byMessage = new Map<string, string>();
  for (const row of rows) {
    if (row.type !== "email") continue;
    const mid = messageIdOf(row);
    if (mid) byMessage.set(mid, row.id);
  }
  if (!byMessage.size) return meta;
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, direction, from_email, from_name, to_emails, cc_emails, sent_at, received_at, open_count, click_count, first_opened_at, has_attachments",
    )
    .in("id", [...byMessage.keys()]);
  if (error) throw new Error(error.message);
  for (const m of (data ?? []) as MsgSummary[]) {
    const activityId = byMessage.get(m.id);
    if (!activityId) continue;
    meta.set(activityId, {
      message_id: m.id,
      detail_loaded: false,
      direction: m.direction === "inbound" || m.direction === "outbound" ? m.direction : null,
      from_email: m.from_email,
      from_name: m.from_name,
      to_emails: m.to_emails ?? [],
      cc_emails: m.cc_emails ?? [],
      body_html: null,
      body_text: null,
      sent_at: m.sent_at,
      received_at: m.received_at,
      open_count: Number(m.open_count ?? 0),
      click_count: Number(m.click_count ?? 0),
      first_opened_at: m.first_opened_at,
      last_opened_at: null,
      last_clicked_at: null,
      last_clicked_url: null,
      has_attachments: Boolean(m.has_attachments),
      attachments: [],
    });
  }
  return meta;
}

export type EmailDetail = Pick<
  EmailMeta,
  | "body_html"
  | "body_text"
  | "attachments"
  | "last_opened_at"
  | "last_clicked_at"
  | "last_clicked_url"
>;

/** Corpo, anexos e último rastreamento de um e-mail (sob demanda, sob RLS). */
export async function fetchEmailDetail(messageId: string): Promise<EmailDetail> {
  const lastEvent = (type: "open" | "click") =>
    supabase
      .from("email_tracking_events")
      .select("url, occurred_at")
      .eq("message_id", messageId)
      .eq("event_type", type)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  const [{ data: m, error }, { data: open }, { data: click }] = await Promise.all([
    supabase
      .from("email_messages")
      .select("body_html, body_text, attachments")
      .eq("id", messageId)
      .maybeSingle(),
    lastEvent("open"),
    lastEvent("click"),
  ]);
  if (error) throw new Error(error.message);
  if (!m) throw new Error("E-mail indisponível ou sem permissão de acesso.");
  const raw = Array.isArray(m.attachments) ? (m.attachments as Array<Record<string, unknown>>) : [];
  return {
    body_html: m.body_html,
    body_text: m.body_text,
    attachments: raw.map((a) => ({
      path: typeof a.path === "string" ? a.path : undefined,
      filename: typeof a.filename === "string" ? a.filename : "arquivo",
      content_type: typeof a.content_type === "string" ? a.content_type : undefined,
      size: typeof a.size === "number" ? a.size : undefined,
    })),
    last_opened_at: open?.occurred_at ?? null,
    last_clicked_at: click?.occurred_at ?? null,
    last_clicked_url: click?.url ?? null,
  };
}
