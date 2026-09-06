// Carregamento de dados da linha do tempo de atividades.
//
// Extraído de `src/components/activity-timeline.tsx` sem mudança de
// comportamento: busca as atividades do registro, enriquece e-mails com os
// metadados de rastreamento, espelha eventos do Google Calendar via RPC,
// aplica o filtro de período e carrega o histórico de alterações.
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "@/lib/db-types";
import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";
import type { PropertyChangeRow } from "@/lib/timeline/history-groups";
import {
  calendarAttendees,
  type EmailMeta,
  type RelatedKey,
} from "@/components/activity/timeline-shared";

export type TimelineData = {
  items: Activity[];
  emailMeta: Map<string, EmailMeta>;
  historyRows: PropertyChangeRow[];
  error?: string;
};

const ENTITY_KIND: Record<RelatedKey, string> = {
  related_lead_id: "lead",
  related_contact_id: "contact",
  related_company_id: "company",
  related_deal_id: "deal",
  related_ticket_id: "ticket",
};

const HISTORY_ENTITY: Record<RelatedKey, string | null> = {
  related_lead_id: "leads",
  related_contact_id: "contacts",
  related_company_id: "companies",
  related_deal_id: "deals",
  related_ticket_id: null,
};

const externalIds = (row: unknown) =>
  ((row as { external_ids?: Record<string, unknown> } | null)?.external_ids ?? {}) as Record<
    string,
    unknown
  >;

const strField = (obj: Record<string, unknown>, key: string) =>
  typeof obj[key] === "string" ? (obj[key] as string) : null;

type MsgRow = {
  id: string;
  direction: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  body_html: string | null;
  body_text: string | null;
  sent_at: string | null;
  received_at: string | null;
  open_count: number | null;
  click_count: number | null;
  first_opened_at: string | null;
  has_attachments: boolean | null;
  attachments: unknown;
};

type EvRow = { message_id: string; event_type: string; url: string | null; occurred_at: string };

/** Enriquece atividades de e-mail com corpo, anexos, aberturas e cliques. */
async function enrichEmails(baseRows: Activity[]) {
  const emailMeta = new Map<string, EmailMeta>();
  const messageIds = [
    ...new Set(
      baseRows.map((row) => strField(externalIds(row), "email_message_id")).filter(Boolean) as string[],
    ),
  ];
  if (messageIds.length === 0) return { rows: baseRows, emailMeta };

  const [{ data: messages }, { data: events }] = await Promise.all([
    supabase
      .from("email_messages")
      .select(
        "id, direction, from_email, from_name, to_emails, cc_emails, body_html, body_text, sent_at, received_at, open_count, click_count, first_opened_at, has_attachments, attachments",
      )
      .in("id", messageIds),
    supabase
      .from("email_tracking_events")
      .select("message_id, event_type, url, occurred_at")
      .in("message_id", messageIds)
      .order("occurred_at", { ascending: false }),
  ]);

  const messageById = new Map(((messages ?? []) as MsgRow[]).map((m) => [m.id, m]));
  const lastOpen = new Map<string, string>();
  const lastClick = new Map<string, { at: string; url: string | null }>();
  for (const e of (events ?? []) as EvRow[]) {
    if (e.event_type === "open" && !lastOpen.has(e.message_id)) {
      lastOpen.set(e.message_id, e.occurred_at);
    } else if (e.event_type === "click" && !lastClick.has(e.message_id)) {
      lastClick.set(e.message_id, { at: e.occurred_at, url: e.url });
    }
  }

  const rows = baseRows.map((row) => {
    if (row.type !== "email") return row;
    const messageId = strField(externalIds(row), "email_message_id");
    const message = messageId ? messageById.get(messageId) : null;
    if (!message) return row;
    const attachmentsRaw = Array.isArray(message.attachments)
      ? (message.attachments as Array<Record<string, unknown>>)
      : [];
    const attachments = attachmentsRaw.map((a) => ({
      path: typeof a.path === "string" ? a.path : undefined,
      filename: typeof a.filename === "string" ? a.filename : "arquivo",
      content_type: typeof a.content_type === "string" ? a.content_type : undefined,
      size: typeof a.size === "number" ? a.size : undefined,
    }));
    const click = lastClick.get(message.id);
    const dir =
      message.direction === "inbound" || message.direction === "outbound" ? message.direction : null;
    emailMeta.set(row.id, {
      direction: dir,
      from_email: message.from_email,
      from_name: message.from_name,
      to_emails: message.to_emails ?? [],
      cc_emails: message.cc_emails ?? [],
      body_html: message.body_html,
      body_text: message.body_text,
      sent_at: message.sent_at,
      received_at: message.received_at,
      open_count: Number(message.open_count ?? 0),
      click_count: Number(message.click_count ?? 0),
      first_opened_at: message.first_opened_at,
      last_opened_at: lastOpen.get(message.id) ?? null,
      last_clicked_at: click?.at ?? null,
      last_clicked_url: click?.url ?? null,
      has_attachments: Boolean(message.has_attachments),
      attachments,
    });
    const html = message.body_html?.trim() ? message.body_html : message.body_text;
    return html ? ({ ...row, body: html } as Activity) : row;
  });

  return { rows, emailMeta };
}

/**
 * Espelha eventos do Google Calendar pela RPC `get_entity_timeline` e completa
 * atividades reais com a gravação encontrada depois da criação.
 *
 * Muta `baseRows` no mesmo ponto em que o componente original mutava.
 */
async function loadCalendarVirtuals(
  baseRows: Activity[],
  relatedKey: RelatedKey,
  relatedId: string,
  range: { start?: Date; end?: Date },
): Promise<Activity[]> {
  try {
    const { data: tl, error: tlErr } = await supabase.rpc("get_entity_timeline", {
      p_entity_kind: ENTITY_KIND[relatedKey],
      p_entity_id: relatedId,
      p_since: range.start ? range.start.toISOString() : undefined,
      p_until: range.end ? range.end.toISOString() : undefined,
      p_limit: 300,
    });
    if (tlErr) throw tlErr;
    const calIdsFromRpc = ((tl ?? []) as Array<{ id: string; source: string }>)
      .filter((r) => r.source === "calendar_event")
      .map((r) => r.id.replace(/^cal_/, ""))
      .filter(Boolean);
    const existingCalIds = new Set(
      baseRows
        .map((row) => strField(externalIds(row), "calendar_event_id"))
        .filter(Boolean) as string[],
    );
    const calIds = Array.from(new Set([...calIdsFromRpc, ...existingCalIds]));
    if (calIds.length === 0) return [];

    const { data: events } = await supabase
      .from("calendar_events")
      .select(
        "id, title, description, start_at, end_at, location, html_link, hangout_link, attendees, recording_url, related_contact_id, created_at",
      )
      .in("id", calIds);
    const eventsById = new Map<string, Record<string, unknown>>();
    for (const e of (events ?? []) as Array<Record<string, unknown>>) {
      eventsById.set(e.id as string, e);
    }

    // Fallback de gravação para atividades reais já existentes.
    for (const row of baseRows) {
      const cid = strField(externalIds(row), "calendar_event_id");
      if (!cid) continue;
      const ev = eventsById.get(cid);
      const evRec = ev ? ((ev.recording_url as string | null) ?? null) : null;
      if (!evRec) continue;
      const r = row as unknown as {
        recording_url?: string | null;
        attachments?: Record<string, unknown> | null;
        external_ids?: Record<string, unknown> | null;
      };
      const atts = { ...((r.attachments ?? {}) as Record<string, unknown>) };
      const ex = { ...((r.external_ids ?? {}) as Record<string, unknown>) };
      if (!atts.recording_url) atts.recording_url = evRec;
      if (!ex.recording_url) ex.recording_url = evRec;
      r.attachments = atts;
      r.external_ids = ex;
      if (!r.recording_url) r.recording_url = evRec;
    }

    return Array.from(eventsById.values())
      .filter((e) => !existingCalIds.has(e.id as string))
      .map((e) => {
        const atts = calendarAttendees(e.attendees);
        return {
          id: `cal_${e.id as string}`,
          type: "meeting",
          subject: (e.title as string) ?? "Reunião (Google Calendar)",
          body: (e.description as string) ?? "",
          due_date: (e.start_at as string) ?? null,
          created_at: (e.start_at as string) ?? (e.created_at as string),
          hs_createdate: (e.start_at as string) ?? (e.created_at as string),
          meeting_location: (e.location as string) ?? (e.hangout_link as string) ?? null,
          external_ids: {
            source: "google_calendar",
            calendar_event_id: e.id,
            gcal_html_link: e.html_link ?? null,
            recording_url: e.recording_url ?? null,
          },
          attachments: {
            end_at: e.end_at ?? null,
            meet_link: e.hangout_link ?? null,
            calendar_html_link: e.html_link ?? null,
            recording_url: e.recording_url ?? null,
            attendees: atts
              .filter((a) => a.email)
              .map((a) => ({ email: a.email, name: a.displayName })),
          },
          completed: false,
          owner_id: null,
          [relatedKey]: relatedId,
        } as unknown as Activity;
      });
  } catch (e) {
    console.error("[timeline] mirrored events load", e);
    return [];
  }
}

async function loadHistory(
  relatedKey: RelatedKey,
  relatedId: string,
  range: { start?: Date; end?: Date },
): Promise<PropertyChangeRow[]> {
  const entityName = HISTORY_ENTITY[relatedKey];
  if (!entityName) return [];
  let hq = supabase
    .from("property_history")
    .select("id, entity, entity_id, property, old_value, new_value, changed_at, changed_by")
    .eq("entity", entityName)
    .eq("entity_id", relatedId)
    .order("changed_at", { ascending: false })
    .limit(300);
  if (range.start) hq = hq.gte("changed_at", range.start.toISOString());
  if (range.end) hq = hq.lt("changed_at", range.end.toISOString());
  const { data, error } = await hq;
  if (error) console.error("[timeline] history load", error);
  return (data ?? []) as PropertyChangeRow[];
}

export async function fetchTimelineData({
  relatedKey,
  relatedId,
  datePreset,
  dateCustom,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
  datePreset: DatePreset;
  dateCustom: CustomRange;
}): Promise<TimelineData> {
  const { data, error } = await supabase.from("activities").select("*").eq(relatedKey, relatedId);

  const { rows: baseRows, emailMeta } = await enrichEmails(((data as Activity[]) ?? []).slice());
  const range = getDateRange(datePreset, new Date(), dateCustom);
  const calendarVirtuals = await loadCalendarVirtuals(baseRows, relatedKey, relatedId, range);

  const inRange = (iso: string | null | undefined) => {
    if (!iso) return !range.start && !range.end;
    const t = new Date(iso).getTime();
    if (range.start && t < range.start.getTime()) return false;
    if (range.end && t >= range.end.getTime()) return false;
    return true;
  };
  const filteredBase =
    datePreset === "any"
      ? baseRows
      : baseRows.filter((row) => inRange(row.hs_createdate ?? row.created_at));

  const items = [...filteredBase, ...calendarVirtuals].sort((a, b) => {
    const ta = new Date(a.hs_createdate ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.hs_createdate ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });

  const historyRows = await loadHistory(relatedKey, relatedId, range);
  return { items, emailMeta, historyRows, error: error?.message };
}
