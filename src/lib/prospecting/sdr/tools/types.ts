// Contratos das ferramentas: armazenamento e provedor de agenda são
// injetados (produção = banco + Google; teste/sandbox = memória + falso).
import type { Busy } from "./scheduling";

export type ProviderResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; uncertain?: boolean };

export interface CalendarProvider {
  readonly kind: "google" | "microsoft" | "fake";
  readonly simulated: boolean;
  freeBusy(fromMs: number, toMs: number): Promise<ProviderResult<{ busy: Busy[] }>>;
  createEvent(e: {
    eventId: string;
    start: number;
    end: number;
    timezone: string;
    summary: string;
    description: string;
    attendeeEmail: string | null;
    video: boolean;
  }): Promise<ProviderResult<{ eventId: string; meetLink: string | null }>>;
  getEvent(
    eventId: string,
  ): Promise<ProviderResult<{ exists: boolean; cancelled: boolean; meetLink: string | null }>>;
  moveEvent(
    eventId: string,
    start: number,
    end: number,
    timezone: string,
  ): Promise<ProviderResult<{ meetLink: string | null }>>;
  deleteEvent(eventId: string): Promise<ProviderResult<object>>;
}

export type MeetingStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "reconcile"
  | "canceled"
  | "rescheduled";

export type MeetingRow = {
  id: string;
  conversation_id: string;
  calendar_account_id: string;
  status: MeetingStatus;
  start_at: string;
  end_at: string;
  provider_event_id: string;
  meet_link: string | null;
  idem_key: string;
};

export type OfferSlot = { position: number; start: number; end: number; status: string };
export type CustomerCandidate = {
  kind: "lead" | "contact";
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phones: string[];
};
export type ToolLog = {
  idem_key: string;
  tool: string;
  tool_call_id: string;
  input: unknown;
  output: unknown;
  status: "ok" | "error" | "denied" | "pending";
  error: string | null;
  duration_ms: number;
};

export type CustomerQuery = {
  email: string | null;
  phoneVariants: string[];
  firstName: string | null;
  lastName: string | null;
};

export interface ToolStore {
  getToolLog(idemKey: string): Promise<ToolLog | null>;
  saveToolLog(log: ToolLog): Promise<void>;
  getOffers(conversationId: string): Promise<{ offerSet: number; slots: OfferSlot[] } | null>;
  /** Fecha o conjunto vigente (recusado ou substituído) e grava o novo. */
  saveOffers(
    conversationId: string,
    slots: { start: number; end: number }[],
    previous: "rejected" | "superseded",
  ): Promise<number>;
  rejectedStarts(conversationId: string): Promise<number[]>;
  markOffer(
    conversationId: string,
    offerSet: number,
    position: number,
    status: "chosen" | "superseded",
  ): Promise<void>;
  reserveMeeting(
    p: Record<string, unknown>,
  ): Promise<{ status: "reserved" | "exists" | "conflict"; id?: string; meeting_status?: string }>;
  updateMeeting(id: string, patch: Record<string, unknown>): Promise<void>;
  getMeeting(id: string): Promise<MeetingRow | null>;
  conversationMeetings(conversationId: string): Promise<MeetingRow[]>;
  /** Reuniões do SDR ainda em andamento nesta agenda (não refletidas no provedor). */
  activeMeetingsBusy(
    calendarAccountId: string,
    fromMs: number,
    toMs: number,
    excludeId?: string,
  ): Promise<Busy[]>;
  findCustomers(q: CustomerQuery): Promise<CustomerCandidate[]>;
  crmContext(link: {
    leadId: string | null;
    contactId: string | null;
    dealId: string | null;
    companyId: string | null;
  }): Promise<Record<string, unknown>>;
  createActivity(a: Record<string, unknown>): Promise<string | null>;
  setEnrollment(enrollmentId: string, patch: Record<string, unknown>): Promise<void>;
  enrollmentTags(enrollmentId: string): Promise<string[]>;
  searchKb(query: string): Promise<{ title: string; excerpt: string; slug: string }[]>;
}
