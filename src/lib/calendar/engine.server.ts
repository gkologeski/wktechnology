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
  sync_enabled: boolean;
  last_synced_at: string | null;
};

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

function pickRecordingFromAttachments(
  attachments: GCalEvent["attachments"],
): { file_id: string; url: string; mime_type: string } | null {
  if (!attachments) return null;
  // Meet drops the recording as a video/mp4 attachment whose title ends with "- Recording"
  const rec = attachments.find(
    (a) =>
      a.fileId &&
      (a.mimeType === "video/mp4" || /recording/i.test(a.title ?? "")),
  );
  if (!rec?.fileId) return null;
  return {
    file_id: rec.fileId,
    url: rec.fileUrl ?? `https://drive.google.com/file/d/${rec.fileId}/view`,
    mime_type: rec.mimeType ?? "video/mp4",
  };
}

// Free email domains that should never be used to auto-link a contact
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "outlook.com.br", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "uol.com.br", "bol.com.br", "terra.com.br",
]);

async function matchContactForAttendees(
  ownerId: string,
  attendees: GCalEvent["attendees"],
): Promise<string | null> {
  if (!attendees || attendees.length === 0) return null;
  const emails = attendees
    .filter((a) => a.email && !a.organizer && !a.self)
    .map((a) => a.email.toLowerCase());
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
): Promise<{ id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string }[]> {
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
  if (!res.ok) return [];
  const json = (await res.json()) as { files?: { id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string }[] };
  return json.files ?? [];
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
  ev: { title: string | null; end_at: string | null; start_at?: string | null },
): Promise<{ file_id: string; url: string; mime_type: string } | null> {
  if (!ev.end_at) return null;
  const endMs = new Date(ev.end_at).getTime();
  if (!Number.isFinite(endMs)) return null;
  // Meet typically uploads the recording within minutes; allow a wide window
  // (1h before end → 7 days after) to catch delayed uploads and shared copies.
  const after = new Date(endMs - 1 * 3600_000).toISOString();
  const before = new Date(endMs + 7 * 86400_000).toISOString();
  const baseTime = `createdTime > '${after}' and createdTime < '${before}' and trashed = false`;
  const videoMime = "(mimeType='video/mp4' or mimeType contains 'video/')";

  const rawTitle = (ev.title ?? "").trim();
  const titleFragment = rawTitle.slice(0, 40).replace(/'/g, "\\'");

  const candidates: { id: string; name: string; mimeType: string; webViewLink?: string; createdTime?: string }[] = [];

  // 1) Title match within the time window (most precise)
  if (titleFragment) {
    candidates.push(...(await driveSearch(token, `name contains '${titleFragment}' and ${videoMime} and ${baseTime}`)));
  }
  // 2) Any video shared with me in the time window (covers shared-from-organizer)
  if (candidates.length === 0) {
    candidates.push(...(await driveSearch(token, `${videoMime} and sharedWithMe = true and ${baseTime}`)));
  }
  // 3) Any video in the user's drives in the time window (organizer case)
  if (candidates.length === 0) {
    candidates.push(...(await driveSearch(token, `${videoMime} and ${baseTime}`)));
  }

  if (candidates.length === 0) return null;
  // Prefer the closest createdTime to the event end
  candidates.sort((a, b) => {
    const da = Math.abs(new Date(a.createdTime ?? 0).getTime() - endMs);
    const db = Math.abs(new Date(b.createdTime ?? 0).getTime() - endMs);
    return da - db;
  });
  const file = candidates[0];
  return {
    file_id: file.id,
    url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    mime_type: file.mimeType,
  };
}

async function syncPastRecordings(account: CalendarAccountRow): Promise<{ found: number }> {
  const token = await ensureAccessToken(account);
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const until = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("calendar_events")
    .select("id, title, end_at, conference_id")
    .eq("owner_id", account.owner_id)
    .eq("calendar_account_id", account.id)
    .not("conference_id", "is", null)
    .is("recording_drive_file_id", null)
    .gte("end_at", since)
    .lte("end_at", until)
    .limit(20);
  let found = 0;
  for (const ev of events ?? []) {
    try {
      const rec = await findDriveRecording(token, { title: ev.title, end_at: ev.end_at });
      if (rec) {
        await supabaseAdmin
          .from("calendar_events")
          .update({
            recording_drive_file_id: rec.file_id,
            recording_url: rec.url,
            recording_mime_type: rec.mime_type,
            recording_synced_at: new Date().toISOString(),
            recording_status: "available",
          })
          .eq("id", ev.id);
        found++;
      } else {
        await supabaseAdmin
          .from("calendar_events")
          .update({ recording_synced_at: new Date().toISOString(), recording_status: "not_found" })
          .eq("id", ev.id);
      }
    } catch (e) {
      console.error("[drive recording] error", e);
    }
  }
  return { found };
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
): Promise<{ imported: number; deleted: number }> {
  const token = await ensureAccessToken(account);
  const calId = encodeURIComponent(account.primary_calendar_id || "primary");
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let imported = 0;
  let deleted = 0;
  const usingSyncToken = !!account.sync_token;

  do {
    const params = new URLSearchParams();
    if (account.sync_token) {
      params.set("syncToken", account.sync_token);
    } else {
      // initial: last 30 days + next 365 days
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
      // 410 GONE → sync token invalid, do a full re-sync
      if (msg.includes("410") && usingSyncToken) {
        await supabaseAdmin
          .from("calendar_accounts")
          .update({ sync_token: null })
          .eq("id", account.id);
        return { imported, deleted };
      }
      throw e;
    }

    const items = json.items ?? [];
    for (const ev of items) {
      if (ev.status === "cancelled") {
        const { error: delErr } = await supabaseAdmin
          .from("calendar_events")
          .delete()
          .eq("calendar_account_id", account.id)
          .eq("provider_event_id", ev.id);
        if (!delErr) deleted++;
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
      const relatedContactId = await matchContactForAttendees(account.owner_id, ev.attendees);
      const upsertRow: Record<string, unknown> = {
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
      };
      const { error: upErr } = await supabaseAdmin
        .from("calendar_events")
        .upsert(upsertRow as never, { onConflict: "calendar_account_id,provider_event_id" });
      if (!upErr) imported++;
    }

    pageToken = json.nextPageToken;
    if (!pageToken && json.nextSyncToken) nextSyncToken = json.nextSyncToken;
  } while (pageToken);

  await supabaseAdmin
    .from("calendar_accounts")
    .update({
      sync_token: nextSyncToken ?? account.sync_token,
      last_synced_at: new Date().toISOString(),
      last_status: "ok",
      last_error: null,
    })
    .eq("id", account.id);

  return { imported, deleted };
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
      if (existingEventId) {
        await gcalFetch(
          token,
          `/calendars/${calId}/events/${encodeURIComponent(existingEventId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        );
        updated++;
      } else {
        const ev = (await gcalFetch(token, `/calendars/${calId}/events`, {
          method: "POST",
          body: JSON.stringify(body),
        })) as { id: string };
        await supabaseAdmin
          .from("activities")
          .update({ external_ids: { ...ext, [`gcal_${account.id}`]: ev.id } })
          .eq("id", a.id);
        created++;
      }
    } catch (e) {
      console.error("[calendar push] error", e);
    }
  }
  return { created, updated };
}

export async function syncCalendarAccount(
  accountId: string,
): Promise<{ imported: number; deleted: number; pushed_created: number; pushed_updated: number }> {
  const { data: account, error } = await supabaseAdmin
    .from("calendar_accounts")
    .select(
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_enabled, last_synced_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (error || !account) throw new Error(error?.message || "Conta não encontrada");
  if (!account.sync_enabled)
    return { imported: 0, deleted: 0, pushed_created: 0, pushed_updated: 0 };
  if (account.provider !== "google") {
    // Microsoft not yet wired
    return { imported: 0, deleted: 0, pushed_created: 0, pushed_updated: 0 };
  }
  try {
    const pull = await pullGoogleEvents(account as CalendarAccountRow);
    const push = await pushPendingMeetings(account as CalendarAccountRow);
    // Best-effort: fetch recent Meet recordings from Drive (silently skips if no drive scope)
    try {
      await syncPastRecordings(account as CalendarAccountRow);
    } catch (e) {
      console.error("[recordings] sync error", e);
    }
    return {
      imported: pull.imported,
      deleted: pull.deleted,
      pushed_created: push.created,
      pushed_updated: push.updated,
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
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_enabled, last_synced_at, auto_create_meet_link",
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
