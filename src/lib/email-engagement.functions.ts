// Server functions: engajamento de e-mail 1:1 (aberturas e cliques)
// para o timeline da entidade e para o relatório agregado em Analytics.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EntityEnum = z.enum(["contact", "lead", "deal", "company"]);

const ColByEntity: Record<
  z.infer<typeof EntityEnum>,
  "contact_id" | "lead_id" | "deal_id" | "company_id"
> = {
  contact: "contact_id",
  lead: "lead_id",
  deal: "deal_id",
  company: "company_id",
};

export interface EntityEmailItem {
  id: string;
  subject: string | null;
  to_emails: string[] | null;
  sent_at: string | null;
  open_count: number;
  click_count: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  last_clicked_url: string | null;
}

/** Lista e-mails 1:1 (outbound) enviados para uma entidade, com métricas de engajamento. */
export const listEntityEmailEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: EntityEnum,
        entity_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<EntityEmailItem[]> => {
    const { supabase } = context;
    const col = ColByEntity[data.entity];

    // Threads da entidade
    const { data: threads, error: tErr } = await supabase
      .from("email_threads")
      .select("id")
      .eq(col, data.entity_id);
    if (tErr) throw new Error(tErr.message);
    const threadIds = (threads ?? []).map((t) => t.id as string);
    if (threadIds.length === 0) return [];

    // Mensagens outbound
    const { data: messages, error: mErr } = await supabase
      .from("email_messages")
      .select("id, subject, to_emails, sent_at, open_count, click_count, first_opened_at")
      .in("thread_id", threadIds)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(data.limit);
    if (mErr) throw new Error(mErr.message);

    const msgIds = (messages ?? []).map((m) => m.id as string);
    if (msgIds.length === 0) return [];

    // Eventos recentes para cada mensagem
    const { data: events } = await supabase
      .from("email_tracking_events")
      .select("message_id, event_type, url, occurred_at")
      .in("message_id", msgIds)
      .order("occurred_at", { ascending: false });

    type EvRow = {
      message_id: string;
      event_type: string;
      url: string | null;
      occurred_at: string;
    };
    const lastOpen = new Map<string, string>();
    const lastClick = new Map<string, { at: string; url: string | null }>();
    for (const e of (events ?? []) as EvRow[]) {
      if (e.event_type === "open" && !lastOpen.has(e.message_id)) {
        lastOpen.set(e.message_id, e.occurred_at);
      } else if (e.event_type === "click" && !lastClick.has(e.message_id)) {
        lastClick.set(e.message_id, { at: e.occurred_at, url: e.url });
      }
    }

    return (messages ?? []).map((m) => {
      const click = lastClick.get(m.id as string);
      return {
        id: m.id as string,
        subject: (m.subject as string | null) ?? null,
        to_emails: (m.to_emails as string[] | null) ?? null,
        sent_at: (m.sent_at as string | null) ?? null,
        open_count: Number(m.open_count ?? 0),
        click_count: Number(m.click_count ?? 0),
        first_opened_at: (m.first_opened_at as string | null) ?? null,
        last_opened_at: lastOpen.get(m.id as string) ?? null,
        last_clicked_at: click?.at ?? null,
        last_clicked_url: click?.url ?? null,
      };
    });
  });

export interface EmailEngagementReport {
  total_sent: number;
  unique_recipients: number;
  opened: number;
  clicked: number;
  open_rate_pct: number;
  click_rate_pct: number;
  ctor_pct: number; // click-to-open rate
  by_day: Array<{ date: string; sent: number; opened: number; clicked: number }>;
  top: Array<{
    id: string;
    subject: string | null;
    to: string | null;
    sent_at: string | null;
    open_count: number;
    click_count: number;
  }>;
}

/** Relatório agregado de engajamento de e-mail 1:1 para a aba Analytics. */
export const getEmailEngagementReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<EmailEngagementReport> => {
    const { supabase } = context;

    let q = supabase
      .from("email_messages")
      .select("id, subject, to_emails, sent_at, open_count, click_count, first_opened_at")
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(5000);
    if (data.dateFrom) q = q.gte("sent_at", data.dateFrom);
    if (data.dateTo) q = q.lte("sent_at", data.dateTo);
    const { data: msgs, error } = await q;
    if (error) throw new Error(error.message);

    const list = (msgs ?? []) as Array<{
      id: string;
      subject: string | null;
      to_emails: string[] | null;
      sent_at: string | null;
      open_count: number | null;
      click_count: number | null;
      first_opened_at: string | null;
    }>;

    let opened = 0;
    let clicked = 0;
    const recipients = new Set<string>();
    const byDay = new Map<
      string,
      { date: string; sent: number; opened: number; clicked: number }
    >();

    for (const m of list) {
      if ((m.open_count ?? 0) > 0 || m.first_opened_at) opened += 1;
      if ((m.click_count ?? 0) > 0) clicked += 1;
      for (const r of m.to_emails ?? []) recipients.add(r.toLowerCase());
      const day = (m.sent_at ?? "").slice(0, 10);
      if (!day) continue;
      const b = byDay.get(day) ?? { date: day, sent: 0, opened: 0, clicked: 0 };
      b.sent += 1;
      if ((m.open_count ?? 0) > 0 || m.first_opened_at) b.opened += 1;
      if ((m.click_count ?? 0) > 0) b.clicked += 1;
      byDay.set(day, b);
    }

    const total = list.length;
    const openRate = total ? (opened / total) * 100 : 0;
    const clickRate = total ? (clicked / total) * 100 : 0;
    const ctor = opened ? (clicked / opened) * 100 : 0;

    const top = [...list]
      .sort(
        (a, b) =>
          (b.open_count ?? 0) + (b.click_count ?? 0) - ((a.open_count ?? 0) + (a.click_count ?? 0)),
      )
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        subject: m.subject,
        to: (m.to_emails ?? [])[0] ?? null,
        sent_at: m.sent_at,
        open_count: Number(m.open_count ?? 0),
        click_count: Number(m.click_count ?? 0),
      }));

    return {
      total_sent: total,
      unique_recipients: recipients.size,
      opened,
      clicked,
      open_rate_pct: openRate,
      click_rate_pct: clickRate,
      ctor_pct: ctor,
      by_day: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
      top,
    };
  });
