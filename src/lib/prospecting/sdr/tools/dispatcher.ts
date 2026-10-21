// Executor único das ferramentas do Agente SDR. A IA só escolhe ferramenta e
// argumentos de negócio; workspace, agente, conversa, anfitrião e usuário vêm
// do servidor. Ferramenta desligada/não pronta é negada; efeitos exigem a
// mensagem atual do cliente como confirmação; tudo fica registrado.
import { meetingTitle } from "../default-agent";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";
import { acceptAnswers, type CanonicalQuestion } from "../qualification";
import type { ConversationMessage } from "../policy";
import { toolDef, type ScheduleConfig, type ToolConfig } from "./catalog";
import {
  dayPart,
  evaluateSpecific,
  formatSlotPt,
  generateSlots,
  overlapsBusy,
  pickDiverse,
  type Busy,
  type Schedule,
  type Slot,
} from "./scheduling";
import type { CalendarProvider, MeetingRow, ToolStore } from "./types";

export type TurnEffects = {
  answers: unknown[];
  materialIds: string[];
  handoff: string | null;
  optOut: boolean;
  meeting: {
    status: "confirmed" | "pending" | "canceled" | "failed";
    start: number;
    timezone: string;
    meetLink: string | null;
  } | null;
  trace: { tool: string; status: string; simulated: boolean; output: unknown }[];
  /** Conjuntos de opções criados NESTE turno: o cliente ainda não os viu. */
  offerSetsThisTurn: number[];
};

export const emptyEffects = (): TurnEffects => ({
  answers: [],
  materialIds: [],
  handoff: null,
  optOut: false,
  meeting: null,
  trace: [],
  offerSetsThisTurn: [],
});

export type ToolCtx = {
  mode: "live" | "sandbox";
  jobId: string | null;
  jobKind: "reply" | "follow_up";
  workspaceId: string;
  playbookId: string;
  agentVersionId: string | null;
  conversation: {
    id: string;
    phone: string;
    leadId: string | null;
    contactId: string | null;
    companyId: string | null;
    dealId: string | null;
    campaignId: string | null;
    enrollmentId: string | null;
  };
  history: ConversationMessage[];
  config: ToolConfig;
  /** Ferramentas expostas (ligadas na versão publicada e prontas). */
  exposed: Set<string>;
  scheduling: ScheduleConfig | null;
  calendar: CalendarProvider | null;
  store: ToolStore;
  offers: {
    offer_key: string;
    name: string;
    summary: string;
    commercial_notes?: string | null;
    fit_signals?: string[];
  }[];
  materials: { id: string; title: string }[];
  kbSources: { title: string; url: string; note: string }[];
  attachMaterials: boolean;
  questions: CanonicalQuestion[];
  assigneeId: string | null;
  /** Perfil da Lia no workspace: autora/responsável do que ela registra. */
  agentUserId?: string | null;
  now: () => number;
  newEventId: () => string;
  effects: TurnEffects;
};

type Result = Record<string, unknown>;
const iso = (ms: number) => new Date(ms).toISOString();

function schedule(s: ScheduleConfig): Schedule {
  return {
    timezone: s.timezone,
    duration_minutes: s.duration_minutes,
    buffer_before_minutes: s.buffer_before_minutes,
    buffer_after_minutes: s.buffer_after_minutes,
    min_notice_hours: s.min_notice_hours,
    horizon_days: s.horizon_days,
    working_hours: s.working_hours,
    holidays: s.holidays,
  };
}

function latestInboundId(ctx: ToolCtx): string | null {
  const inb = ctx.history.filter((m) => m.direction === "inbound");
  return inb.length ? inb[inb.length - 1]!.id : null;
}

/** Executa uma chamada de ferramenta; nunca lança — erro vira resultado. */
export async function executeTool(
  ctx: ToolCtx,
  toolId: string,
  rawArgs: unknown,
  toolCallId: string,
): Promise<Result> {
  const started = ctx.now();
  const def = toolDef(toolId);
  const simulated = ctx.mode === "sandbox" || !!ctx.calendar?.simulated;
  const idem = `${ctx.jobId ?? `sandbox-${ctx.conversation.id}`}:${toolCallId}`;
  const finish = async (status: "ok" | "error" | "denied" | "pending", output: Result) => {
    const out = { ...output, ...(simulated ? { simulated: true } : {}) };
    ctx.effects.trace.push({ tool: toolId, status, simulated, output: out });
    await ctx.store.saveToolLog({
      idem_key: idem,
      tool: toolId,
      tool_call_id: toolCallId,
      input: rawArgs,
      output: out,
      status,
      error: status === "ok" ? null : String(output.error ?? output.status ?? status),
      duration_ms: ctx.now() - started,
    });
    return out;
  };

  if (!def || !ctx.exposed.has(toolId))
    return finish("denied", { error: "Ferramenta desligada ou indisponível para este agente." });
  // Idempotência por execução + chamada: repetir a mesma chamada devolve o mesmo resultado.
  const prev = await ctx.store.getToolLog(idem);
  if (prev) return (prev.output as Result) ?? {};
  const parsed = def.input.safeParse(rawArgs);
  if (!parsed.success)
    return finish("error", { error: `Argumentos inválidos: ${parsed.error.issues[0]?.message}` });
  const args = parsed.data as Record<string, unknown>;
  if (def.effect === "write" && ctx.jobKind === "follow_up")
    return finish("denied", { error: "Ações com efeito só respondem a mensagem do cliente." });
  if (def.confirmation) {
    const latest = latestInboundId(ctx);
    if (!latest || args.confirmation_message_id !== latest)
      return finish("denied", {
        error:
          "Confirmação ausente: a mensagem ATUAL do cliente precisa confirmar explicitamente esta ação.",
      });
  }
  try {
    const out = await HANDLERS[toolId]!(ctx, args);
    const status = (out.__status as "ok" | "error" | "pending" | undefined) ?? "ok";
    delete out.__status;
    return finish(status, out);
  } catch (e) {
    return finish("error", { error: (e as Error).message.slice(0, 300) });
  }
}

type Handler = (ctx: ToolCtx, a: Record<string, unknown>) => Promise<Result>;

function needCalendar(ctx: ToolCtx): { s: ScheduleConfig; cal: CalendarProvider } | Result {
  if (!ctx.scheduling || !ctx.calendar)
    return { __status: "error", error: "Agenda do anfitrião não configurada." };
  return { s: ctx.scheduling, cal: ctx.calendar };
}

async function busyIn(
  ctx: ToolCtx,
  s: ScheduleConfig,
  cal: CalendarProvider,
  from: number,
  to: number,
  excludeId?: string,
) {
  const fb = await cal.freeBusy(from, to);
  if (!fb.ok) return null;
  const own = await ctx.store.activeMeetingsBusy(s.calendar_account_id, from, to, excludeId);
  return [...fb.busy, ...own];
}

function present(slots: Slot[], tz: string) {
  return slots.map((sl, i) => ({
    option: i + 1,
    label: formatSlotPt(sl.start, tz),
    start: iso(sl.start),
    part_of_day: dayPart(sl.start, tz),
  }));
}

const availability: Handler = async (ctx, a) => {
  const c = needCalendar(ctx);
  if (!("s" in c)) return c;
  const { s, cal } = c as { s: ScheduleConfig; cal: CalendarProvider };
  const now = ctx.now();
  const busy = await busyIn(ctx, s, cal, now, now + (s.horizon_days + 1) * 86400000);
  if (!busy)
    return {
      __status: "error",
      status: "calendar_unavailable",
      instruction:
        "Não foi possível consultar a agenda. Não ofereça horários; diga que vai confirmar.",
    };
  const sch = schedule(s);
  const current = await ctx.store.getOffers(ctx.conversation.id);
  const rejected = new Set(await ctx.store.rejectedStarts(ctx.conversation.id));
  // Nova consulta depois de opções já mostradas (em turno anterior) = cliente não as aceitou.
  const shownBefore =
    !!current &&
    !ctx.effects.offerSetsThisTurn.includes(current.offerSet) &&
    current.slots.some((sl) => sl.status === "offered");
  if ((a.rejected_previous || shownBefore) && current)
    for (const sl of current.slots) if (sl.status === "offered") rejected.add(sl.start);
  const previous = a.rejected_previous || shownBefore ? "rejected" : "superseded";
  if (a.rejected_previous && !a.date && !a.part_of_day) {
    // Recusa sem preferência: registra e pergunta dia e turno, sem novos horários.
    await ctx.store.saveOffers(ctx.conversation.id, [], "rejected");
    return {
      status: "ask_preference",
      options: [],
      instruction:
        "Registrei a recusa. Não ofereça novos horários agora: pergunte qual dia e qual turno (manhã ou tarde) o cliente prefere. Depois consulte com date e/ou part_of_day.",
    };
  }
  const part = (a.part_of_day as string | null) ?? null;
  let slots: Slot[];
  let status = "options";
  if (a.date) {
    const r = evaluateSpecific(sch, busy, now, {
      date: String(a.date),
      time: (a.time as string | null) ?? null,
      timezone: (a.timezone as string | null) ?? null,
    });
    if (r.status === "invalid") return { status: "need_clarification", instruction: r.reason };
    if (r.status === "free") {
      slots = [r.slot];
      status = "requested_free";
    } else {
      slots = r.alternatives.filter((x) => !rejected.has(x.start));
      status = `requested_${r.status}`;
    }
    if (part && !a.time && r.status !== "free") {
      const day = String(a.date);
      const inPart = generateSlots(sch, busy, now, { fromYmd: day, toYmd: day }).filter(
        (x) => dayPart(x.start, s.timezone) === part && !rejected.has(x.start),
      );
      if (inPart.length) {
        // Até 3 horários espalhados pelo turno.
        const step = Math.max(1, Math.floor(inPart.length / 3));
        slots = [0, step, step * 2]
          .map((i) => inPart[i])
          .filter((x): x is Slot => !!x)
          .slice(0, 3);
        status = "requested_part";
      } else {
        // Turno pedido sem horário naquele dia: mais próximo depois, no mesmo turno.
        const from = Date.parse(`${String(a.date)}T00:00:00Z`);
        slots = generateSlots(sch, busy, now)
          .filter((x) => x.start >= from && dayPart(x.start, s.timezone) === part)
          .filter((x) => !rejected.has(x.start))
          .slice(0, 3);
        status = "requested_part_unavailable_next";
      }
    }
  } else {
    let all = generateSlots(sch, busy, now);
    if (part) all = all.filter((x) => dayPart(x.start, s.timezone) === part);
    slots = pickDiverse(all, s.timezone, 3, [...rejected]);
  }
  if (!slots.length) {
    if (a.rejected_previous) await ctx.store.saveOffers(ctx.conversation.id, [], "rejected");
    return {
      status: status === "options" ? "no_availability" : status,
      options: [],
      instruction:
        "Sem horários livres no período configurado. Não invente horários; ofereça falar com uma pessoa.",
    };
  }
  ctx.effects.offerSetsThisTurn.push(
    await ctx.store.saveOffers(ctx.conversation.id, slots, previous),
  );
  return {
    status,
    timezone: s.timezone,
    duration_minutes: s.duration_minutes,
    options: present(slots, s.timezone),
    ...(status === "requested_part_unavailable_next"
      ? {
          note: "Não há horário livre nesse turno no dia pedido; estes são os mais próximos depois, no mesmo turno. Informe isso.",
        }
      : {}),
    ...(slots.length < 3 && status === "options"
      ? { note: `Só há ${slots.length} horário(s) livre(s) no período; informe essa restrição.` }
      : {}),
    instruction:
      "Ofereça exatamente estas opções numeradas, na ordem. Nada de link de agendamento.",
  };
};

/** Título "Reunião [empresa] <> WK Technology" com a empresa vinculada à conversa. */
async function titleFor(ctx: ToolCtx, s: ScheduleConfig): Promise<string> {
  let company: string | null = null;
  try {
    const c = await ctx.store.crmContext({
      leadId: ctx.conversation.leadId,
      contactId: ctx.conversation.contactId,
      dealId: ctx.conversation.dealId,
      companyId: ctx.conversation.companyId,
    });
    company = typeof c.company === "string" ? c.company : null;
  } catch {
    company = null;
  }
  return meetingTitle(s.meeting_title, { company });
}

async function confirmMeeting(
  ctx: ToolCtx,
  m: MeetingRow,
  meetLink: string | null,
  s: ScheduleConfig,
) {
  await ctx.store.updateMeeting(m.id, {
    status: "confirmed",
    meet_link: meetLink,
    error: null,
    updated_at: iso(ctx.now()),
  });
  const start = Date.parse(m.start_at);
  const activityId = await ctx.store.createActivity({
    workspace_id: ctx.workspaceId,
    owner_id: s.host_user_id,
    assigned_to: s.host_user_id,
    type: "meeting",
    subject: await titleFor(ctx, s),
    body: `Reunião marcada pelo Agente SDR na conversa do WhatsApp. ${meetLink ? `Videoconferência: ${meetLink}` : ""}`.trim(),
    due_date: m.start_at,
    activity_date: m.start_at,
    meeting_location: meetLink,
    related_lead_id: ctx.conversation.leadId,
    related_contact_id: ctx.conversation.contactId,
    related_company_id: ctx.conversation.companyId,
    related_deal_id: ctx.conversation.dealId,
    external_ids: { sdr_meeting_id: m.id, provider_event_id: m.provider_event_id },
  });
  if (activityId) await ctx.store.updateMeeting(m.id, { activity_id: activityId });
  if (ctx.conversation.enrollmentId)
    await ctx.store.setEnrollment(ctx.conversation.enrollmentId, {
      meeting_status: "confirmed",
      commercial_stage: "meeting_booked",
      follow_up_at: null,
      cancel_reason: "meeting",
    });
  ctx.effects.meeting = { status: "confirmed", start, timezone: s.timezone, meetLink };
  return {
    status: "confirmed",
    when: formatSlotPt(start, s.timezone),
    timezone: s.timezone,
    video_link: meetLink,
    instruction:
      "Confirme a reunião ao cliente. O link da videoconferência é anexado pelo sistema.",
  };
}

/** Reserva com envio incerto: consulta o evento pelo id determinístico antes de recriar. */
async function settle(
  ctx: ToolCtx,
  s: ScheduleConfig,
  cal: CalendarProvider,
  m: MeetingRow,
  attendee: string | null,
) {
  if (m.status === "confirmed") return confirmMeeting(ctx, m, m.meet_link, s);
  if (m.status === "reconcile") {
    const ev = await cal.getEvent(m.provider_event_id);
    if (!ev.ok) return pending(ctx, s, m);
    if (ev.exists && !ev.cancelled) return confirmMeeting(ctx, m, ev.meetLink, s);
  }
  const start = Date.parse(m.start_at);
  const created = await cal.createEvent({
    eventId: m.provider_event_id,
    start,
    end: Date.parse(m.end_at),
    timezone: s.timezone,
    summary: await titleFor(ctx, s),
    description: "Reunião marcada pela assistente virtual da WK Technology.",
    attendeeEmail: attendee,
    video: s.video === "google_meet",
  });
  if (created.ok) return confirmMeeting(ctx, m, created.meetLink, s);
  if (created.uncertain) {
    await ctx.store.updateMeeting(m.id, { status: "reconcile", error: created.error });
    return pending(ctx, s, m);
  }
  await ctx.store.updateMeeting(m.id, { status: "failed", error: created.error });
  ctx.effects.meeting = { status: "failed", start, timezone: s.timezone, meetLink: null };
  return {
    __status: "error",
    status: "failed",
    instruction:
      "A agenda recusou a marcação. Não confirme; peça desculpas e ofereça outro horário ou uma pessoa.",
  };
}

function pending(ctx: ToolCtx, s: ScheduleConfig, m: MeetingRow) {
  ctx.effects.meeting = {
    status: "pending",
    start: Date.parse(m.start_at),
    timezone: s.timezone,
    meetLink: null,
  };
  return {
    __status: "pending",
    status: "pending_confirmation",
    instruction:
      "A marcação está sendo confirmada pela agenda. NÃO diga que está confirmada; avise que retorna em instantes.",
  };
}

async function resolveOption(ctx: ToolCtx, option: number) {
  const offers = await ctx.store.getOffers(ctx.conversation.id);
  const slot = offers?.slots.find((x) => x.position === option && x.status === "offered");
  // Só vale opção já apresentada ao cliente em turno anterior.
  if (!slot || !offers || ctx.effects.offerSetsThisTurn.includes(offers.offerSet)) return null;
  return { slot, offerSet: offers.offerSet };
}

const book: Handler = async (ctx, a) => {
  const c = needCalendar(ctx);
  if (!("s" in c)) return c;
  const { s, cal } = c as { s: ScheduleConfig; cal: CalendarProvider };
  const active = (await ctx.store.conversationMeetings(ctx.conversation.id)).filter((m) =>
    ["confirmed", "pending", "reconcile"].includes(m.status),
  );
  const chosen = await resolveOption(ctx, Number(a.option));
  // Reentrada (nova tentativa após tempo esgotado): conclui a reserva existente.
  const inflight = active.find((m) => m.status !== "confirmed");
  if (inflight) return settle(ctx, s, cal, inflight, (a.attendee_email as string | null) ?? null);
  if (active.some((m) => m.status === "confirmed"))
    return {
      __status: "error",
      status: "already_booked",
      instruction: "Já existe reunião nesta conversa; use remarcar se o cliente pedir.",
    };
  if (!chosen)
    return {
      __status: "error",
      status: "option_not_current",
      hint: "Apresente as opções ao cliente e aguarde a escolha na próxima mensagem.",
      instruction: "Essa opção não está entre as vigentes. Consulte a agenda de novo.",
    };
  const { slot, offerSet } = chosen;
  const sch = schedule(s);
  const busy = await busyIn(ctx, s, cal, slot.start - 86400000, slot.end + 86400000);
  if (!busy)
    return {
      __status: "error",
      status: "calendar_unavailable",
      instruction: "Agenda indisponível agora; não confirme.",
    };
  if (overlapsBusy(sch, slot, busy)) {
    await ctx.store.markOffer(ctx.conversation.id, offerSet, slot.position, "superseded");
    return {
      __status: "error",
      status: "slot_taken",
      instruction:
        "O horário acabou de ser ocupado. Consulte a agenda novamente e ofereça outras opções.",
    };
  }
  const r = await ctx.store.reserveMeeting({
    workspace_id: ctx.workspaceId,
    playbook_id: ctx.playbookId,
    conversation_id: ctx.conversation.id,
    enrollment_id: ctx.conversation.enrollmentId ?? "",
    campaign_id: ctx.conversation.campaignId ?? "",
    host_user_id: s.host_user_id,
    calendar_account_id: s.calendar_account_id,
    provider: cal.kind,
    start_at: iso(slot.start),
    end_at: iso(slot.end),
    buffer_before_minutes: s.buffer_before_minutes,
    buffer_after_minutes: s.buffer_after_minutes,
    timezone: s.timezone,
    provider_event_id: ctx.newEventId(),
    attendee_email: (a.attendee_email as string | null) ?? "",
    lead_id: ctx.conversation.leadId ?? "",
    contact_id: ctx.conversation.contactId ?? "",
    company_id: ctx.conversation.companyId ?? "",
    deal_id: ctx.conversation.dealId ?? "",
    idem_key: `${ctx.conversation.id}:${iso(slot.start)}`,
  });
  if (r.status === "conflict") {
    await ctx.store.markOffer(ctx.conversation.id, offerSet, slot.position, "superseded");
    return {
      __status: "error",
      status: "slot_taken",
      instruction: "O horário acabou de ser reservado. Consulte a agenda novamente.",
    };
  }
  const m = await ctx.store.getMeeting(r.id!);
  if (!m) return { __status: "error", error: "Reserva não encontrada." };
  await ctx.store.markOffer(ctx.conversation.id, offerSet, slot.position, "chosen");
  return settle(ctx, s, cal, m, (a.attendee_email as string | null) ?? null);
};

const reschedule: Handler = async (ctx, a) => {
  const c = needCalendar(ctx);
  if (!("s" in c)) return c;
  const { s, cal } = c as { s: ScheduleConfig; cal: CalendarProvider };
  const current = (await ctx.store.conversationMeetings(ctx.conversation.id)).find(
    (m) => m.status === "confirmed",
  );
  if (!current)
    return {
      __status: "error",
      status: "no_meeting",
      instruction: "Não há reunião marcada nesta conversa.",
    };
  const chosen = await resolveOption(ctx, Number(a.option));
  if (!chosen)
    return {
      __status: "error",
      status: "option_not_current",
      instruction: "Consulte a agenda e ofereça opções antes.",
    };
  const { slot, offerSet } = chosen;
  const curS = Date.parse(current.start_at);
  const curE = Date.parse(current.end_at);
  const busyAll = await busyIn(ctx, s, cal, slot.start - 86400000, slot.end + 86400000, current.id);
  if (!busyAll) return { __status: "error", status: "calendar_unavailable" };
  const busy = busyAll.filter((b: Busy) => !(b.start === curS && b.end === curE));
  if (overlapsBusy(schedule(s), slot, busy))
    return {
      __status: "error",
      status: "slot_taken",
      instruction: "Horário ocupado; consulte de novo.",
    };
  const moved = await cal.moveEvent(current.provider_event_id, slot.start, slot.end, s.timezone);
  if (!moved.ok)
    return {
      __status: "error",
      status: "failed",
      instruction: "A agenda não confirmou a remarcação; a reunião original continua.",
    };
  await ctx.store.updateMeeting(current.id, {
    start_at: iso(slot.start),
    end_at: iso(slot.end),
    meet_link: moved.meetLink ?? current.meet_link,
    idem_key: `${ctx.conversation.id}:${iso(slot.start)}`,
    updated_at: iso(ctx.now()),
  });
  await ctx.store.markOffer(ctx.conversation.id, offerSet, slot.position, "chosen");
  await ctx.store.createActivity({
    workspace_id: ctx.workspaceId,
    owner_id: s.host_user_id,
    type: "note",
    subject: "Reunião remarcada pelo Agente SDR",
    body: `De ${formatSlotPt(curS, s.timezone)} para ${formatSlotPt(slot.start, s.timezone)}.`,
    related_lead_id: ctx.conversation.leadId,
    related_contact_id: ctx.conversation.contactId,
    related_deal_id: ctx.conversation.dealId,
  });
  ctx.effects.meeting = {
    status: "confirmed",
    start: slot.start,
    timezone: s.timezone,
    meetLink: moved.meetLink ?? current.meet_link,
  };
  return { status: "rescheduled", when: formatSlotPt(slot.start, s.timezone) };
};

const cancel: Handler = async (ctx, a) => {
  const c = needCalendar(ctx);
  if (!("s" in c)) return c;
  const { s, cal } = c as { s: ScheduleConfig; cal: CalendarProvider };
  const current = (await ctx.store.conversationMeetings(ctx.conversation.id)).find(
    (m) => m.status === "confirmed",
  );
  if (!current)
    return {
      __status: "error",
      status: "no_meeting",
      instruction: "Não há reunião desta conversa para cancelar.",
    };
  const del = await cal.deleteEvent(current.provider_event_id);
  if (!del.ok)
    return {
      __status: "error",
      status: "failed",
      instruction: "A agenda não confirmou o cancelamento; a reunião continua marcada.",
    };
  await ctx.store.updateMeeting(current.id, {
    status: "canceled",
    error: (a.reason as string | null) ?? null,
  });
  if (ctx.conversation.enrollmentId)
    await ctx.store.setEnrollment(ctx.conversation.enrollmentId, { meeting_status: "canceled" });
  await ctx.store.createActivity({
    workspace_id: ctx.workspaceId,
    owner_id: s.host_user_id,
    type: "note",
    subject: "Reunião cancelada pelo cliente (Agente SDR)",
    body: String(a.reason ?? ""),
    related_lead_id: ctx.conversation.leadId,
    related_contact_id: ctx.conversation.contactId,
    related_deal_id: ctx.conversation.dealId,
  });
  ctx.effects.meeting = {
    status: "canceled",
    start: Date.parse(current.start_at),
    timezone: s.timezone,
    meetLink: null,
  };
  return { status: "canceled" };
};

const lookup: Handler = async (ctx) => {
  const tz = ctx.scheduling?.timezone ?? "America/Sao_Paulo";
  const rows = (await ctx.store.conversationMeetings(ctx.conversation.id)).filter((m) =>
    ["confirmed", "pending", "reconcile"].includes(m.status),
  );
  return {
    meetings: rows.map((m) => ({
      when: formatSlotPt(Date.parse(m.start_at), tz),
      status: m.status === "confirmed" ? "confirmada" : "em confirmação",
    })),
  };
};

function e164(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 ? `+${d}` : null;
}
const nfd = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

const customerLookup: Handler = async (ctx, a) => {
  const email =
    typeof a.email === "string" && a.email.includes("@") ? a.email.trim().toLowerCase() : null;
  const phone = typeof a.phone === "string" ? e164(a.phone) : null;
  const name = typeof a.full_name === "string" ? nfd(a.full_name) : "";
  const [first, ...rest] = name ? name.split(" ") : [];
  if (!email && !phone && !(first && rest.length))
    return { status: "need_more", instruction: "Peça nome completo, e-mail ou telefone." };
  const candidates = await ctx.store.findCustomers({
    email,
    phoneVariants: phone ? brPhoneVariants(phone) : [],
    firstName: first && rest.length ? first : null,
    lastName: first && rest.length ? rest.join(" ") : null,
  });
  if (!candidates.length) return { status: "not_found" };
  if (candidates.length > 1)
    return {
      status: "ambiguous",
      instruction: "Há mais de um cadastro possível. Peça o e-mail corporativo; não cite nomes.",
    };
  const c = candidates[0]!;
  const convPhones = brPhoneVariants(ctx.conversation.phone);
  const linked = c.id === ctx.conversation.contactId || c.id === ctx.conversation.leadId;
  const verified = linked || c.phones.some((p) => convPhones.includes(p));
  if (!verified)
    return {
      status: "found_unverified",
      instruction:
        "Cadastro não pertence a este número. Não revele nem confirme dados; ofereça falar com uma pessoa.",
    };
  return {
    status: "found",
    kind: c.kind === "lead" ? "lead" : "contato",
    first_name: c.first_name,
  };
};

const contextRead: Handler = async (ctx) => {
  const c = ctx.conversation;
  if (!c.leadId && !c.contactId && !c.dealId && !c.companyId)
    return { status: "not_linked", instruction: "Conversa sem cliente vinculado no CRM." };
  return {
    status: "ok",
    ...(await ctx.store.crmContext({
      leadId: c.leadId,
      contactId: c.contactId,
      dealId: c.dealId,
      companyId: c.companyId,
    })),
  };
};

const qualification: Handler = async (ctx, a) => {
  const inbound = ctx.history.filter((m) => m.direction === "inbound");
  const { accepted, rejected } = acceptAnswers(ctx.questions, a.answers, inbound);
  ctx.effects.answers.push(...(a.answers as unknown[]));
  return {
    accepted: accepted.length,
    rejected,
    note: "A nota é calculada pelo sistema ao final do turno.",
  };
};

const kbSearch: Handler = async (ctx, a) => {
  const q = nfd(String(a.query)).toLowerCase();
  const terms = q.split(" ").filter((t) => t.length > 2);
  const hit = (txt: string) => {
    const t = nfd(txt).toLowerCase();
    return terms.length ? terms.every((x) => t.includes(x)) || t.includes(q) : t.includes(q);
  };
  const results: { source: string; title: string; excerpt: string }[] = [];
  for (const o of ctx.offers) {
    const txt = `${o.name} ${o.summary} ${o.commercial_notes ?? ""} ${(o.fit_signals ?? []).join(" ")}`;
    if (hit(txt))
      results.push({
        source: `catálogo:${o.offer_key}`,
        title: o.name,
        excerpt: `${o.summary} ${o.commercial_notes ?? ""}`.trim().slice(0, 400),
      });
  }
  for (const s of ctx.kbSources)
    if (hit(`${s.title} ${s.note}`))
      results.push({ source: "fonte do agente", title: s.title, excerpt: s.note.slice(0, 400) });
  for (const k of await ctx.store.searchKb(String(a.query)))
    results.push({ source: `base:${k.slug}`, title: k.title, excerpt: k.excerpt.slice(0, 400) });
  if (!results.length)
    return {
      status: "no_results",
      instruction: "Sem fonte aprovada. Não invente; diga que um especialista confirma.",
    };
  return {
    status: "ok",
    results: results.slice(0, 6),
    instruction: "Responda só com o que está nos trechos.",
  };
};

const catalogLookup: Handler = async (ctx, a) => {
  const q = a.query ? nfd(String(a.query)).toLowerCase() : "";
  const list = ctx.offers.filter(
    (o) => !q || nfd(`${o.name} ${o.summary}`).toLowerCase().includes(q),
  );
  return {
    offers: list.map((o) => ({
      key: o.offer_key,
      name: o.name,
      summary: o.summary,
      approved_facts: o.commercial_notes ?? null,
    })),
  };
};

const materialsFind: Handler = async (ctx, a) => {
  const q = a.query ? nfd(String(a.query)).toLowerCase() : "";
  return {
    materials: ctx.materials
      .filter((m) => !q || nfd(m.title).toLowerCase().includes(q))
      .map((m) => ({ id: m.id, title: m.title })),
  };
};

const materialsSend: Handler = async (ctx, a) => {
  if (!ctx.attachMaterials)
    return {
      __status: "error",
      status: "disabled",
      instruction: "Envio de links desligado neste agente; ofereça que um especialista envie.",
    };
  const m = ctx.materials.find((x) => x.id === a.material_id);
  if (!m)
    return {
      __status: "error",
      status: "not_allowed",
      instruction: "Material não aprovado para este agente.",
    };
  if (!ctx.effects.materialIds.includes(m.id)) ctx.effects.materialIds.push(m.id);
  return {
    status: "attached",
    title: m.title,
    instruction: "O sistema anexa o link; não escreva URL.",
  };
};

const handoff: Handler = async (ctx, a) => {
  ctx.effects.handoff = String(a.reason);
  return {
    status: "handoff_scheduled",
    instruction: "Avise que uma pessoa do time vai continuar a conversa.",
  };
};

const optout: Handler = async (ctx) => {
  ctx.effects.optOut = true;
  return { status: "opted_out", instruction: "Despeça-se em uma frase." };
};

const taskCreate: Handler = async (ctx, a) => {
  const owner = ctx.agentUserId ?? ctx.assigneeId;
  if (!owner) return { __status: "error", error: "Agente sem responsável." };
  const due = a.due_in_hours ? iso(ctx.now() + Number(a.due_in_hours) * 3600000) : null;
  await ctx.store.createActivity({
    workspace_id: ctx.workspaceId,
    owner_id: owner,
    assigned_to: owner,
    ...(ctx.agentUserId ? { created_by: ctx.agentUserId } : {}),
    type: "task",
    subject: String(a.title),
    body: (a.note as string | null) ?? null,
    due_date: due,
    related_lead_id: ctx.conversation.leadId,
    related_contact_id: ctx.conversation.contactId,
    related_company_id: ctx.conversation.companyId,
    related_deal_id: ctx.conversation.dealId,
  });
  return { status: "created" };
};

const summarize: Handler = async (ctx, a) => {
  const c = ctx.conversation;
  if (!c.leadId && !c.contactId && !c.dealId)
    return { __status: "error", status: "not_linked", error: "Conversa sem cliente vinculado." };
  await ctx.store.createActivity({
    workspace_id: ctx.workspaceId,
    owner_id: ctx.agentUserId ?? ctx.assigneeId ?? ctx.scheduling?.host_user_id ?? null,
    ...(ctx.agentUserId ? { assigned_to: ctx.agentUserId, created_by: ctx.agentUserId } : {}),
    type: "note",
    subject: "Resumo da conversa (Agente SDR)",
    body: String(a.summary),
    related_lead_id: c.leadId,
    related_contact_id: c.contactId,
    related_deal_id: c.dealId,
  });
  return { status: "saved" };
};

const tags: Handler = async (ctx, a) => {
  if (!ctx.conversation.enrollmentId)
    return { __status: "error", error: "Conversa sem atendimento do agente." };
  const allowed = new Set(ctx.config.allowed_tags.map((t) => t.toLowerCase()));
  const add = (a.add as string[]).filter((t) => allowed.has(t.toLowerCase()));
  const remove = new Set((a.remove as string[]).map((t) => t.toLowerCase()));
  const refused = [...(a.add as string[])].filter((t) => !allowed.has(t.toLowerCase()));
  const cur = await ctx.store.enrollmentTags(ctx.conversation.enrollmentId);
  const next = [...new Set([...cur, ...add])].filter(
    (t) => !remove.has(t.toLowerCase()) || !allowed.has(t.toLowerCase()),
  );
  await ctx.store.setEnrollment(ctx.conversation.enrollmentId, { tags: next });
  return { tags: next, refused };
};

const HANDLERS: Record<string, Handler> = {
  "calendar.availability": availability,
  "calendar.book": book,
  "calendar.reschedule": reschedule,
  "calendar.cancel": cancel,
  "calendar.lookup": lookup,
  "crm.customer.lookup": customerLookup,
  "crm.context.read": contextRead,
  "crm.qualification.update": qualification,
  "knowledge.search": kbSearch,
  "catalog.services.lookup": catalogLookup,
  "materials.find": materialsFind,
  "materials.send": materialsSend,
  "human.handoff": handoff,
  "optout.register": optout,
  "tasks.create": taskCreate,
  "conversation.summarize": summarize,
  "tags.update": tags,
};

/** Concilia reuniões incertas (tempo esgotado) sem recriar evento às cegas. */
export async function reconcileMeeting(
  store: ToolStore,
  cal: CalendarProvider,
  m: MeetingRow,
): Promise<"confirmed" | "failed" | "still_pending"> {
  const ev = await cal.getEvent(m.provider_event_id);
  if (!ev.ok) return "still_pending";
  if (ev.exists && !ev.cancelled) {
    await store.updateMeeting(m.id, { status: "confirmed", meet_link: ev.meetLink, error: null });
    return "confirmed";
  }
  await store.updateMeeting(m.id, {
    status: "failed",
    error: "Evento não encontrado no provedor após conciliação.",
  });
  return "failed";
}
