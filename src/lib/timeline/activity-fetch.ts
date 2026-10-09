// Carregamento paginado da linha do tempo.
//
// Três origens paginadas no servidor, todas sob RLS do usuário (RPCs
// SECURITY INVOKER) e com filtros aplicados antes da paginação:
//   - atividades            → get_timeline_activity_page
//   - reuniões do calendário → get_timeline_calendar_page (dedup com atividades antes de paginar)
//   - grupos de histórico   → get_timeline_history_page (grupos indivisíveis)
// A intercalação k-way em `feed-merge.ts` produz páginas de 40 itens em ordem
// global (data efetiva DESC, origem, id DESC) sem cortes fixos.
//
// E-mails: a página traz apenas o resumo (remetente, destinatários, datas,
// contadores). Corpo, anexos e rastreamento são buscados por
// `fetchEmailDetail` quando o item fica visível.
import { supabase } from "@/integrations/supabase/client";
import type { Activity } from "@/lib/db-types";
import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";
import {
  finalizeHistoryGroup,
  type HistoryGroup,
  type PropertyChangeRow,
} from "@/lib/timeline/history-groups";
import {
  calendarAttendees,
  type EmailMeta,
  type RelatedKey,
} from "@/components/activity/timeline-shared";
import { UNASSIGNED, type TimelineCategory, type TimelineFilters } from "@/lib/timeline/timeline-filters";
import { takeMerged, feedHasMore, type FeedSourceState } from "@/lib/timeline/feed-merge";

export type TimelineCursor = { at: string; id: string };

export const TIMELINE_PAGE_SIZE = 40;

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

const ACTIVITY_CATEGORIES: TimelineCategory[] = [
  "call",
  "email",
  "whatsapp",
  "message",
  "note",
  "task",
  "meeting",
  "survey",
];
const HISTORY_CATEGORIES: TimelineCategory[] = ["stage", "substatus", "owner", "fields"];

const RANK = { activity: 0, calendar: 1, history: 2 } as const;

const externalIds = (row: unknown) =>
  ((row as { external_ids?: Record<string, unknown> } | null)?.external_ids ?? {}) as Record<
    string,
    unknown
  >;

const strField = (obj: Record<string, unknown>, key: string) =>
  typeof obj[key] === "string" ? (obj[key] as string) : null;

type PagePayload<T> = {
  items?: T[];
  total?: number;
  counts?: Record<string, number>;
  has_more?: boolean;
  next_at?: string | null;
  next_id?: string | null;
};

export type FeedItem = {
  at: number;
  rank: number;
  id: string;
  activity?: Activity;
  history?: HistoryGroup;
};

export type TimelineFeedSession = {
  sources: FeedSourceState<FeedItem>[];
  totals: { activity: number; calendar: number; history: number };
  counts: Map<TimelineCategory, number>;
};

export type TimelinePage = {
  activities: Activity[];
  historyGroups: HistoryGroup[];
  emailMeta: Map<string, EmailMeta>;
  hasMore: boolean;
  totalCount: number;
  categoryCounts: Map<TimelineCategory, number>;
};

/** Cria um fetcher paginado com cursor próprio. */
function pagedSource<T>(
  call: (cursor: TimelineCursor | null) => Promise<PagePayload<T>>,
  toItem: (row: T) => FeedItem,
  onFirst: (payload: PagePayload<T>) => void,
): FeedSourceState<FeedItem> {
  let cursor: TimelineCursor | null = null;
  let first = true;
  return {
    buffer: [],
    hasMore: true,
    fetchNext: async () => {
      const payload = await call(cursor);
      if (first) {
        onFirst(payload);
        first = false;
      }
      cursor =
        payload.next_at && payload.next_id ? { at: payload.next_at, id: payload.next_id } : null;
      return {
        items: (payload.items ?? []).map(toItem),
        hasMore: Boolean(payload.has_more) && cursor !== null,
      };
    },
  };
}

async function rpcPage<T>(name: string, args: Record<string, unknown>): Promise<PagePayload<T>> {
  // Nomes de RPC tipados no cliente gerado; o payload jsonb é validado abaixo.
  const { data, error } = await supabase.rpc(name as "get_timeline_activity_page", args as never);
  if (error) throw new Error(error.message);
  return (data ?? {}) as unknown as PagePayload<T>;
}

type CalRow = {
  id: string;
  title: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  html_link: string | null;
  hangout_link: string | null;
  attendees: unknown;
  recording_url: string | null;
  created_at: string;
};

function calendarToActivity(e: CalRow, relatedKey: RelatedKey, relatedId: string): Activity {
  const atts = calendarAttendees(e.attendees);
  return {
    id: `cal_${e.id}`,
    type: "meeting",
    subject: e.title ?? "Reunião (Google Calendar)",
    body: e.description ?? "",
    due_date: e.start_at ?? null,
    created_at: e.start_at ?? e.created_at,
    hs_createdate: e.start_at ?? e.created_at,
    meeting_location: e.location ?? e.hangout_link ?? null,
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
      attendees: atts.filter((a) => a.email).map((a) => ({ email: a.email, name: a.displayName })),
    },
    completed: false,
    owner_id: null,
    [relatedKey]: relatedId,
  } as unknown as Activity;
}

const timeOf = (iso: string | null | undefined) => new Date(iso ?? 0).getTime();

export function createTimelineFeed({
  relatedKey,
  relatedId,
  datePreset,
  dateCustom,
  filters,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
  datePreset: DatePreset;
  dateCustom: CustomRange;
  filters: TimelineFilters;
}): TimelineFeedSession {
  const range = getDateRange(datePreset, new Date(), dateCustom);
  const since = range.start?.toISOString();
  const until = range.end?.toISOString();
  const search = filters.search.trim() || undefined;
  const selected =
    filters.tab === "all"
      ? filters.categories
      : filters.categories.includes(filters.tab)
        ? [filters.tab]
        : [];
  const activityCats = selected.filter((c) => ACTIVITY_CATEGORIES.includes(c));
  const historyCats = selected.filter((c) => HISTORY_CATEGORIES.includes(c));
  const assigneeIds = filters.assignees.filter((id) => id !== UNASSIGNED);
  const includeUnassigned = filters.assignees.includes(UNASSIGNED);
  const kind = ENTITY_KIND[relatedKey];
  const historyEntity = HISTORY_ENTITY[relatedKey];

  const session: TimelineFeedSession = {
    sources: [],
    totals: { activity: 0, calendar: 0, history: 0 },
    counts: new Map(),
  };
  const addCounts = (counts: Record<string, number> | undefined) => {
    for (const [k, v] of Object.entries(counts ?? {})) {
      const key = k as TimelineCategory;
      session.counts.set(key, (session.counts.get(key) ?? 0) + Number(v));
    }
  };

  if (activityCats.length) {
    session.sources.push(
      pagedSource<Activity>(
        (cursor) =>
          rpcPage("get_timeline_activity_page", {
            p_entity_kind: kind,
            p_entity_id: relatedId,
            p_since: since,
            p_until: until,
            p_categories: activityCats.length === ACTIVITY_CATEGORIES.length ? undefined : activityCats,
            p_assignees: assigneeIds.length ? assigneeIds : undefined,
            p_include_unassigned: includeUnassigned,
            p_search: search,
            p_cursor_at: cursor?.at,
            p_cursor_id: cursor?.id,
            p_page_size: TIMELINE_PAGE_SIZE,
          }),
        (a) => ({
          at: timeOf(a.hs_createdate ?? a.created_at),
          rank: RANK.activity,
          id: a.id,
          activity: a,
        }),
        (p) => {
          session.totals.activity = Number(p.total ?? 0);
          addCounts(p.counts);
        },
      ),
    );
  }

  // Reuniões do calendário não têm responsável na timeline; como antes, só
  // aparecem quando não há filtro de responsável.
  if (selected.includes("meeting") && filters.assignees.length === 0) {
    session.sources.push(
      pagedSource<CalRow>(
        (cursor) =>
          rpcPage("get_timeline_calendar_page", {
            p_entity_kind: kind,
            p_entity_id: relatedId,
            p_since: since,
            p_until: until,
            p_search: search,
            p_cursor_at: cursor?.at,
            p_cursor_id: cursor?.id,
            p_page_size: TIMELINE_PAGE_SIZE,
          }),
        (e) => {
          const activity = calendarToActivity(e, relatedKey, relatedId);
          return {
            at: timeOf(e.start_at ?? e.created_at),
            rank: RANK.calendar,
            id: e.id,
            activity,
          };
        },
        (p) => {
          const total = Number(p.total ?? 0);
          session.totals.calendar = total;
          if (total) session.counts.set("meeting", (session.counts.get("meeting") ?? 0) + total);
        },
      ),
    );
  }

  if (historyEntity && historyCats.length) {
    type HistRow = {
      id: string;
      changed_at: string;
      changed_by: string | null;
      changes: PropertyChangeRow[];
    };
    session.sources.push(
      pagedSource<HistRow>(
        (cursor) =>
          rpcPage("get_timeline_history_page", {
            p_entity: historyEntity,
            p_entity_id: relatedId,
            p_since: since,
            p_until: until,
            p_categories: historyCats.length === HISTORY_CATEGORIES.length ? undefined : historyCats,
            p_actors: assigneeIds.length ? assigneeIds : undefined,
            p_include_unassigned: includeUnassigned,
            p_search: search,
            p_cursor_at: cursor?.at,
            p_cursor_id: cursor?.id,
            p_page_size: TIMELINE_PAGE_SIZE,
          }),
        (g) => ({
          at: timeOf(g.changed_at),
          rank: RANK.history,
          id: g.id,
          history: finalizeHistoryGroup(g),
        }),
        (p) => {
          session.totals.history = Number(p.total ?? 0);
          addCounts(p.counts);
        },
      ),
    );
  }

  return session;
}

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
async function loadEmailSummaries(rows: Activity[]): Promise<Map<string, EmailMeta>> {
  const meta = new Map<string, EmailMeta>();
  const byMessage = new Map<string, string>();
  for (const row of rows) {
    if (row.type !== "email") continue;
    const mid = strField(externalIds(row), "email_message_id");
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

/** Completa atividades reais com a gravação do evento de calendário vinculado. */
async function applyCalendarRecordings(rows: Activity[]): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .filter((r) => !r.id.startsWith("cal_"))
        .map((r) => strField(externalIds(r), "calendar_event_id"))
        .filter(Boolean) as string[],
    ),
  ];
  if (!ids.length) return;
  const { data } = await supabase
    .from("calendar_events")
    .select("id, recording_url")
    .in("id", ids)
    .not("recording_url", "is", null);
  const rec = new Map(
    ((data ?? []) as Array<{ id: string; recording_url: string | null }>).map((e) => [
      e.id,
      e.recording_url,
    ]),
  );
  for (const row of rows) {
    const cid = strField(externalIds(row), "calendar_event_id");
    const url = cid ? rec.get(cid) : null;
    if (!url) continue;
    const r = row as unknown as {
      recording_url?: string | null;
      attachments?: Record<string, unknown> | null;
      external_ids?: Record<string, unknown> | null;
    };
    const atts = { ...(r.attachments ?? {}) };
    const ex = { ...(r.external_ids ?? {}) };
    if (!atts.recording_url) atts.recording_url = url;
    if (!ex.recording_url) ex.recording_url = url;
    r.attachments = atts;
    r.external_ids = ex;
    if (!r.recording_url) r.recording_url = url;
  }
}

/** Próxima página global de 40 itens a partir de uma sessão de feed. */
export async function nextTimelinePage(
  session: TimelineFeedSession,
  size = TIMELINE_PAGE_SIZE,
): Promise<TimelinePage> {
  const items = await takeMerged(session.sources, size, (i) => i);
  const activities = items.flatMap((i) => (i.activity ? [i.activity] : []));
  const historyGroups = items.flatMap((i) => (i.history ? [i.history] : []));
  const [emailMeta] = await Promise.all([
    loadEmailSummaries(activities),
    applyCalendarRecordings(activities),
  ]);
  return {
    activities,
    historyGroups,
    emailMeta,
    hasMore: feedHasMore(session.sources),
    totalCount: session.totals.activity + session.totals.calendar + session.totals.history,
    categoryCounts: new Map(session.counts),
  };
}

export type EmailDetail = Pick<
  EmailMeta,
  "body_html" | "body_text" | "attachments" | "last_opened_at" | "last_clicked_at" | "last_clicked_url"
>;

/** Corpo, anexos e último rastreamento de um e-mail (sob demanda, sob RLS). */
export async function fetchEmailDetail(messageId: string): Promise<EmailDetail> {
  const [{ data: m, error }, { data: events }] = await Promise.all([
    supabase
      .from("email_messages")
      .select("body_html, body_text, attachments")
      .eq("id", messageId)
      .maybeSingle(),
    supabase
      .from("email_tracking_events")
      .select("event_type, url, occurred_at")
      .eq("message_id", messageId)
      .in("event_type", ["open", "click"])
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);
  if (error) throw new Error(error.message);
  if (!m) throw new Error("E-mail indisponível ou sem permissão de acesso.");
  const evs = (events ?? []) as Array<{ event_type: string; url: string | null; occurred_at: string }>;
  const open = evs.find((e) => e.event_type === "open");
  const click = evs.find((e) => e.event_type === "click");
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
