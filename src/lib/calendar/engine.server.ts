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
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string; organizer?: boolean; self?: boolean }[];
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
  "gmail.com", "hotmail.com", "outlook.com", "outlook.com.br", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "uol.com.br", "bol.com.br", "terra.com.br",
]);

async function matchContactForAttendees(
  ownerId: string,
  attendees: GCalEvent["attendees"],
  accountEmail?: string | null,
): Promise<string | null> {
  if (!attendees || attendees.length === 0) return null;
  // Determine internal domain(s) from self/organizer attendees — these are
  // colleagues and must NEVER be picked as the "external client" contact.
  const internalDomains = new Set<string>();
  const accountDomain = accountEmail?.split("@")[1]?.toLowerCase();
  if (accountDomain) internalDomains.add(accountDomain);
  for (const a of attendees) {
    if ((a.self || a.organizer) && a.email) {
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

const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function driveSearch(
  token: string,
  q: string,
): Promise<{
  files: { id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string }[];
  error?: string;
}> {
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,webViewLink,createdTime)",
    pageSize: "10",
    orderBy: "createdTime desc",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    corpora: "allDrives",
  });
  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { files: [], error: `drive ${res.status}: ${txt.slice(0, 200)}` };
  }
  const json = (await res.json()) as { files?: { id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string }[] };
  return { files: json.files ?? [] };
}

/**
 * Look up a Meet recording in Drive for the given event.
 * Meet stores recordings in the organizer's "Meet Recordings" folder and shares
 * them with attendees. We search across all drives the authenticated user can
 * see (own + shared) so non-organizers also find their recordings, then we
 * match on the event title and time window.
 */
async function findDriveRecording(
  token: string,
  ev: { title: string | null; end_at: string | null; start_at?: string | null; conference_id?: string | null },
): Promise<
  | { ok: true; file_id: string; url: string; mime_type: string; matched_by: string }
  | { ok: false; reason: string }
> {
  if (!ev.end_at) return { ok: false, reason: "evento sem horário de término" };
  const endMs = new Date(ev.end_at).getTime();
  if (!Number.isFinite(endMs)) return { ok: false, reason: "horário de término inválido" };
  const after = new Date(endMs - 1 * 3600_000).toISOString();
  // Meet publica a gravação em minutos/horas. Reduzir a janela de +7d para
  // +6h evita casar com gravação de outra reunião com título parecido.
  const before = new Date(endMs + 6 * 3600_000).toISOString();
  const baseTime = `createdTime > '${after}' and createdTime < '${before}' and trashed = false`;
  const videoMime = "(mimeType='video/mp4' or mimeType contains 'video/')";

  const rawTitle = (ev.title ?? "").trim();
  const titleFragment = rawTitle.slice(0, 40).replace(/'/g, "\\'");
  const conferenceId = (ev.conference_id ?? "").trim().toLowerCase();
  const meetCodeRe = /[a-z]{3}-[a-z]{4}-[a-z]{3}/g;

  type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string };
  const strategies: { label: string; q: string }[] = [];
  if (conferenceId) {
    // Meet nomeia o arquivo começando pelo código do Meet (ex.: "eim-xejq-etq (2026-07-06 ...).mp4").
    strategies.push({
      label: "meet code",
      q: `name contains '${conferenceId.replace(/'/g, "\\'")}' and ${videoMime} and ${baseTime}`,
    });
  }
  if (titleFragment) {
    strategies.push({
      label: "título",
      q: `name contains '${titleFragment}' and ${videoMime} and ${baseTime}`,
    });
  }
  strategies.push({ label: "compartilhado comigo", q: `${videoMime} and sharedWithMe = true and ${baseTime}` });
  strategies.push({ label: "meu drive", q: `${videoMime} and ${baseTime}` });

  const errors: string[] = [];
  let candidates: DriveFile[] = [];
  let matchedBy = "";
  for (const s of strategies) {
    const r = await driveSearch(token, s.q);
    if (r.error) {
      errors.push(`${s.label}: ${r.error}`);
      if (/^drive 40[13]/.test(r.error)) break;
      continue;
    }
    if (r.files.length > 0) {
      candidates = r.files;
      matchedBy = s.label;
      break;
    }
  }

  // Se sabemos o código do Meet, descartar candidatos cujo nome contenha um
  // código de Meet diferente — evita bater com gravação de outra reunião.
  if (conferenceId && candidates.length > 0) {
    const filtered = candidates.filter((f) => {
      const name = (f.name ?? "").toLowerCase();
      const codes = name.match(meetCodeRe);
      if (!codes || codes.length === 0) return true; // nome sem código: aceitar
      return codes.includes(conferenceId);
    });
    if (filtered.length === 0) {
      return { ok: false, reason: `nenhuma gravação com o código do Meet '${conferenceId}' na janela de busca` };
    }
    candidates = filtered;
  }

  if (candidates.length === 0) {
    const reason = errors.length
      ? `nenhuma gravação encontrada (${errors.join(" | ")})`
      : "nenhuma gravação correspondente no Drive na janela de busca";
    return { ok: false, reason };
  }
  candidates.sort((a, b) => {
    const da = Math.abs(new Date(a.createdTime ?? 0).getTime() - endMs);
    const db = Math.abs(new Date(b.createdTime ?? 0).getTime() - endMs);
    return da - db;
  });
  const file = candidates[0];
  return {
    ok: true,
    file_id: file.id,
    url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    mime_type: file.mimeType,
    matched_by: matchedBy,
  };
}


// Skip auto-retry after this many attempts (~1h of every-5-min cron). User
// can still force a lookup from the timeline button.
const RECORDING_MAX_AUTO_ATTEMPTS = 12;

export async function syncPastRecordings(
  account: CalendarAccountRow,
): Promise<{ scanned: number; found: number; missing: number; errors: number }> {
  const token = await ensureAccessToken(account);
  // Meet typically publishes the MP4 to Drive 10-30 min after the meeting
  // ends, so searching earlier wastes attempts. Look back 30 days to cover
  // re-imported / late-synced events.
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const until = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("id, title, end_at, conference_id, recording_attempts")
    .eq("owner_id", account.owner_id)
    .eq("calendar_account_id", account.id)
    .not("conference_id", "is", null)
    .is("recording_drive_file_id", null)
    .lt("recording_attempts", RECORDING_MAX_AUTO_ATTEMPTS)
    .gte("end_at", since)
    .lte("end_at", until)
    .limit(20);
  let found = 0;
  let missing = 0;
  let errors = 0;
  for (const ev of events ?? []) {
    const attempts = ((ev as { recording_attempts?: number }).recording_attempts ?? 0) + 1;
    try {
      const rec = await findDriveRecording(token, { title: ev.title, end_at: ev.end_at });
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
          } as never)
          .eq("id", ev.id);
        if (upErr) {
          errors++;
          console.error("[drive recording] vínculo falhou", { event_id: ev.id, error: upErr.message });
        } else {
          found++;
          console.log("[drive recording] vinculada", { event_id: ev.id, file_id: rec.file_id, matched_by: rec.matched_by });
        }
      } else {
        missing++;
        console.warn("[drive recording] não encontrada", { event_id: ev.id, title: ev.title, reason: rec.reason });
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
      const relatedContactId = await matchContactForAttendees(account.owner_id, ev.attendees, account.email);
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
  let updated = 0;
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


export async function syncCalendarAccount(
  accountId: string,
): Promise<{
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
    return { imported: 0, deleted: 0, pushed_created: 0, pushed_updated: 0, partial: false, recordings: emptyRec };
  if (account.provider !== "google") {
    return { imported: 0, deleted: 0, pushed_created: 0, pushed_updated: 0, partial: false, recordings: emptyRec };
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
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at",
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
export async function syncRecordingForEvent(eventId: string): Promise<
  | { ok: true; recording_url: string; recording_status: string }
  | { ok: false; reason: string; recording_status: string }
> {
  const { data: ev, error } = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, title, end_at, conference_id, calendar_account_id, recording_attempts, recording_drive_file_id, recording_url",
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
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at",
    )
    .eq("id", ev.calendar_account_id as string)
    .maybeSingle();
  if (!acct) throw new Error("Conta de calendário não encontrada");
  const token = await ensureAccessToken(acct as CalendarAccountRow);
  const attempts = ((ev.recording_attempts as number | null) ?? 0) + 1;
  const rec = await findDriveRecording(token, {
    title: ev.title as string | null,
    end_at: ev.end_at as string | null,
  });
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
      } as never)
      .eq("id", eventId);
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
