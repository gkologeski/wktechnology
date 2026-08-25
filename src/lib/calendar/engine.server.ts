// Server-only Google Calendar sync engine.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

type CalendarAccountRow = {
  id: string;
  owner_id: string;
  provider: string;
  email: string;
  primary_calendar_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  sync_token: string | null;
  sync_page_token: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
};

// Limites por execução para não estourar CPU/subrequests do Cloudflare Worker.
const MAX_PAGES_PER_RUN = 6;

async function refreshAccessToken(account: CalendarAccountRow): Promise<string> {
  if (!account.refresh_token) throw new Error("Conta sem refresh_token — reconecte o calendário");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    await supabaseAdmin
      .from("calendar_accounts")
      .update({ last_status: "error", last_error: `refresh failed: ${res.status} ${t}` })
      .eq("id", account.id);
    throw new Error(`Falha ao renovar token: ${res.status}`);
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      access_token: j.access_token,
      expires_at: expiresAt,
      last_status: "connected",
      last_error: null,
    })
    .eq("id", account.id);
  return j.access_token;
}

async function ensureAccessToken(account: CalendarAccountRow): Promise<string> {
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!account.access_token || Date.now() >= exp - 30_000) return refreshAccessToken(account);
  return account.access_token;
}

type GCalEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  recurringEventId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }[];
  conferenceData?: {
    conferenceId?: string;
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
  attachments?: { fileUrl?: string; title?: string; mimeType?: string; fileId?: string }[];
};

// Recording lookup is done via Drive search (see findDriveRecording) so that
// it works for non-organizers too — Meet only attaches the recording file to
// the organizer's copy of the event, but shares the Drive file with attendees.

// Free email domains that should never be used to auto-link a contact
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
]);

const WK_INTERNAL_DOMAINS = new Set(["wktechnology.com.br", "wkconsultoria.com.br"]);

async function matchContactForAttendees(
  ownerId: string,
  attendees: GCalEvent["attendees"],
  accountEmail?: string | null,
): Promise<string | null> {
  if (!attendees || attendees.length === 0) return null;
  // A calendar event is only a WK↔client meeting when WK actually participates.
  // Require at least one attendee on a WK internal domain — otherwise we treat
  // it as a client-only internal event that just happens to invite our contact
  // and skip the linkage entirely (no time-window fallback).
  const hasWkAttendee = attendees.some((a) => {
    const d = a.email?.split("@")[1]?.toLowerCase();
    return d ? WK_INTERNAL_DOMAINS.has(d) : false;
  });
  if (!hasWkAttendee) return null;

  // Determine internal domain(s) only from the connected account and self=true
  // attendees. NOTE: we intentionally do NOT treat `organizer` as internal —
  // when the client (external) creates the invite, the organizer is external
  // and must remain eligible as the matched contact.
  const internalDomains = new Set<string>();
  const accountDomain = accountEmail?.split("@")[1]?.toLowerCase();
  if (accountDomain) internalDomains.add(accountDomain);
  for (const a of attendees) {
    if (a.self && a.email) {
      const d = a.email.split("@")[1]?.toLowerCase();
      if (d) internalDomains.add(d);
    }
  }

  const emails = attendees
    .filter((a) => a.email)
    .map((a) => a.email.toLowerCase())
    .filter((em) => {
      const d = em.split("@")[1] ?? "";
      return !internalDomains.has(d);
    });
  if (emails.length === 0) return null;
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id, email, created_at")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .in("email", emails)
    .order("created_at", { ascending: true })
    .limit(5);
  if (!data || data.length === 0) return null;
  // Prefer non-free-email-domain matches first
  const ranked = [...data].sort((a, b) => {
    const da = (a.email ?? "").split("@")[1]?.toLowerCase() ?? "";
    const db = (b.email ?? "").split("@")[1]?.toLowerCase() ?? "";
    const aFree = FREE_EMAIL_DOMAINS.has(da) ? 1 : 0;
    const bFree = FREE_EMAIL_DOMAINS.has(db) ? 1 : 0;
    return aFree - bFree;
  });
  return ranked[0]?.id ?? null;
}

/**
 * Re-run the contact matcher against calendar_events with related_contact_id NULL
 * for the given owner, covering events in a recent window. This closes the gap
 * where an event was synced BEFORE the corresponding contact was created — since
 * Google's incremental sync (syncToken) won't resend unchanged events, those
 * rows would otherwise stay unlinked forever.
 */
export async function reconcileCalendarContactMatches(
  ownerId: string,
  opts: { accountId?: string; sinceDays?: number; untilDays?: number } = {},
): Promise<{ scanned: number; linked: number }> {
  const sinceDays = opts.sinceDays ?? 90;
  const untilDays = opts.untilDays ?? 90;
  const now = Date.now();
  const since = new Date(now - sinceDays * 86400_000).toISOString();
  const until = new Date(now + untilDays * 86400_000).toISOString();

  let q = supabaseAdmin
    .from("calendar_events")
    .select("id, calendar_account_id, attendees, start_at")
    .eq("owner_id", ownerId)
    .is("related_contact_id", null)
    .gte("start_at", since)
    .lte("start_at", until)
    .limit(500);
  if (opts.accountId) q = q.eq("calendar_account_id", opts.accountId);
  const { data: rows, error } = await q;
  if (error || !rows) return { scanned: 0, linked: 0 };

  // Cache account email per calendar_account_id
  const accountEmailCache = new Map<string, string | null>();
  const getAccountEmail = async (accId: string | null): Promise<string | null> => {
    if (!accId) return null;
    if (accountEmailCache.has(accId)) return accountEmailCache.get(accId) ?? null;
    const { data } = await supabaseAdmin
      .from("calendar_accounts")
      .select("email")
      .eq("id", accId)
      .maybeSingle();
    const em = (data?.email as string | null) ?? null;
    accountEmailCache.set(accId, em);
    return em;
  };

  let linked = 0;
  for (const r of rows) {
    const attendees = (r.attendees ?? []) as GCalEvent["attendees"];
    const accEmail = await getAccountEmail(r.calendar_account_id as string | null);
    const contactId = await matchContactForAttendees(ownerId, attendees, accEmail);
    if (!contactId) continue;
    const { error: updErr } = await supabaseAdmin
      .from("calendar_events")
      .update({ related_contact_id: contactId })
      .eq("id", r.id);
    if (!updErr) linked++;
  }
  return { scanned: rows.length, linked };
}

type CalendarActivityLinkResult = { scanned: number; linked: number; created: number };

async function resolveDealForCalendarContact(
  workspaceId: string,
  contactId: string,
): Promise<{ id: string; company_id: string | null } | null> {
  const { data: primaryDeal } = await supabaseAdmin
    .from("deals")
    .select("id, company_id, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("primary_contact_id", contactId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (primaryDeal?.id) {
    return {
      id: primaryDeal.id as string,
      company_id: (primaryDeal.company_id as string | null) ?? null,
    };
  }

  const { data: dealLinks } = await supabaseAdmin
    .from("deal_contacts")
    .select("deal_id")
    .eq("contact_id", contactId)
    .limit(10);
  const dealIds = (dealLinks ?? []).map((row) => row.deal_id).filter(Boolean) as string[];
  if (dealIds.length === 0) return null;

  const { data: linkedDeal } = await supabaseAdmin
    .from("deals")
    .select("id, company_id, updated_at")
    .eq("workspace_id", workspaceId)
    .in("id", dealIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return linkedDeal?.id
    ? { id: linkedDeal.id as string, company_id: (linkedDeal.company_id as string | null) ?? null }
    : null;
}

function computeMeetingKey(input: {
  conference_id: string | null;
  provider_event_id: string | null;
  title: string | null;
}): string | null {
  const conf = (input.conference_id ?? "").trim().toLowerCase();
  if (conf) return `meet:${conf}`;
  const pev = (input.provider_event_id ?? "").trim();
  if (pev) {
    const base = pev.replace(/_\d{8}T\d{6}Z?$/, "");
    if (base) return `gcal:${base}`;
  }
  const title = (input.title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (title) return `title:${title}`;
  return null;
}

async function propagateRecordingToActivity(eventId: string, recordingUrl: string): Promise<void> {
  const { data: ev } = await supabaseAdmin
    .from("calendar_events")
    .select("related_activity_id")
    .eq("id", eventId)
    .maybeSingle();
  const activityId = (ev?.related_activity_id as string | null) ?? null;
  if (!activityId) return;

  const { data: act } = await supabaseAdmin
    .from("activities")
    .select("recording_url, attachments, external_ids")
    .eq("id", activityId)
    .maybeSingle();
  if (!act) return;

  const attachments = { ...((act.attachments ?? {}) as Record<string, unknown>) };
  const externalIds = { ...((act.external_ids ?? {}) as Record<string, unknown>) };
  const alreadySynced =
    act.recording_url === recordingUrl &&
    attachments.recording_url === recordingUrl &&
    externalIds.recording_url === recordingUrl;
  if (alreadySynced) return;

  attachments.recording_url = recordingUrl;
  externalIds.recording_url = recordingUrl;

  await supabaseAdmin
    .from("activities")
    .update({
      recording_url: recordingUrl,
      attachments,
      external_ids: externalIds,
    } as never)
    .eq("id", activityId);
}

async function ensureActivityForCalendarEvent(event: {
  id: string;
  owner_id: string;
  workspace_id: string;
  provider_event_id: string | null;
  conference_id: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  html_link: string | null;
  hangout_link: string | null;
  related_contact_id: string | null;
}): Promise<{ activityId: string | null; created: boolean }> {
  if (!event.workspace_id || !event.related_contact_id || !event.start_at) {
    return { activityId: null, created: false };
  }

  const deal = await resolveDealForCalendarContact(event.workspace_id, event.related_contact_id);
  if (!deal) return { activityId: null, created: false };

  const meetingKey = computeMeetingKey({
    conference_id: event.conference_id,
    provider_event_id: event.provider_event_id,
    title: event.title,
  });

  // Canonical match: single activity per (workspace_id, meeting_key) — no time windows.
  let matchingActivity: { id: string; external_ids: Record<string, unknown> | null } | null = null;

  if (meetingKey) {
    const { data: byKey } = await supabaseAdmin
      .from("activities")
      .select("id, external_ids")
      .eq("workspace_id", event.workspace_id)
      .eq("type", "meeting")
      .eq("meeting_key", meetingKey)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byKey?.id) {
      matchingActivity = {
        id: byKey.id as string,
        external_ids: (byKey.external_ids ?? null) as Record<string, unknown> | null,
      };
    }
  }

  // Fallback: legacy activities without meeting_key linked by calendar_event_id / provider_event_id.
  if (!matchingActivity) {
    const { data: legacy } = await supabaseAdmin
      .from("activities")
      .select("id, external_ids")
      .eq("workspace_id", event.workspace_id)
      .eq("type", "meeting")
      .eq("related_deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(25);
    const found = (legacy ?? []).find((activity) => {
      const ext = (activity.external_ids ?? {}) as Record<string, unknown>;
      return (
        ext.calendar_event_id === event.id || ext.provider_event_id === event.provider_event_id
      );
    });
    if (found?.id) {
      matchingActivity = {
        id: found.id as string,
        external_ids: (found.external_ids ?? null) as Record<string, unknown> | null,
      };
    }
  }

  if (matchingActivity?.id) {
    const ext = (matchingActivity.external_ids ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      external_ids: {
        ...ext,
        source: ext.source ?? "google_calendar",
        calendar_event_id: event.id,
        provider_event_id: event.provider_event_id,
        gcal_html_link: event.html_link,
        meet_link: event.hangout_link,
      },
    };
    if (meetingKey) patch.meeting_key = meetingKey;
    await supabaseAdmin
      .from("activities")
      .update(patch as never)
      .eq("id", matchingActivity.id);
    return { activityId: matchingActivity.id, created: false };
  }

  const externalIds = {
    source: "google_calendar",
    calendar_event_id: event.id,
    provider_event_id: event.provider_event_id,
    gcal_html_link: event.html_link,
    meet_link: event.hangout_link,
  };
  const attachments = {
    end_at: event.end_at,
    meet_link: event.hangout_link,
    calendar_html_link: event.html_link,
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("activities")
    .insert({
      owner_id: event.owner_id,
      workspace_id: event.workspace_id,
      type: "meeting",
      subject: event.title || "Reunião (Google Calendar)",
      body: event.description ?? null,
      due_date: event.start_at,
      meeting_location: event.location ?? event.hangout_link ?? null,
      related_contact_id: event.related_contact_id,
      related_deal_id: deal.id,
      related_company_id: deal.company_id,
      external_ids: externalIds,
      attachments,
      meeting_key: meetingKey,
      completed: false,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique-key race: another concurrent worker created the row. Fetch and reuse it.
    if (meetingKey && (error.code === "23505" || /duplicate key/i.test(error.message))) {
      const { data: raced } = await supabaseAdmin
        .from("activities")
        .select("id")
        .eq("workspace_id", event.workspace_id)
        .eq("type", "meeting")
        .eq("meeting_key", meetingKey)
        .maybeSingle();
      if (raced?.id) return { activityId: raced.id as string, created: false };
    }
    console.warn("[calendar activity link] falha ao criar activity", {
      event_id: event.id,
      error: error.message,
    });
    return { activityId: null, created: false };
  }

  return { activityId: (inserted?.id as string | null) ?? null, created: true };
}

export async function reconcileCalendarActivityLinks(
  ownerId: string,
  opts: { accountId?: string; sinceDays?: number; untilDays?: number } = {},
): Promise<CalendarActivityLinkResult> {
  const sinceDays = opts.sinceDays ?? 90;
  const untilDays = opts.untilDays ?? 90;
  const now = Date.now();
  const since = new Date(now - sinceDays * 86400_000).toISOString();
  const until = new Date(now + untilDays * 86400_000).toISOString();

  let query = supabaseAdmin
    .from("calendar_events")
    .select(
      "id, owner_id, workspace_id, provider_event_id, conference_id, title, description, location, start_at, end_at, html_link, hangout_link, related_contact_id",
    )
    .eq("owner_id", ownerId)
    .is("related_activity_id", null)
    .not("related_contact_id", "is", null)
    .gte("start_at", since)
    .lte("start_at", until)
    .order("start_at", { ascending: false })
    .limit(100);
  if (opts.accountId) query = query.eq("calendar_account_id", opts.accountId);

  const { data: events, error } = await query;
  if (error || !events) return { scanned: 0, linked: 0, created: 0 };

  let linked = 0;
  let created = 0;
  for (const event of events) {
    const result = await ensureActivityForCalendarEvent(event as never);
    if (!result.activityId) continue;
    const { error: updateError } = await supabaseAdmin
      .from("calendar_events")
      .update({ related_activity_id: result.activityId } as never)
      .eq("id", event.id);
    if (!updateError) {
      linked++;
      if (result.created) created++;
    }
  }

  return { scanned: events.length, linked, created };
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";

// (removido) driveSearch por evento — substituído por indexMeetRecordings
// (varredura paginada + cursor) + matchRecordingByCode (lookup O(1) no índice).

// ============================================================
// Meet recording index (meet_code -> Drive file)
// ============================================================
// Nova estratégia: em vez de buscar no Drive por evento (o que exigia janela
// de tempo e trazia falsos positivos com títulos parecidos), varremos o Drive
// UMA vez por conta e mantemos um índice reverso `meet_code -> drive_file_id`
// em `public.meet_recording_index`. O matcher por evento vira lookup O(1)
// pelo `conference_id`, sem janela.
//
// NÃO reintroduzir fallbacks por título, organizador ou "dual-signal": todos
// já causaram cross-links entre reuniões diferentes (ver deals NEXID, Samuel,
// Janderson). Apenas o meet-code (extraído por regex do nome do arquivo) é
// aceito como chave de vínculo.

const MEET_CODE_RE = /(?<![a-z0-9])([a-z]{3}-[a-z]{4}-[a-z]{3})(?![a-z0-9])/i;

function extractMeetCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const m = name.match(MEET_CODE_RE);
  return m ? m[1].toLowerCase() : null;
}

type DriveListPage = {
  files: {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    createdTime?: string;
    modifiedTime?: string;
  }[];
  nextPageToken?: string;
  error?: string;
};

async function driveListVideos(
  token: string,
  q: string,
  pageToken?: string,
): Promise<DriveListPage> {
  const params = new URLSearchParams({
    q,
    fields: "nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime)",
    pageSize: "200",
    orderBy: "modifiedTime desc",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    corpora: "allDrives",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { files: [], error: `drive ${res.status}: ${txt.slice(0, 200)}` };
  }
  const json = (await res.json()) as {
    files?: DriveListPage["files"];
    nextPageToken?: string;
  };
  return { files: json.files ?? [], nextPageToken: json.nextPageToken };
}

// Máximo de páginas por tick para evitar estourar subrequests do Worker.
const MEET_INDEX_MAX_PAGES = 4;

/**
 * Varre o Drive da conta em busca de vídeos com nome contendo um meet-code
 * (padrão xxx-xxxx-xxx). Faz upsert em `meet_recording_index` para cada
 * meet-code encontrado. Avança um cursor incremental (`meet_index_cursor`)
 * baseado em `modifiedTime` para não re-ler arquivos já vistos.
 */
export async function indexMeetRecordings(
  account: CalendarAccountRow & { meet_index_cursor?: string | null },
): Promise<{ scanned: number; upserted: number; pages: number; error?: string }> {
  const token = await ensureAccessToken(account);

  const cursor = account.meet_index_cursor ?? null;
  const clauses: string[] = ["mimeType contains 'video/'", "trashed = false"];
  if (cursor) clauses.push(`modifiedTime > '${cursor}'`);
  const q = clauses.join(" and ");

  let pageToken: string | undefined;
  let pages = 0;
  let scanned = 0;
  let upserted = 0;
  let latestModified: string | null = cursor;
  let lastError: string | undefined;

  do {
    const page = await driveListVideos(token, q, pageToken);
    if (page.error) {
      lastError = page.error;
      break;
    }
    pages += 1;
    for (const file of page.files) {
      scanned += 1;
      if (file.modifiedTime && (!latestModified || file.modifiedTime > latestModified)) {
        latestModified = file.modifiedTime;
      }
      const code = extractMeetCode(file.name);
      if (!code) continue;

      const url = file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;
      const { error: upErr } = await supabaseAdmin.from("meet_recording_index").upsert(
        {
          owner_id: account.owner_id,
          meet_code: code,
          drive_file_id: file.id,
          drive_url: url,
          mime_type: file.mimeType,
          file_name: file.name,
          file_created_at: file.createdTime ?? null,
          discovered_by: account.id,
        } as never,
        { onConflict: "owner_id,meet_code" },
      );
      if (upErr) {
        console.warn("[meet-index] upsert falhou", {
          code,
          file_id: file.id,
          error: upErr.message,
        });
      } else {
        upserted += 1;
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken && pages < MEET_INDEX_MAX_PAGES);

  if (latestModified && latestModified !== cursor) {
    await supabaseAdmin
      .from("calendar_accounts")
      .update({ meet_index_cursor: latestModified } as never)
      .eq("id", account.id);
  }

  return { scanned, upserted, pages, error: lastError };
}

/**
 * Lookup determinístico pelo meet-code do evento — O(1) no índice, sem janela
 * de tempo.
 */
async function matchRecordingByCode(
  ownerId: string,
  conferenceId: string | null | undefined,
): Promise<
  | {
      ok: true;
      file_id: string;
      url: string;
      mime_type: string | null;
      matched_by: string;
    }
  | { ok: false; reason: string }
> {
  const code = (conferenceId ?? "").trim().toLowerCase();
  if (!code) {
    return {
      ok: false,
      reason: "evento sem código do Meet — não é possível casar gravação com segurança",
    };
  }
  const { data, error } = await supabaseAdmin
    .from("meet_recording_index")
    .select("drive_file_id, drive_url, mime_type")
    .eq("owner_id", ownerId)
    .eq("meet_code", code)
    .maybeSingle();
  if (error) return { ok: false, reason: `índice indisponível: ${error.message}` };
  if (!data) return { ok: false, reason: "gravação ainda não indexada" };
  return {
    ok: true,
    file_id: data.drive_file_id as string,
    url: data.drive_url as string,
    mime_type: (data.mime_type as string | null) ?? "video/mp4",
    matched_by: "meet-code-index",
  };
}

// (removido) cap de tentativas — o lookup é O(1) contra o índice, então
// re-tentar em cada tick é barato e cobre o caso "MP4 publicado depois".

export async function syncPastRecordings(
  account: CalendarAccountRow & { meet_index_cursor?: string | null },
): Promise<{ scanned: number; found: number; missing: number; errors: number }> {
  try {
    await reconcileCalendarActivityLinks(account.owner_id, { accountId: account.id });
  } catch (e) {
    console.warn("reconcileCalendarActivityLinks failed before recordings sync", e);
  }
  // (a) Atualiza o índice reverso meet_code -> arquivo do Drive.
  try {
    const idx = await indexMeetRecordings(account);
    if (idx.error) {
      console.warn("[meet-index] varredura parcial", { account_id: account.id, error: idx.error });
    } else if (idx.upserted > 0) {
      console.log("[meet-index] atualizado", {
        account_id: account.id,
        scanned: idx.scanned,
        upserted: idx.upserted,
        pages: idx.pages,
      });
    }
  } catch (e) {
    console.warn("[meet-index] falha", {
      account_id: account.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // (b) Reprocessa eventos sem gravação — lookup determinístico O(1) no índice,
  // sem janela de tempo. Cobrimos 60 dias para pegar re-imports tardios.
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const until = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("id, title, start_at, end_at, conference_id, recording_attempts")
    .eq("owner_id", account.owner_id)
    .eq("calendar_account_id", account.id)
    .not("conference_id", "is", null)
    .is("recording_drive_file_id", null)
    .gte("end_at", since)
    .lte("end_at", until)
    .limit(50);
  let found = 0;
  let missing = 0;
  let errors = 0;
  for (const ev of events ?? []) {
    const attempts = ((ev as { recording_attempts?: number }).recording_attempts ?? 0) + 1;
    try {
      const rec = await matchRecordingByCode(account.owner_id, ev.conference_id as string | null);
      if (rec.ok) {
        const { error: upErr } = await supabaseAdmin
          .from("calendar_events")
          .update({
            recording_drive_file_id: rec.file_id,
            recording_url: rec.url,
            recording_mime_type: rec.mime_type,
            recording_synced_at: new Date().toISOString(),
            recording_status: "available",
            recording_last_error: null,
            recording_attempts: attempts,
            recording_matched_by: rec.matched_by,
          } as never)
          .eq("id", ev.id);
        if (upErr) {
          errors++;
          console.error("[drive recording] vínculo falhou", {
            event_id: ev.id,
            error: upErr.message,
          });
        } else {
          found++;
          console.log("[drive recording] vinculada", {
            event_id: ev.id,
            file_id: rec.file_id,
            matched_by: rec.matched_by,
          });
          try {
            await propagateRecordingToActivity(ev.id as string, rec.url);
          } catch (propErr) {
            console.warn("[drive recording] propagação para activity falhou", {
              event_id: ev.id,
              error: propErr instanceof Error ? propErr.message : String(propErr),
            });
          }
        }
      } else {
        missing++;
        console.warn("[drive recording] não encontrada", {
          event_id: ev.id,
          title: ev.title,
          reason: rec.reason,
        });
        await supabaseAdmin
          .from("calendar_events")
          .update({
            recording_synced_at: new Date().toISOString(),
            recording_status: "not_found",
            recording_last_error: rec.reason.slice(0, 500),
            recording_attempts: attempts,
          } as never)
          .eq("id", ev.id);
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[drive recording] erro", { event_id: ev.id, error: msg });
      await supabaseAdmin
        .from("calendar_events")
        .update({
          recording_synced_at: new Date().toISOString(),
          recording_status: "error",
          recording_last_error: msg.slice(0, 500),
          recording_attempts: attempts,
        } as never)
        .eq("id", ev.id);
    }
  }
  return { scanned: events?.length ?? 0, found, missing, errors };
}

async function gcalFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function pullGoogleEvents(
  account: CalendarAccountRow,
): Promise<{ imported: number; deleted: number; partial: boolean }> {
  const token = await ensureAccessToken(account);
  const calId = encodeURIComponent(account.primary_calendar_id || "primary");
  // Retoma do ponto onde parou na execução anterior, se houver.
  let pageToken: string | undefined = account.sync_page_token ?? undefined;
  let nextSyncToken: string | undefined;
  let imported = 0;
  let deleted = 0;
  let pagesProcessed = 0;
  let partial = false;
  const usingSyncToken = !!account.sync_token;

  do {
    const params = new URLSearchParams();
    if (account.sync_token && !pageToken) {
      params.set("syncToken", account.sync_token);
    } else if (!pageToken) {
      // initial: a partir dos últimos 30 dias, sem limite superior
      const past = new Date(Date.now() - 30 * 86400000).toISOString();
      params.set("timeMin", past);
      params.set("singleEvents", "true");
      params.set("showDeleted", "true");
    }
    if (pageToken) params.set("pageToken", pageToken);
    params.set("maxResults", "250");

    let json: { items?: GCalEvent[]; nextPageToken?: string; nextSyncToken?: string };
    try {
      json = (await gcalFetch(
        token,
        `/calendars/${calId}/events?${params.toString()}`,
      )) as typeof json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 410 GONE → sync token invalido, faz full re-sync
      if (msg.includes("410") && usingSyncToken) {
        await supabaseAdmin
          .from("calendar_accounts")
          .update({ sync_token: null, sync_page_token: null })
          .eq("id", account.id);
        return { imported, deleted, partial: false };
      }
      throw e;
    }

    const items = json.items ?? [];
    const cancelledIds: string[] = [];
    const upsertRows: Record<string, unknown>[] = [];

    for (const ev of items) {
      if (ev.status === "cancelled") {
        cancelledIds.push(ev.id);
        continue;
      }
      const startAt = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
      const endAt = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null);
      const allDay = !!(ev.start?.date && !ev.start?.dateTime);
      const conferenceId = ev.conferenceData?.conferenceId ?? null;
      const hangoutLink =
        ev.hangoutLink ??
        ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
        null;
      const relatedContactId = await matchContactForAttendees(
        account.owner_id,
        ev.attendees,
        account.email,
      );
      upsertRows.push({
        owner_id: account.owner_id,
        calendar_account_id: account.id,
        provider_event_id: ev.id,
        title: ev.summary ?? "(sem título)",
        description: ev.description ?? null,
        location: ev.location ?? null,
        start_at: startAt,
        end_at: endAt,
        all_day: allDay,
        attendees: ev.attendees ?? [],
        html_link: ev.htmlLink ?? null,
        hangout_link: hangoutLink,
        conference_id: conferenceId,
        related_contact_id: relatedContactId,
        recurring_event_id: ev.recurringEventId ?? null,
        status: ev.status ?? "confirmed",
        last_synced_at: new Date().toISOString(),
      });
    }

    // Upsert em lote (1 subrequest por página, em vez de 250).
    if (upsertRows.length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from("calendar_events")
        .upsert(upsertRows as never, { onConflict: "calendar_account_id,provider_event_id" });
      if (!upErr) imported += upsertRows.length;
    }
    // Deleções em lote.
    if (cancelledIds.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("calendar_events")
        .delete()
        .eq("calendar_account_id", account.id)
        .in("provider_event_id", cancelledIds);
      if (!delErr) deleted += cancelledIds.length;
    }

    pageToken = json.nextPageToken;
    if (!pageToken && json.nextSyncToken) nextSyncToken = json.nextSyncToken;
    pagesProcessed++;

    // Persiste o ponto onde paramos para retomar na próxima execução.
    if (pageToken && pagesProcessed >= MAX_PAGES_PER_RUN) {
      await supabaseAdmin
        .from("calendar_accounts")
        .update({ sync_page_token: pageToken })
        .eq("id", account.id);
      partial = true;
      return { imported, deleted, partial };
    }
  } while (pageToken);

  // Acabou a paginação — limpa o page token e grava sync_token + last_synced_at.
  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      sync_token: nextSyncToken ?? account.sync_token,
      sync_page_token: null,
      last_synced_at: new Date().toISOString(),
      last_status: "ok",
      last_error: null,
    })
    .eq("id", account.id);

  return { imported, deleted, partial: false };
}

async function pushPendingMeetings(
  account: CalendarAccountRow,
): Promise<{ created: number; updated: number }> {
  const token = await ensureAccessToken(account);
  const calId = encodeURIComponent(account.primary_calendar_id || "primary");
  // Meetings: activities with type=meeting and due_date in the future
  const horizon = new Date(Date.now() + 90 * 86400000).toISOString();
  const { data: activities } = await supabaseAdmin
    .from("activities")
    .select("id, subject, body, due_date, meeting_location, external_ids, completed")
    .eq("owner_id", account.owner_id)
    .eq("type", "meeting")
    .not("due_date", "is", null)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true })
    .limit(100);

  let created = 0;
  const updated = 0;
  for (const a of activities ?? []) {
    const ext = (a.external_ids ?? {}) as Record<string, string>;
    const existingEventId = ext[`gcal_${account.id}`];
    // Skip activities already linked to a Google event — updates happen via
    // the explicit pushActivityToCalendar flow. Pushing every meeting on every
    // tick generates 100+ subrequests and trips the Worker limit.
    if (existingEventId) continue;
    const start = a.due_date as string;
    const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();
    const body = {
      summary: a.subject || "Reunião",
      description: a.body || "",
      location: a.meeting_location || "",
      start: { dateTime: start },
      end: { dateTime: end },
    };
    try {
      const ev = (await gcalFetch(token, `/calendars/${calId}/events`, {
        method: "POST",
        body: JSON.stringify(body),
      })) as { id: string };
      await supabaseAdmin
        .from("activities")
        .update({ external_ids: { ...ext, [`gcal_${account.id}`]: ev.id } })
        .eq("id", a.id);
      created++;
    } catch (e) {
      console.error("[calendar push] error", e);
    }
  }
  return { created, updated };
}

export async function syncCalendarAccount(accountId: string): Promise<{
  imported: number;
  deleted: number;
  pushed_created: number;
  pushed_updated: number;
  partial: boolean;
  recordings: { scanned: number; found: number; missing: number; errors: number };
}> {
  const { data: account, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error || !account) throw new Error(error?.message || "Conta não encontrada");
  const emptyRec = { scanned: 0, found: 0, missing: 0, errors: 0 };
  if (!account.sync_enabled)
    return {
      imported: 0,
      deleted: 0,
      pushed_created: 0,
      pushed_updated: 0,
      partial: false,
      recordings: emptyRec,
    };
  if (account.provider !== "google") {
    return {
      imported: 0,
      deleted: 0,
      pushed_created: 0,
      pushed_updated: 0,
      partial: false,
      recordings: emptyRec,
    };
  }
  try {
    const pull = await pullGoogleEvents(account as CalendarAccountRow);
    // syncPastRecordings é pesado (varre Drive) e estoura subrequest limit do Worker.
    // Mantido só no cron dedicado tickAllRecordings.
    const recordings = emptyRec;
    // Só faz o push quando a importação terminou — push é menos urgente que o catch-up.
    const push = pull.partial
      ? { created: 0, updated: 0 }
      : await pushPendingMeetings(account as CalendarAccountRow);
    // Reconcilia eventos antigos que ficaram sem contato vinculado (evento
    // sincronizado antes do contato existir). Roda só quando a paginação
    // terminou para não estourar subrequests do Worker.
    if (!pull.partial) {
      try {
        await reconcileCalendarContactMatches(account.owner_id, { accountId: account.id });
        await reconcileCalendarActivityLinks(account.owner_id, { accountId: account.id });
      } catch (e) {
        // reconciliação é best-effort; não deve falhar o sync
        console.warn("calendar reconciliation failed", e);
      }
    }

    return {
      imported: pull.imported,
      deleted: pull.deleted,
      pushed_created: push.created,
      pushed_updated: push.updated,
      partial: pull.partial,
      recordings,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("calendar_accounts")
      .update({ last_status: "error", last_error: msg.slice(0, 500) })
      .eq("id", accountId);
    throw e;
  }
}

export async function pushSingleActivity(
  accountId: string,
  activityId: string,
): Promise<{ created: boolean; updated: boolean; event_id: string; meet_link: string | null }> {
  const { data: account, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at, auto_create_meet_link",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error || !account) throw new Error(error?.message || "Conta não encontrada");
  if (account.provider !== "google") throw new Error("Provider não suportado");
  const { data: a, error: aErr } = await supabaseAdmin
    .from("activities")
    .select("id, subject, body, due_date, meeting_location, external_ids, attachments")
    .eq("id", activityId)
    .maybeSingle();
  if (aErr || !a) throw new Error(aErr?.message || "Atividade não encontrada");
  if (!a.due_date) throw new Error("Atividade sem data");

  const token = await ensureAccessToken(account as CalendarAccountRow);
  const calId = encodeURIComponent(account.primary_calendar_id || "primary");
  const ext = (a.external_ids ?? {}) as Record<string, string>;
  const existingEventId = ext[`gcal_${account.id}`];
  const start = a.due_date as string;
  const att = (a.attachments ?? {}) as { end_at?: string; attendees?: { email: string }[] };
  const end = att.end_at || new Date(new Date(start).getTime() + 30 * 60000).toISOString();
  const wantsMeet =
    !!(account as { auto_create_meet_link?: boolean }).auto_create_meet_link &&
    !/meet\.google\.com|zoom\.us|teams\.microsoft\.com/i.test(a.meeting_location || "");
  const body: Record<string, unknown> = {
    summary: a.subject || "Reunião",
    description: a.body || "",
    location: a.meeting_location || "",
    start: { dateTime: start },
    end: { dateTime: end },
    attendees: att.attendees ?? [],
  };
  if (wantsMeet && !existingEventId) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet-${a.id}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  const qs = wantsMeet ? "?conferenceDataVersion=1" : "";
  try {
    let eventId = existingEventId;
    let meetLink: string | null = null;
    if (existingEventId) {
      const ev = (await gcalFetch(
        token,
        `/calendars/${calId}/events/${encodeURIComponent(existingEventId)}${qs}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      )) as { id: string; hangoutLink?: string };
      meetLink = ev.hangoutLink ?? null;
      const newExt = { ...ext, [`gcal_${account.id}`]: ev.id };
      const updates: { external_ids: Record<string, string>; meeting_location?: string } = {
        external_ids: newExt,
      };
      if (meetLink && !a.meeting_location) updates.meeting_location = meetLink;
      await supabaseAdmin.from("activities").update(updates).eq("id", a.id);
      return { created: false, updated: true, event_id: ev.id, meet_link: meetLink };
    }
    const ev = (await gcalFetch(token, `/calendars/${calId}/events${qs}`, {
      method: "POST",
      body: JSON.stringify(body),
    })) as { id: string; hangoutLink?: string };
    eventId = ev.id;
    meetLink = ev.hangoutLink ?? null;
    const newExt = { ...ext, [`gcal_${account.id}`]: ev.id };
    const updates: { external_ids: Record<string, string>; meeting_location?: string } = {
      external_ids: newExt,
    };
    if (meetLink && !a.meeting_location) updates.meeting_location = meetLink;
    await supabaseAdmin.from("activities").update(updates).eq("id", a.id);
    return { created: true, updated: false, event_id: eventId, meet_link: meetLink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Falha ao enviar evento ao Google: ${msg.slice(0, 200)}`);
  }
}

export async function tickAllCalendars(): Promise<{ processed: number }> {
  const { data: accounts } = await supabaseAdmin
    .from("calendar_accounts")
    .select("id")
    .eq("sync_enabled", true)
    .limit(50);
  let processed = 0;
  for (const a of accounts ?? []) {
    try {
      await syncCalendarAccount(a.id);
      processed++;
    } catch (e) {
      console.error("[calendar tick] failed for", a.id, e);
    }
  }
  return { processed };
}

/**
 * Recording-only tick. Skips the heavy pullGoogleEvents/pushPendingMeetings
 * steps and only scans Drive for Meet recordings on events already in DB.
 * Keeps subrequest count low enough to fit Cloudflare Worker limits even
 * when the main calendar tick is overrunning.
 */
export async function tickAllRecordings(): Promise<{
  processed: number;
  totals: { scanned: number; found: number; missing: number; errors: number };
}> {
  const { data: accounts } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at, meet_index_cursor",
    )
    .eq("sync_enabled", true)
    .eq("provider", "google")
    .limit(50);
  let processed = 0;
  const totals = { scanned: 0, found: 0, missing: 0, errors: 0 };
  for (const a of accounts ?? []) {
    try {
      const r = await syncPastRecordings(a as CalendarAccountRow);
      totals.scanned += r.scanned;
      totals.found += r.found;
      totals.missing += r.missing;
      totals.errors += r.errors;
      processed++;
    } catch (e) {
      console.error("[recordings tick] failed for", a.id, e);
    }
  }
  return { processed, totals };
}

/**
 * Manually look up the Drive recording for a single calendar event.
 * Used by the timeline "Buscar gravação" button. Bypasses the auto-attempt
 * cap so users can force a retry, but still updates the same fields.
 */
export async function syncRecordingForEvent(
  eventId: string,
): Promise<
  | { ok: true; recording_url: string; recording_status: string }
  | { ok: false; reason: string; recording_status: string }
> {
  const { data: ev, error } = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, title, start_at, end_at, conference_id, calendar_account_id, recording_attempts, recording_drive_file_id, recording_url",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ev) throw new Error("Evento não encontrado");
  if (ev.recording_url) {
    return { ok: true, recording_url: ev.recording_url as string, recording_status: "available" };
  }
  if (!ev.conference_id) {
    return { ok: false, reason: "Evento sem Google Meet vinculado", recording_status: "not_found" };
  }
  const { data: acct } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at, meet_index_cursor",
    )
    .eq("id", ev.calendar_account_id as string)
    .maybeSingle();
  if (!acct) throw new Error("Conta de calendário não encontrada");
  const attempts = ((ev.recording_attempts as number | null) ?? 0) + 1;
  // Atualiza o índice antes do lookup para pegar gravações recém-publicadas.
  try {
    await indexMeetRecordings(acct as CalendarAccountRow & { meet_index_cursor?: string | null });
  } catch (e) {
    console.warn("[meet-index] refresh sob demanda falhou", {
      account_id: (acct as { id: string }).id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  const rec = await matchRecordingByCode(
    (acct as CalendarAccountRow).owner_id,
    ev.conference_id as string | null,
  );

  if (rec.ok) {
    await supabaseAdmin
      .from("calendar_events")
      .update({
        recording_drive_file_id: rec.file_id,
        recording_url: rec.url,
        recording_mime_type: rec.mime_type,
        recording_synced_at: new Date().toISOString(),
        recording_status: "available",
        recording_last_error: null,
        recording_attempts: attempts,
        recording_matched_by: rec.matched_by,
      } as never)
      .eq("id", eventId);
    try {
      await propagateRecordingToActivity(eventId, rec.url);
    } catch (propErr) {
      console.warn("[drive recording] propagação para activity falhou", {
        event_id: eventId,
        error: propErr instanceof Error ? propErr.message : String(propErr),
      });
    }
    return { ok: true, recording_url: rec.url, recording_status: "available" };
  }
  await supabaseAdmin
    .from("calendar_events")
    .update({
      recording_synced_at: new Date().toISOString(),
      recording_status: "not_found",
      recording_last_error: rec.reason.slice(0, 500),
      recording_attempts: attempts,
    } as never)
    .eq("id", eventId);
  return { ok: false, reason: rec.reason, recording_status: "not_found" };
}
