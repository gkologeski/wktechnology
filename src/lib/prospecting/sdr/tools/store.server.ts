import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { hubspotSourceClient } from "@/lib/access-control/hubspot-source-client.server";
// Implementação de produção: banco (cliente do worker, sempre filtrado pelo
// workspace da conversa) e Google Agenda real do anfitrião do agente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import type { Busy } from "./scheduling";
import type { ScheduleConfig } from "./catalog";
import type {
  CalendarProvider,
  CustomerCandidate,
  CustomerQuery,
  MeetingRow,
  ToolLog,
  ToolStore,
} from "./types";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";

const like = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
const MEETING_COLS =
  "id, conversation_id, calendar_account_id, status, start_at, end_at, provider_event_id, meet_link, idem_key";

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export function createDbToolStore(
  admin: Admin,
  ctx: {
    workspaceId: string;
    playbookId: string;
    agentVersionId: string | null;
    jobId: string | null;
    conversationId: string;
    enrollmentId: string | null;
  },
): ToolStore {
  const ws = ctx.workspaceId;
  const authorize = async (refs: Parameters<typeof assertSalesWorker>[3] = []) => {
    if (!ctx.enrollmentId) throw new Error("Ferramenta sem origem de atendimento autorizada.");
    await assertSalesWorker(admin, "sdr_enrollments", ctx.enrollmentId, [
      { table: "whatsapp_conversations", id: ctx.conversationId, action: "update" },
      ...(ctx.agentVersionId ? [{ agent_version_id: ctx.agentVersionId }] : []),
      ...refs,
    ]);
  };
  const crm = hubspotSourceClient(admin, { table: "sdr_enrollments", id: ctx.enrollmentId ?? "" });
  const store: ToolStore = {
    async getToolLog(k) {
      const row = must(
        await admin
          .from("sdr_tool_calls")
          .select("idem_key, tool, tool_call_id, input, output, status, error, duration_ms")
          .eq("idem_key", k)
          .eq("workspace_id", ws)
          .maybeSingle(),
      );
      return (row as ToolLog | null) ?? null;
    },
    async saveToolLog(l) {
      const { error } = await admin.from("sdr_tool_calls").insert({
        ...l,
        workspace_id: ws,
        playbook_id: ctx.playbookId,
        agent_version_id: ctx.agentVersionId,
        job_id: ctx.jobId,
        conversation_id: ctx.conversationId,
        enrollment_id: ctx.enrollmentId,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
    },
    async getOffers(c) {
      const rows = must(
        await admin
          .from("sdr_slot_offers")
          .select("offer_set, position, start_at, end_at, status")
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .order("offer_set", { ascending: false })
          .limit(10),
      ) as {
        offer_set: number;
        position: number;
        start_at: string;
        end_at: string;
        status: string;
      }[];
      if (!rows?.length) return null;
      const set = rows[0]!.offer_set;
      return {
        offerSet: set,
        slots: rows
          .filter((r) => r.offer_set === set)
          .map((r) => ({
            position: r.position,
            start: Date.parse(r.start_at),
            end: Date.parse(r.end_at),
            status: r.status,
          })),
      };
    },
    async saveOffers(c, slots, previous) {
      must(
        await admin
          .from("sdr_slot_offers")
          .update({ status: previous })
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .eq("status", "offered"),
      );
      const last = must(
        await admin
          .from("sdr_slot_offers")
          .select("offer_set")
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .order("offer_set", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ) as { offer_set: number } | null;
      const set = (last?.offer_set ?? 0) + 1;
      if (slots.length)
        must(
          await admin.from("sdr_slot_offers").insert(
            slots.map((s, i) => ({
              workspace_id: ws,
              conversation_id: c,
              playbook_id: ctx.playbookId,
              offer_set: set,
              position: i + 1,
              start_at: new Date(s.start).toISOString(),
              end_at: new Date(s.end).toISOString(),
            })),
          ),
        );
      return set;
    },
    async rejectedStarts(c) {
      const rows = must(
        await admin
          .from("sdr_slot_offers")
          .select("start_at")
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .eq("status", "rejected"),
      ) as { start_at: string }[];
      return (rows ?? []).map((r) => Date.parse(r.start_at));
    },
    async markOffer(c, set, pos, status) {
      must(
        await admin
          .from("sdr_slot_offers")
          .update({ status })
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .eq("offer_set", set)
          .eq("position", pos),
      );
    },
    async reserveMeeting(p) {
      await authorize([
        { table: "calendar_accounts", id: String(p.calendar_account_id), action: "manage" },
        { resource: "techsales.meetings", action: "create", subject_id: String(p.host_user_id) },
      ]);
      const data = must(
        await admin.rpc("sdr_reserve_meeting", { p: { ...p, workspace_id: ws } }),
      ) as { status: "reserved" | "exists" | "conflict"; id?: string; meeting_status?: string };
      return data;
    },
    async updateMeeting(id, patch) {
      await authorize();
      const existing = must(
        await admin
          .from("sdr_meetings")
          .select("conversation_id,calendar_account_id")
          .eq("id", id)
          .eq("workspace_id", ws)
          .single(),
      ) as { conversation_id: string; calendar_account_id: string };
      if (existing.conversation_id !== ctx.conversationId)
        throw new Error("Reunião de outra conversa.");
      await authorize([
        { table: "calendar_accounts", id: existing.calendar_account_id, action: "manage" },
      ]);
      must(
        await admin
          .from("sdr_meetings")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("workspace_id", ws),
      );
    },
    async getMeeting(id) {
      return must(
        await admin
          .from("sdr_meetings")
          .select(MEETING_COLS)
          .eq("id", id)
          .eq("workspace_id", ws)
          .eq("conversation_id", ctx.conversationId)
          .maybeSingle(),
      ) as MeetingRow | null;
    },
    async conversationMeetings(c) {
      if (c !== ctx.conversationId) throw new Error("Conversa de outra origem.");
      return (must(
        await admin
          .from("sdr_meetings")
          .select(MEETING_COLS)
          .eq("workspace_id", ws)
          .eq("conversation_id", c)
          .order("created_at", { ascending: false })
          .limit(20),
      ) ?? []) as MeetingRow[];
    },
    async activeMeetingsBusy(cal, from, to, excludeId) {
      await authorize([{ table: "calendar_accounts", id: cal, action: "manage" }]);
      const rows = must(
        await admin
          .from("sdr_meetings")
          .select("id, start_at, end_at")
          .eq("calendar_account_id", cal)
          .eq("workspace_id", ws)
          .in("status", ["pending", "reconcile", "confirmed"])
          .lt("start_at", new Date(to).toISOString())
          .gt("end_at", new Date(from).toISOString()),
      ) as { id: string; start_at: string; end_at: string }[];
      return (rows ?? [])
        .filter((r) => r.id !== excludeId)
        .map((r) => ({ start: Date.parse(r.start_at), end: Date.parse(r.end_at) }));
    },
    async findCustomers(q: CustomerQuery) {
      // Igualdade exata (sem curinga e sem OR entre termos), sempre no workspace.
      const out: CustomerCandidate[] = [];
      for (const kind of ["lead", "contact"] as const) {
        const table = kind === "lead" ? "leads" : "contacts";
        let query = crm
          .from(table)
          .select("id, first_name, last_name, email, phone, mobile_phone")
          .eq("workspace_id", ws)
          .limit(5);
        if (q.email) query = query.ilike("email", like(q.email));
        if (q.firstName) query = query.ilike("first_name", like(q.firstName));
        if (q.lastName) query = query.ilike("last_name", like(q.lastName));
        if (q.phoneVariants.length && !q.email && !q.firstName)
          query = query.in("phone", q.phoneVariants);
        const rows = (must(await query) ?? []) as {
          id: string;
          first_name: string;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
        }[];
        for (const r of rows) {
          const phones = [r.phone, r.mobile_phone]
            .filter(Boolean)
            .flatMap((p) => brPhoneVariants(`+${String(p).replace(/\D/g, "")}`));
          if (q.phoneVariants.length && !phones.some((p) => q.phoneVariants.includes(p))) continue;
          out.push({
            kind,
            id: r.id,
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            phones,
          });
        }
      }
      return out;
    },
    async crmContext(link) {
      const out: Record<string, unknown> = {};
      const personId = link.contactId ?? link.leadId;
      if (personId) {
        const person = must(
          await crm
            .from(link.contactId ? "contacts" : "leads")
            .select("job_title, cargo_resumido, area_atuacao, nivel_hierarquico")
            .eq("id", personId)
            .eq("workspace_id", ws)
            .maybeSingle(),
        );
        if (person) out.professional_profile = person;
      }
      if (link.dealId) {
        const d = must(
          await crm
            .from("deals")
            .select("name, stage")
            .eq("id", link.dealId)
            .eq("workspace_id", ws)
            .maybeSingle(),
        ) as { name: string; stage: string } | null;
        if (d) out.deal = { name: d.name, stage: d.stage };
      }
      if (link.companyId) {
        const c = must(
          await crm
            .from("companies")
            .select("name, size_description")
            .eq("id", link.companyId)
            .eq("workspace_id", ws)
            .maybeSingle(),
        ) as { name: string; size_description: string | null } | null;
        if (c) {
          out.company = c.name;
          out.size_description = c.size_description;
        }
      }
      const col = link.contactId ? "related_contact_id" : link.leadId ? "related_lead_id" : null;
      const val = link.contactId ?? link.leadId;
      if (col && val) {
        const acts = must(
          await crm
            .from("activities")
            .select("type, subject, created_at")
            .eq("workspace_id", ws)
            .eq(col, val)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(5),
        ) as { type: string; subject: string | null; created_at: string }[];
        out.recent_activities = (acts ?? []).map((a) => ({
          type: a.type,
          subject: a.subject,
          at: a.created_at.slice(0, 10),
        }));
      }
      return out;
    },
    async createActivity(a) {
      if (!a.owner_id) return null;
      await authorize([
        {
          resource:
            a.type === "note"
              ? "techsales.notes"
              : a.type === "task"
                ? "techsales.tasks"
                : "techsales.activities",
          action: "create",
          subject_id: String(a.owner_id),
        },
        ...[
          ["related_lead_id", "leads"],
          ["related_contact_id", "contacts"],
          ["related_company_id", "companies"],
          ["related_deal_id", "deals"],
        ].flatMap(([field, table]) => (a[field] ? [{ table, id: String(a[field]) }] : [])),
      ]);
      const row = must(
        await admin
          .from("activities")
          .insert({ ...a, workspace_id: ws })
          .select("id")
          .single(),
      ) as { id: string };
      return row.id;
    },
    async setEnrollment(eid, patch) {
      if (eid !== ctx.enrollmentId) throw new Error("Atendimento de outra origem.");
      must(await admin.from("sdr_enrollments").update(patch).eq("id", eid).eq("workspace_id", ws));
    },
    async enrollmentTags(eid) {
      const r = must(
        await admin
          .from("sdr_enrollments")
          .select("tags")
          .eq("id", eid)
          .eq("workspace_id", ws)
          .maybeSingle(),
      ) as { tags: string[] } | null;
      return r?.tags ?? [];
    },
    async searchKb(query) {
      const rows = must(
        await admin
          .from("kb_articles")
          .select("title, excerpt, slug, body")
          .eq("workspace_id", ws)
          .eq("published", true)
          .ilike("title", `%${like(query)}%`)
          .limit(5),
      ) as { title: string; excerpt: string | null; slug: string; body: string }[];
      return (rows ?? []).map((r) => ({
        title: r.title,
        slug: r.slug,
        excerpt: (r.excerpt || r.body || "").slice(0, 400),
      }));
    },
  };
  return new Proxy(store, {
    get(target, key: keyof ToolStore) {
      const method = target[key];
      return async (...args: unknown[]) => {
        // A denial may still be logged, but every business tool rechecks the persisted source.
        if (key !== "saveToolLog") await authorize();
        return (method as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

/** Prontidão da agenda do anfitrião: conta ativa, mesmo workspace, do próprio anfitrião, membro ativo. */
export async function checkHostCalendar(
  admin: Admin,
  workspaceId: string,
  s: ScheduleConfig | null,
): Promise<{ ok: boolean; reason?: string; provider?: string }> {
  if (!s) return { ok: false, reason: "Anfitrião e agenda não definidos no agente." };
  const { data: acc, error } = await admin
    .from("calendar_accounts")
    .select(
      "id, provider, owner_id, workspace_id, sync_enabled, last_status, scopes, refresh_token",
    )
    .eq("id", s.calendar_account_id)
    .maybeSingle();
  if (error) return { ok: false, reason: `Falha ao ler a agenda: ${error.message}` };
  if (!acc || acc.workspace_id !== workspaceId)
    return { ok: false, reason: "Agenda não pertence a esta empresa." };
  if (acc.owner_id !== s.host_user_id)
    return { ok: false, reason: "A agenda escolhida não é do anfitrião definido." };
  if (acc.provider !== "google")
    return {
      ok: false,
      reason: `Provedor ${acc.provider} sem suporte de consulta livre/ocupado neste ambiente.`,
    };
  if (!acc.refresh_token)
    return { ok: false, reason: "Agenda sem autorização ativa; o anfitrião precisa reconectar." };
  const scopes = (acc.scopes ?? []) as string[];
  if (!scopes.some((x) => x.endsWith("/auth/calendar") || x.endsWith("/auth/calendar.events")))
    return { ok: false, reason: "Agenda sem permissão de calendário." };
  if (acc.last_status === "error")
    return {
      ok: false,
      reason: "A agenda do anfitrião está com erro de sincronização; reconecte.",
    };
  const { data: mem } = await admin
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", s.host_user_id)
    .maybeSingle();
  if (!mem || (mem.status && mem.status !== "active"))
    return { ok: false, reason: "Anfitrião não é membro ativo da empresa." };
  return { ok: true, provider: acc.provider };
}

async function googleToken(admin: Admin, accountId: string, workspaceId: string): Promise<string> {
  const { data: acc, error } = await admin
    .from("calendar_accounts")
    .select("id, access_token, refresh_token, expires_at, workspace_id")
    .eq("id", accountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !acc) throw new Error("Agenda não encontrada");
  const exp = acc.expires_at ? Date.parse(acc.expires_at) : 0;
  if (acc.access_token && Date.now() < exp - 60000) return acc.access_token;
  const id = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const secret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!id || !secret || !acc.refresh_token) throw new Error("Credenciais do Google indisponíveis");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: acc.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Falha ao renovar acesso ao Google [${res.status}]`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  await admin
    .from("calendar_accounts")
    .update({
      access_token: j.access_token,
      expires_at: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString(),
    })
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);
  return j.access_token;
}

/** Google Agenda real: freeBusy, events.insert (id determinístico), get, patch, delete. */
export function createGoogleCalendar(
  admin: Admin,
  workspaceId: string,
  s: ScheduleConfig,
  calendarId: string,
  enrollmentId: string,
  agentVersionId?: string | null,
): CalendarProvider {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;
  const call = async (url: string, init: RequestInit = {}) => {
    await assertSalesWorker(admin, "sdr_enrollments", enrollmentId, [
      ...(agentVersionId ? [{ agent_version_id: agentVersionId }] : []),
      { table: "calendar_accounts", id: s.calendar_account_id, action: "manage" },
      { member_id: s.host_user_id },
    ]);
    const token = await googleToken(admin, s.calendar_account_id, workspaceId);
    await assertSalesWorker(admin, "sdr_enrollments", enrollmentId, [
      ...(agentVersionId ? [{ agent_version_id: agentVersionId }] : []),
      { table: "calendar_accounts", id: s.calendar_account_id, action: "manage" },
      { member_id: s.host_user_id },
    ]);
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  };
  const meet = (j: {
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
  }) =>
    j.hangoutLink ??
    j.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  const net = (e: unknown) => ({
    ok: false as const,
    error: (e as Error).message,
    uncertain: true,
  });
  return {
    kind: "google",
    simulated: false,
    async freeBusy(from, to) {
      try {
        const res = await call("https://www.googleapis.com/calendar/v3/freeBusy", {
          method: "POST",
          body: JSON.stringify({
            timeMin: new Date(from).toISOString(),
            timeMax: new Date(to).toISOString(),
            timeZone: s.timezone,
            items: [{ id: calendarId }],
          }),
        });
        if (!res.ok) return { ok: false as const, error: `freeBusy ${res.status}` };
        const j = (await res.json()) as {
          calendars?: Record<
            string,
            { busy?: { start: string; end: string }[]; errors?: unknown[] }
          >;
        };
        const cal = j.calendars?.[calendarId];
        // Erro ou ausência da agenda nunca é interpretado como "livre".
        if (!cal || cal.errors?.length)
          return { ok: false as const, error: "Agenda não devolveu disponibilidade" };
        const busy: Busy[] = (cal.busy ?? []).map((b) => ({
          start: Date.parse(b.start),
          end: Date.parse(b.end),
        }));
        return { ok: true as const, busy };
      } catch (e) {
        return { ok: false as const, error: (e as Error).message };
      }
    },
    async createEvent(e) {
      try {
        const body = {
          id: e.eventId,
          summary: e.summary,
          description: e.description,
          start: { dateTime: new Date(e.start).toISOString(), timeZone: e.timezone },
          end: { dateTime: new Date(e.end).toISOString(), timeZone: e.timezone },
          attendees: e.attendeeEmail ? [{ email: e.attendeeEmail }] : [],
          ...(e.video
            ? {
                conferenceData: {
                  createRequest: {
                    requestId: e.eventId,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                  },
                },
              }
            : {}),
        };
        const res = await call(
          `${base}/events?conferenceDataVersion=1&sendUpdates=${e.attendeeEmail ? "all" : "none"}`,
          { method: "POST", body: JSON.stringify(body) },
        );
        if (res.status === 409) {
          const g = await this.getEvent(e.eventId);
          return g.ok && g.exists
            ? { ok: true as const, eventId: e.eventId, meetLink: g.meetLink }
            : { ok: false as const, error: "Conflito de id no provedor", uncertain: true };
        }
        if (!res.ok)
          return {
            ok: false as const,
            error: `events.insert ${res.status}`,
            uncertain: res.status >= 500 || res.status === 429,
          };
        const j = await res.json();
        return { ok: true as const, eventId: e.eventId, meetLink: meet(j) };
      } catch (err) {
        return net(err);
      }
    },
    async getEvent(id) {
      try {
        const res = await call(`${base}/events/${id}`);
        if (res.status === 404 || res.status === 410)
          return { ok: true as const, exists: false, cancelled: false, meetLink: null };
        if (!res.ok) return { ok: false as const, error: `events.get ${res.status}` };
        const j = await res.json();
        return {
          ok: true as const,
          exists: true,
          cancelled: j.status === "cancelled",
          meetLink: meet(j),
        };
      } catch (err) {
        return net(err);
      }
    },
    async moveEvent(id, start, end, tz) {
      try {
        const res = await call(`${base}/events/${id}?sendUpdates=all`, {
          method: "PATCH",
          body: JSON.stringify({
            start: { dateTime: new Date(start).toISOString(), timeZone: tz },
            end: { dateTime: new Date(end).toISOString(), timeZone: tz },
          }),
        });
        if (!res.ok) return { ok: false as const, error: `events.patch ${res.status}` };
        return { ok: true as const, meetLink: meet(await res.json()) };
      } catch (err) {
        return net(err);
      }
    },
    async deleteEvent(id) {
      try {
        const res = await call(`${base}/events/${id}?sendUpdates=all`, { method: "DELETE" });
        if (!res.ok && res.status !== 410)
          return { ok: false as const, error: `events.delete ${res.status}` };
        return { ok: true as const };
      } catch (err) {
        return net(err);
      }
    },
  };
}

export async function primaryCalendarId(
  admin: Admin,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const { data } = await admin
    .from("calendar_accounts")
    .select("primary_calendar_id")
    .eq("id", accountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.primary_calendar_id || "primary";
}
