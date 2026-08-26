// Server-only booking availability + creation engine.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

type WindowSpec = { start: string; end: string }; // "HH:MM" UTC-naive (interpreted in page tz)
type Availability = Partial<Record<WeekdayKey, WindowSpec[]>>;

export type BookingPageRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  calendar_account_id: string | null;
  availability: Availability;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  active: boolean;
  target: "lead" | "contact";
  color: string;
  location: string | null;
  workspace_id: string | null;
};

export type Slot = { start: string; end: string };

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 24 || mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

// Builds a UTC Date for a given Y-M-D + HH:MM in a given IANA timezone.
function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Approach: build naive UTC then compute tz offset for that instant
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const tzOffsetMs = getTimezoneOffsetMs(timeZone, new Date(naive));
  return new Date(naive - tzOffsetMs);
}

// Returns the offset in ms between the given timezone and UTC at the supplied instant.
// Positive when local time is ahead of UTC.
function getTimezoneOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour === "24" ? "0" : parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10),
  );
  return asUTC - at.getTime();
}

function weekdayInTz(at: Date, timeZone: string): WeekdayKey {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(at)
    .toLowerCase();
  if (wd.startsWith("sun")) return "sun";
  if (wd.startsWith("mon")) return "mon";
  if (wd.startsWith("tue")) return "tue";
  if (wd.startsWith("wed")) return "wed";
  if (wd.startsWith("thu")) return "thu";
  if (wd.startsWith("fri")) return "fri";
  return "sat";
}

function ymdInTz(at: Date, timeZone: string): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return { y: parseInt(parts.year, 10), m: parseInt(parts.month, 10), d: parseInt(parts.day, 10) };
}

export async function getBookingPageBySlug(slug: string): Promise<BookingPageRow | null> {
  const { data } = await supabaseAdmin
    .from("booking_pages")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as BookingPageRow | null) ?? null;
}

export async function computeAvailableSlots(
  page: BookingPageRow,
  fromIso: string,
  toIso: string,
): Promise<Slot[]> {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const now = new Date();
  const minStart = new Date(now.getTime() + page.min_notice_hours * 3600_000);
  const maxEnd = new Date(now.getTime() + page.max_advance_days * 86400_000);
  const windowStart = from > minStart ? from : minStart;
  const windowEnd = to < maxEnd ? to : maxEnd;
  if (windowStart >= windowEnd) return [];

  // Load busy ranges: existing bookings + mirrored calendar events
  const [{ data: bookings }, { data: events }] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("start_at,end_at,status")
      .eq("owner_id", page.owner_id)
      .eq("status", "confirmed")
      .gte("end_at", windowStart.toISOString())
      .lte("start_at", windowEnd.toISOString()),
    page.calendar_account_id
      ? supabaseAdmin
          .from("calendar_events")
          .select("start_at,end_at")
          .eq("calendar_account_id", page.calendar_account_id)
          .gte("end_at", windowStart.toISOString())
          .lte("start_at", windowEnd.toISOString())
      : Promise.resolve({ data: [] as { start_at: string; end_at: string }[] }),
  ]);

  type Range = { s: number; e: number };
  const busy: Range[] = [
    ...(bookings ?? []).map((b) => ({
      s: new Date(b.start_at).getTime(),
      e: new Date(b.end_at).getTime(),
    })),
    ...((events ?? []) as { start_at: string | null; end_at: string | null }[])
      .filter((e) => e.start_at && e.end_at)
      .map((e) => ({
        s: new Date(e.start_at as string).getTime(),
        e: new Date(e.end_at as string).getTime(),
      })),
  ].filter((r) => Number.isFinite(r.s) && Number.isFinite(r.e) && r.e > r.s);

  const dur = page.duration_minutes * 60_000;
  const bufB = page.buffer_before_minutes * 60_000;
  const bufA = page.buffer_after_minutes * 60_000;
  const stepMin = 15; // slot granularity
  const tz = page.timezone || "UTC";

  const slots: Slot[] = [];
  // Iterate day-by-day in tz
  const cursor = new Date(windowStart.getTime());
  // Walk one local-day at a time
  for (let i = 0; i < 366; i++) {
    if (cursor >= windowEnd) break;
    const { y, m, d } = ymdInTz(cursor, tz);
    const dayKey = weekdayInTz(cursor, tz);
    const windows = page.availability?.[dayKey] ?? [];
    for (const w of windows) {
      const ws = parseHHMM(w.start);
      const we = parseHHMM(w.end);
      if (!ws || !we) continue;
      const startBoundary = zonedDateToUtc(y, m, d, ws.h, ws.m, tz);
      const endBoundary = zonedDateToUtc(y, m, d, we.h, we.m, tz);
      // Step from startBoundary by stepMin until startBoundary + step <= endBoundary - duration
      const step = stepMin * 60_000;
      let t = Math.ceil(Math.max(startBoundary.getTime(), windowStart.getTime()) / step) * step;
      const lastStart = Math.min(endBoundary.getTime() - dur, windowEnd.getTime() - dur);
      while (t <= lastStart) {
        const slotS = t;
        const slotE = t + dur;
        const conflicts = busy.some((b) => !(slotE + bufA <= b.s || slotS - bufB >= b.e));
        if (!conflicts)
          slots.push({ start: new Date(slotS).toISOString(), end: new Date(slotE).toISOString() });
        t += step;
      }
    }
    // Advance to next day in tz: add 24h (DST safe-ish for 15-min granularity)
    cursor.setTime(cursor.getTime() + 86400_000);
  }
  return slots;
}

type GoogleSyncResult = {
  eventId: string | null;
  meetLink: string | null;
  error: string | null;
};

async function pushBookingToGoogle(
  page: BookingPageRow,
  booking: {
    start_at: string;
    end_at: string;
    invitee_name: string;
    invitee_email: string;
    notes: string | null;
  },
): Promise<GoogleSyncResult> {
  const fail = (error: string): GoogleSyncResult => {
    console.error(`[booking] Google Agenda: ${error}`);
    return { eventId: null, meetLink: null, error };
  };
  if (!page.calendar_account_id) {
    return {
      eventId: null,
      meetLink: null,
      error: "Página de agendamento sem conta de calendário vinculada",
    };
  }
  const { data: account } = await supabaseAdmin
    .from("calendar_accounts")
    .select("id, provider, primary_calendar_id, access_token, refresh_token, expires_at, owner_id")
    .eq("id", page.calendar_account_id)
    .maybeSingle();
  if (!account) return fail("Conta de calendário não encontrada");
  if (account.provider !== "google") return fail("Conta de calendário não é Google");

  // Refresh if needed
  let token = account.access_token as string | null;
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!token || Date.now() >= exp - 30_000) {
    const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
    if (!clientId || !clientSecret) return fail("Credenciais do Google não configuradas");
    if (!account.refresh_token) return fail("Conta Google sem refresh token — reconecte a conta");
    const res = await fetch("https://oauth2.googleapis.com/token", {
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
      return fail(`Falha ao renovar token do Google [${res.status}]: ${await res.text()}`);
    }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    token = j.access_token;
    await supabaseAdmin
      .from("calendar_accounts")
      .update({
        access_token: token,
        expires_at: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString(),
      })
      .eq("id", account.id);
  }

  const calId = encodeURIComponent(account.primary_calendar_id || "primary");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?sendUpdates=all&conferenceDataVersion=1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${page.title} — ${booking.invitee_name}`,
        description: [
          booking.notes,
          `Booking via ${page.title}`,
          `Convidado: ${booking.invitee_name} <${booking.invitee_email}>`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        location: page.location || undefined,
        start: { dateTime: booking.start_at },
        end: { dateTime: booking.end_at },
        attendees: [{ email: booking.invitee_email, displayName: booking.invitee_name }],
        // Solicita uma sala do Google Meet para o evento.
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );
  if (!res.ok) {
    return fail(`Google Agenda recusou o evento [${res.status}]: ${await res.text()}`);
  }
  const j = (await res.json()) as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };
  const meetLink =
    j.hangoutLink ??
    j.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  return {
    eventId: j.id ?? null,
    meetLink,
    error: meetLink ? null : "Evento criado, mas o Google não retornou link do Meet",
  };
}

export async function createPublicBooking(input: {
  slug: string;
  start: string;
  invitee_name: string;
  invitee_email: string;
  invitee_phone?: string | null;
  notes?: string | null;
  timezone?: string | null;
}): Promise<{ id: string; meet_link: string | null }> {
  const page = await getBookingPageBySlug(input.slug);
  if (!page) throw new Error("Página de agendamento não encontrada");
  const startMs = new Date(input.start).getTime();
  if (!Number.isFinite(startMs)) throw new Error("Horário inválido");
  const endMs = startMs + page.duration_minutes * 60_000;
  const start_at = new Date(startMs).toISOString();
  const end_at = new Date(endMs).toISOString();

  // Validate slot still available (single-shot recompute, cheap)
  const slots = await computeAvailableSlots(page, start_at, new Date(endMs + 60_000).toISOString());
  if (!slots.some((s) => s.start === start_at)) {
    throw new Error("Esse horário não está mais disponível");
  }

  // Find/create contact or lead by email
  let leadId: string | null = null;
  let contactId: string | null = null;
  const syncNotes: string[] = [];
  if (page.target === "contact") {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("owner_id", page.owner_id)
      .eq("email", input.invitee_email)
      .maybeSingle();
    if (existing) contactId = existing.id;
    else {
      const [first, ...rest] = (input.invitee_name || "").trim().split(/\s+/);
      const { data: created, error: contactError } = await supabaseAdmin
        .from("contacts")
        .insert({
          owner_id: page.owner_id,
          workspace_id: page.workspace_id ?? undefined,
          first_name: first || input.invitee_email,
          last_name: rest.join(" ") || null,
          email: input.invitee_email,
          phone: input.invitee_phone ?? null,
        })
        .select("id")
        .single();
      if (contactError) {
        console.error(`[booking] falha ao criar contato: ${contactError.message}`);
        syncNotes.push(`Contato não criado: ${contactError.message}`);
      }
      contactId = created?.id ?? null;
    }
  } else {
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("owner_id", page.owner_id)
      .eq("email", input.invitee_email)
      .maybeSingle();
    if (existing) leadId = existing.id;
    else {
      const [first, ...rest] = (input.invitee_name || "").trim().split(/\s+/);
      const { data: created, error: leadError } = await supabaseAdmin
        .from("leads")
        .insert({
          owner_id: page.owner_id,
          workspace_id: page.workspace_id ?? undefined,
          first_name: first || input.invitee_email,
          last_name: rest.join(" ") || null,
          email: input.invitee_email,
          phone: input.invitee_phone ?? null,
          source: "booking",
          status: "new",
        })
        .select("id")
        .single();
      if (leadError) {
        console.error(`[booking] falha ao criar lead: ${leadError.message}`);
        syncNotes.push(`Lead não criado: ${leadError.message}`);
      }
      leadId = created?.id ?? null;
      // Garante empresa e contato vinculados ao lead
      if (leadId) await ensureLeadRelationsSafe(supabaseAdmin, leadId);
    }
  }

  // Push to Google Calendar (best effort, mas com erro registrado)
  const gcal = await pushBookingToGoogle(page, {
    start_at,
    end_at,
    invitee_name: input.invitee_name,
    invitee_email: input.invitee_email,
    notes: input.notes ?? null,
  });
  if (gcal.error) syncNotes.push(gcal.error);

  // Create activity (meeting) so it shows up everywhere
  const { data: activity, error: activityError } = await supabaseAdmin
    .from("activities")
    .insert({
      owner_id: page.owner_id,
      type: "meeting",
      subject: `${page.title} — ${input.invitee_name}`,
      body: input.notes ?? null,
      due_date: start_at,
      meeting_location: page.location || gcal.meetLink || null,
      related_contact_id: contactId,
      related_lead_id: leadId,
      external_ids:
        page.calendar_account_id && gcal.eventId
          ? { [`gcal_${page.calendar_account_id}`]: gcal.eventId }
          : {},
    })
    .select("id")
    .single();
  if (activityError) {
    console.error(`[booking] falha ao criar atividade: ${activityError.message}`);
    syncNotes.push(`Atividade não criada: ${activityError.message}`);
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      page_id: page.id,
      owner_id: page.owner_id,
      start_at,
      end_at,
      invitee_name: input.invitee_name,
      invitee_email: input.invitee_email,
      invitee_phone: input.invitee_phone ?? null,
      notes: input.notes ?? null,
      status: "confirmed",
      gcal_event_id: gcal.eventId,
      meet_link: gcal.meetLink,
      calendar_sync_error: syncNotes.length ? syncNotes.join(" | ") : null,
      lead_id: leadId,
      contact_id: contactId,
      activity_id: activity?.id ?? null,
      timezone: input.timezone ?? page.timezone,
    })
    .select("id")
    .single();
  if (error || !booking) throw new Error(error?.message || "Falha ao criar reserva");
  return { id: booking.id, meet_link: gcal.meetLink };
}
