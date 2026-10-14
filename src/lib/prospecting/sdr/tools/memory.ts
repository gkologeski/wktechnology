// Implementações em memória: testes automáticos e sandbox do estúdio.
// Toda saída do provedor falso é marcada como simulada.
import type { Busy } from "./scheduling";
import type {
  CalendarProvider,
  CustomerCandidate,
  CustomerQuery,
  MeetingRow,
  OfferSlot,
  ToolLog,
  ToolStore,
} from "./types";

type FakeEvent = { start: number; end: number; cancelled: boolean; meetLink: string | null };

export class FakeCalendar implements CalendarProvider {
  readonly kind = "fake" as const;
  readonly simulated = true;
  events = new Map<string, FakeEvent>();
  calls: string[] = [];
  /** "timeout" cria o evento mas responde incerto; "fail" recusa sem criar. */
  nextCreate: "ok" | "timeout" | "fail" = "ok";
  freeBusyFails = false;
  constructor(public externalBusy: Busy[] = []) {}

  async freeBusy(from: number, to: number) {
    this.calls.push("freeBusy");
    if (this.freeBusyFails) return { ok: false as const, error: "Agenda indisponível (simulado)" };
    const own = [...this.events.values()]
      .filter((e) => !e.cancelled)
      .map((e) => ({ start: e.start, end: e.end }));
    return {
      ok: true as const,
      busy: [...this.externalBusy, ...own].filter((b) => b.end > from && b.start < to),
    };
  }
  async createEvent(e: Parameters<CalendarProvider["createEvent"]>[0]) {
    this.calls.push("createEvent");
    const mode = this.nextCreate;
    this.nextCreate = "ok";
    if (mode === "fail")
      return { ok: false as const, error: "Recusado pelo provedor (simulado)", uncertain: false };
    const existing = this.events.get(e.eventId);
    if (existing) return { ok: true as const, eventId: e.eventId, meetLink: existing.meetLink };
    const meetLink = e.video ? `https://meet.google.com/sim-${e.eventId.slice(-6)}` : null;
    this.events.set(e.eventId, { start: e.start, end: e.end, cancelled: false, meetLink });
    if (mode === "timeout")
      return { ok: false as const, error: "Tempo esgotado (simulado)", uncertain: true };
    return { ok: true as const, eventId: e.eventId, meetLink };
  }
  async getEvent(eventId: string) {
    const ev = this.events.get(eventId);
    return {
      ok: true as const,
      exists: !!ev,
      cancelled: !!ev?.cancelled,
      meetLink: ev?.meetLink ?? null,
    };
  }
  async moveEvent(eventId: string, start: number, end: number) {
    this.calls.push("moveEvent");
    const ev = this.events.get(eventId);
    if (!ev) return { ok: false as const, error: "Evento inexistente" };
    ev.start = start;
    ev.end = end;
    return { ok: true as const, meetLink: ev.meetLink };
  }
  async deleteEvent(eventId: string) {
    this.calls.push("deleteEvent");
    const ev = this.events.get(eventId);
    if (ev) ev.cancelled = true;
    return { ok: true as const };
  }
}

let seq = 0;
const nextId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;
const ACTIVE = ["pending", "confirmed", "reconcile"];
const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

type OfferRow = {
  conversation_id: string;
  offer_set: number;
  position: number;
  start: number;
  end: number;
  status: string;
};

export class MemoryStore implements ToolStore {
  logs = new Map<string, ToolLog>();
  offers: OfferRow[] = [];
  meetings: (MeetingRow & Record<string, unknown>)[] = [];
  activities: Record<string, unknown>[] = [];
  enrollments = new Map<string, Record<string, unknown>>();
  customers: CustomerCandidate[] = [];
  kb: { title: string; excerpt: string; slug: string; body: string }[] = [];
  contextData: Record<string, unknown> = {};

  async getToolLog(k: string) {
    return this.logs.get(k) ?? null;
  }
  async saveToolLog(l: ToolLog) {
    if (!this.logs.has(l.idem_key)) this.logs.set(l.idem_key, l);
  }
  async getOffers(c: string) {
    const rows = this.offers.filter((o) => o.conversation_id === c);
    if (!rows.length) return null;
    const set = Math.max(...rows.map((r) => r.offer_set));
    const slots: OfferSlot[] = rows
      .filter((r) => r.offer_set === set)
      .map((r) => ({ position: r.position, start: r.start, end: r.end, status: r.status }));
    return { offerSet: set, slots };
  }
  async saveOffers(
    c: string,
    slots: { start: number; end: number }[],
    previous: "rejected" | "superseded",
  ) {
    for (const o of this.offers)
      if (o.conversation_id === c && o.status === "offered") o.status = previous;
    const set =
      Math.max(0, ...this.offers.filter((o) => o.conversation_id === c).map((o) => o.offer_set)) +
      1;
    slots.forEach((s, i) =>
      this.offers.push({
        conversation_id: c,
        offer_set: set,
        position: i + 1,
        start: s.start,
        end: s.end,
        status: "offered",
      }),
    );
    return set;
  }
  async rejectedStarts(c: string) {
    return this.offers
      .filter((o) => o.conversation_id === c && o.status === "rejected")
      .map((o) => o.start);
  }
  async markOffer(c: string, set: number, pos: number, status: "chosen" | "superseded") {
    const o = this.offers.find(
      (x) => x.conversation_id === c && x.offer_set === set && x.position === pos,
    );
    if (o) o.status = status;
  }
  /** Mesma regra da função SQL sdr_reserve_meeting (aqui síncrona = atômica). */
  async reserveMeeting(p: Record<string, unknown>) {
    const ex = this.meetings.find((m) => m.idem_key === p.idem_key && ACTIVE.includes(m.status));
    if (ex) return { status: "exists" as const, id: ex.id, meeting_status: ex.status };
    const s = Date.parse(String(p.start_at));
    const e = Date.parse(String(p.end_at));
    const bb = Number(p.buffer_before_minutes ?? 0) * 60000;
    const ba = Number(p.buffer_after_minutes ?? 0) * 60000;
    const clash = this.meetings.some(
      (m) =>
        m.calendar_account_id === p.calendar_account_id &&
        ACTIVE.includes(m.status) &&
        Date.parse(m.start_at) - ba < e &&
        Date.parse(m.end_at) + bb > s,
    );
    if (clash) return { status: "conflict" as const };
    const row = {
      ...p,
      id: nextId(),
      status: "pending",
      meet_link: null,
    } as unknown as MeetingRow & Record<string, unknown>;
    this.meetings.push(row);
    return { status: "reserved" as const, id: row.id };
  }
  async updateMeeting(mid: string, patch: Record<string, unknown>) {
    const m = this.meetings.find((x) => x.id === mid);
    if (m) Object.assign(m, patch);
  }
  async getMeeting(mid: string) {
    return this.meetings.find((x) => x.id === mid) ?? null;
  }
  async conversationMeetings(c: string) {
    return this.meetings.filter((m) => m.conversation_id === c);
  }
  async activeMeetingsBusy(cal: string, from: number, to: number, excludeId?: string) {
    return this.meetings
      .filter(
        (m) =>
          m.calendar_account_id === cal &&
          ["pending", "reconcile"].includes(m.status) &&
          m.id !== excludeId,
      )
      .map((m) => ({ start: Date.parse(m.start_at), end: Date.parse(m.end_at) }))
      .filter((b) => b.end > from && b.start < to);
  }
  async findCustomers(q: CustomerQuery) {
    if (!q.email && !q.firstName && !q.phoneVariants.length) return [];
    return this.customers.filter((c) => {
      if (q.email && norm(c.email) !== norm(q.email)) return false;
      if (q.firstName && norm(c.first_name) !== norm(q.firstName)) return false;
      if (q.lastName && norm(c.last_name) !== norm(q.lastName)) return false;
      if (q.phoneVariants.length && !c.phones.some((p) => q.phoneVariants.includes(p)))
        return false;
      return true;
    });
  }
  async crmContext() {
    return this.contextData;
  }
  async createActivity(a: Record<string, unknown>) {
    this.activities.push(a);
    return `act-${this.activities.length}`;
  }
  async setEnrollment(eid: string, patch: Record<string, unknown>) {
    this.enrollments.set(eid, { ...(this.enrollments.get(eid) ?? {}), ...patch });
  }
  async enrollmentTags(eid: string) {
    return (this.enrollments.get(eid)?.tags as string[] | undefined) ?? [];
  }
  async searchKb(query: string) {
    const q = norm(query);
    return this.kb
      .filter((k) => norm(`${k.title} ${k.body}`).includes(q))
      .map(({ title, excerpt, slug }) => ({ title, excerpt, slug }));
  }
}
