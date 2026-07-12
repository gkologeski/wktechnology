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

async function matchContactForAttendees(
  ownerId: string,
  attendees: GCalEvent["attendees"],
  accountEmail?: string | null,
): Promise<string | null> {
  if (!attendees || attendees.length === 0) return null;
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
    return { id: primaryDeal.id as string, company_id: (primaryDeal.company_id as string | null) ?? null };
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

async function ensureActivityForCalendarEvent(event: {
  id: string;
  owner_id: string;
  workspace_id: string;
  provider_event_id: string | null;
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

  const startMs = new Date(event.start_at).getTime();
  const endMs = event.end_at ? new Date(event.end_at).getTime() : startMs + 60 * 60_000;
  if (!Number.isFinite(startMs)) return { activityId: null, created: false };
  const from = new Date(startMs - 2 * 3600_000).toISOString();
  const until = new Date((Number.isFinite(endMs) ? endMs : startMs) + 2 * 3600_000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from("activities")
    .select("id, due_date, created_at, external_ids")
    .eq("workspace_id", event.workspace_id)
    .eq("type", "meeting")
    .eq("related_deal_id", deal.id)
    .eq("related_contact_id", event.related_contact_id)
    .order("created_at", { ascending: false })
    .limit(25);

  const matchingActivity =
    (existing ?? []).find((activity) => {
      const ext = (activity.external_ids ?? {}) as Record<string, unknown>;
      return ext.calendar_event_id === event.id || ext.provider_event_id === event.provider_event_id;
    }) ??
    (existing ?? []).find((activity) => {
      const referenceIso = (activity.due_date as string | null) ?? (activity.created_at as string | null);
      if (!referenceIso) return false;
      const referenceMs = new Date(referenceIso).getTime();
      return Number.isFinite(referenceMs) && referenceMs >= new Date(from).getTime() && referenceMs <= new Date(until).getTime();
    });

  if (matchingActivity?.id) {
    const ext = (matchingActivity.external_ids ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("activities")
      .update({
        external_ids: {
          ...ext,
          source: ext.source ?? "google_calendar",
          calendar_event_id: event.id,
          provider_event_id: event.provider_event_id,
          gcal_html_link: event.html_link,
          meet_link: event.hangout_link,
        },
      } as never)
      .eq("id", matchingActivity.id);
    return { activityId: matchingActivity.id as string, created: false };
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
      completed: false,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
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
      "id, owner_id, workspace_id, provider_event_id, title, description, location, start_at, end_at, html_link, hangout_link, related_contact_id",
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

async function driveSearch(
  token: string,
  q: string,
): Promise<{
  files: {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    createdTime?: string;
    owners?: { emailAddress?: string }[];
  }[];
  error?: string;
}> {
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,webViewLink,createdTime,owners(emailAddress))",
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
  const json = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      mimeType: string;
      webViewLink?: string;
      createdTime?: string;
      owners?: { emailAddress?: string }[];
    }[];
  };
  return { files: json.files ?? [] };
}

// Extract fuzzy title tokens (length ≥ 4, alphanumeric, no stopwords) so we can
// match Meet recordings whose filename dropped the meet code but preserved the
// event title (e.g. "WK Technology <> LUMINA-NORA (2026-07-07 ...).mp4").
const TITLE_STOPWORDS = new Set([
  "meet",
  "meeting",
  "reuniao",
  "reunião",
  "call",
  "com",
  "with",
  "and",
  "the",
  "para",
  "recording",
  "gravacao",
  "gravação",
  "google",
  "hangouts",
  "microsoft",
  "teams",
  "zoom",
  "tecnologia",
  "ltda",
]);
function extractTitleTokens(title: string | null | undefined): string[] {
  if (!title) return [];
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4 && !TITLE_STOPWORDS.has(t)),
    ),
  );
}

async function findRecordingFileConflict(
  fileId: string,
  eventId: string | null | undefined,
  conferenceId: string,
): Promise<{ id: string; title: string | null; conference_id: string | null } | null> {
  let query = supabaseAdmin
    .from("calendar_events")
    .select("id, title, conference_id")
    .eq("recording_drive_file_id", fileId)
    .not("conference_id", "is", null)
    .limit(5);

  if (eventId) query = query.neq("id", eventId);

  const { data, error } = await query;
  if (error) {
    console.warn("[drive recording] falha ao verificar conflito de arquivo", {
      file_id: fileId,
      event_id: eventId,
      error: error.message,
    });
    return null;
  }

  return (
    data?.find((row) => {
      const otherConferenceId = (row.conference_id ?? "").trim().toLowerCase();
      return otherConferenceId.length > 0 && otherConferenceId !== conferenceId;
    }) ?? null
  );
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
  ev: {
    id?: string | null;
    title: string | null;
    end_at: string | null;
    start_at?: string | null;
    conference_id?: string | null;
    organizer_email?: string | null;
  },
): Promise<
  | {
      ok: true;
      file_id: string;
      url: string;
      mime_type: string;
      matched_by: string;
    }
  | { ok: false; reason: string }
> {
  if (!ev.end_at) return { ok: false, reason: "evento sem horário de término" };
  const endMs = new Date(ev.end_at).getTime();
  if (!Number.isFinite(endMs)) return { ok: false, reason: "horário de término inválido" };
  const startMs = ev.start_at ? new Date(ev.start_at).getTime() : NaN;
  const baseMs = Number.isFinite(startMs) ? startMs : endMs;
  const after = new Date(baseMs - 2 * 3600_000).toISOString();
  // Meet publica a gravação em minutos/horas. A janela parte do início da reunião
  // para cobrir arquivos criados durante/ao final do Meet sem voltar ao range amplo
  // de dias, que já causou vínculos cruzados.
  const before = new Date(baseMs + 8 * 3600_000).toISOString();
  const baseTime = `createdTime > '${after}' and createdTime < '${before}' and trashed = false`;
  const videoMime = "(mimeType='video/mp4' or mimeType contains 'video/')";

  const rawTitle = (ev.title ?? "").trim();
  const titleFragment = rawTitle.slice(0, 40).replace(/'/g, "\\'");
  const conferenceId = (ev.conference_id ?? "").trim().toLowerCase();
  const organizerEmail = (ev.organizer_email ?? "").trim().toLowerCase();
  const titleTokens = extractTitleTokens(rawTitle);
  const meetCodeRe = /[a-z]{3}-[a-z]{4}-[a-z]{3}/g;

  type DriveFile = {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    createdTime?: string;
    owners?: { emailAddress?: string }[];
  };
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
  strategies.push({
    label: "compartilhado comigo",
    q: `${videoMime} and sharedWithMe = true and ${baseTime}`,
  });
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

  // Fase 2: se nenhuma estratégia trouxe candidatos, tenta uma busca ampla
  // por proprietário (organizador) + janela de tempo, para casos em que o
  // arquivo do Meet foi renomeado e não contém mais o código nem o título.
  if (candidates.length === 0 && organizerEmail) {
    const broad = await driveSearch(
      token,
      `${videoMime} and '${organizerEmail.replace(/'/g, "\\'")}' in owners and ${baseTime}`,
    );
    if (!broad.error && broad.files.length > 0) {
      candidates = broad.files;
      matchedBy = "organizador (fallback amplo)";
    } else if (broad.error) {
      errors.push(`organizador amplo: ${broad.error}`);
    }
  }

  // Filtro em cascata quando temos código do Meet:
  //  1) strict: arquivos com o código do Meet no nome.
  //  2) dual-signal: proprietário == organizador E nome contém algum token
  //     significativo do título, sem código de outro Meet.
  //  3) permissivo: nome sem código de outro Meet E contém ≥2 tokens do título
  //     (independe de propriedade — cobre gravações reenviadas/renomeadas).
  if (conferenceId && candidates.length > 0) {
    const withoutOtherMeetCode = (name: string) => {
      const codes = (name.match(meetCodeRe) ?? []).filter((c) => c !== conferenceId);
      return codes.length === 0;
    };
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const strict = candidates.filter((f) => {
      const name = (f.name ?? "").toLowerCase();
      const codes = name.match(meetCodeRe);
      return codes ? codes.includes(conferenceId) : false;
    });
    if (strict.length > 0) {
      candidates = strict;
      matchedBy = matchedBy || "meet code";
    } else {
      const dual = (organizerEmail && titleTokens.length > 0)
        ? candidates.filter((f) => {
            const ownedByOrganizer = (f.owners ?? []).some(
              (o) => (o.emailAddress ?? "").toLowerCase() === organizerEmail,
            );
            if (!ownedByOrganizer) return false;
            const normName = normalize(f.name ?? "");
            if (!withoutOtherMeetCode(normName)) return false;
            return titleTokens.some((tok) => normName.includes(tok));
          })
        : [];
      if (dual.length > 0) {
        candidates = dual;
        matchedBy = "dual-signal (organizador + título)";
      } else if (titleTokens.length >= 2) {
        const permissive = candidates.filter((f) => {
          const normName = normalize(f.name ?? "");
          if (!withoutOtherMeetCode(normName)) return false;
          const hits = titleTokens.filter((tok) => normName.includes(tok)).length;
          return hits >= 2;
        });
        if (permissive.length === 0) {
          return {
            ok: false,
            reason: `nenhuma gravação com o código do Meet '${conferenceId}', do organizador ou com múltiplos tokens do título na janela de busca`,
          };
        }
        candidates = permissive;
        matchedBy = "permissivo (título ≥2 tokens)";
      } else {
        return {
          ok: false,
          reason: `nenhuma gravação com o código do Meet '${conferenceId}' na janela de busca`,
        };
      }
    }
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

  const conflictReasons: string[] = [];
  for (const file of candidates) {
    if (conferenceId) {
      const conflict = await findRecordingFileConflict(file.id, ev.id, conferenceId);
      if (conflict) {
        conflictReasons.push(
          `${file.id} já vinculado ao evento ${conflict.id} (${conflict.conference_id ?? "sem código"})`,
        );
        continue;
      }
    }

    return {
      ok: true,
      file_id: file.id,
      url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      mime_type: file.mimeType,
      matched_by: matchedBy,
    };
  }

  return {
    ok: false,
    reason: conflictReasons.length
      ? `gravação rejeitada por vínculo cruzado: ${conflictReasons.join(" | ")}`
      : "nenhuma gravação segura correspondente no Drive",
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
    .select("id, title, start_at, end_at, conference_id, recording_attempts")
    .eq("owner_id", account.owner_id)
    .eq("calendar_account_id", account.id)
    .not("conference_id", "is", null)
    .is("recording_drive_file_id", null)
    .or(
      `recording_attempts.lt.${RECORDING_MAX_AUTO_ATTEMPTS},recording_status.eq.cross_link_blocked,and(recording_status.eq.not_found,recording_last_error.ilike.%código do Meet%)`,
    )
    .gte("end_at", since)
    .lte("end_at", until)
    .limit(20);
  let found = 0;
  let missing = 0;
  let errors = 0;
  for (const ev of events ?? []) {
    const attempts = ((ev as { recording_attempts?: number }).recording_attempts ?? 0) + 1;
    try {
      const rec = await findDriveRecording(token, {
        id: ev.id as string,
        title: ev.title,
        start_at: (ev as { start_at?: string | null }).start_at ?? null,
        end_at: ev.end_at,
        conference_id: ev.conference_id as string | null,
        organizer_email: account.email,
      });
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
      "id, owner_id, provider, email, primary_calendar_id, access_token, refresh_token, expires_at, sync_token, sync_page_token, sync_enabled, last_synced_at",
    )
    .eq("id", ev.calendar_account_id as string)
    .maybeSingle();
  if (!acct) throw new Error("Conta de calendário não encontrada");
  const token = await ensureAccessToken(acct as CalendarAccountRow);
  const attempts = ((ev.recording_attempts as number | null) ?? 0) + 1;
  const rec = await findDriveRecording(token, {
    id: ev.id as string,
    title: ev.title as string | null,
    start_at: ev.start_at as string | null,
    end_at: ev.end_at as string | null,
    conference_id: ev.conference_id as string | null,
    organizer_email: (acct as CalendarAccountRow).email,
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
