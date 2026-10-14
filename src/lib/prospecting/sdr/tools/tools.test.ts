// Aceites do agendamento direto e das ferramentas, com agenda falsa e banco
// em memória (sem evento real, sem mensagem real).
import { describe, expect, it } from "vitest";
import {
  exposedTools,
  parseToolConfig,
  TOOL_IDS,
  type ScheduleConfig,
  type ToolConfig,
} from "./catalog";
import { emptyEffects, executeTool, reconcileMeeting, type ToolCtx } from "./dispatcher";
import { FakeCalendar, MemoryStore } from "./memory";
import {
  evaluateSpecific,
  generateSlots,
  localParts,
  pickDiverse,
  windowsError,
  zonedToUtc,
  type Schedule,
} from "./scheduling";
import { buildOutgoingText } from "../outgoing";

const TZ = "America/Sao_Paulo";
// Segunda-feira 19/10/2026, 08:00 em São Paulo (11:00 UTC).
const NOW = Date.UTC(2026, 9, 19, 11, 0);
const WH = { start: "09:00", end: "17:00" };
const SCHED: ScheduleConfig = {
  host_user_id: "00000000-0000-4000-8000-0000000000a1",
  calendar_account_id: "00000000-0000-4000-8000-0000000000c1",
  duration_minutes: 30,
  timezone: TZ,
  working_hours: { mon: [WH], tue: [WH], wed: [WH], thu: [WH], fri: [WH] },
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 2,
  horizon_days: 14,
  holidays: [],
  video: "google_meet",
  meeting_title: "Reunião {empresa} <> WK Technology",
};
const ALL: ToolConfig = {
  enabled_tools: [...TOOL_IDS],
  scheduling: SCHED,
  allowed_tags: ["interessado"],
};
const sp = (y: number, m: number, d: number, h: number, mi = 0) => zonedToUtc(y, m, d, h, mi, TZ);

let evSeq = 0;
function makeCtx(over: Partial<ToolCtx> = {}, store = new MemoryStore(), cal = new FakeCalendar()) {
  const ctx: ToolCtx = {
    mode: "live",
    jobId: `job-${Math.random()}`,
    jobKind: "reply",
    workspaceId: "ws1",
    playbookId: "pb1",
    agentVersionId: "v1",
    conversation: {
      id: "conv1",
      phone: "+5548991104003",
      leadId: "lead1",
      contactId: null,
      companyId: null,
      dealId: null,
      campaignId: "camp1",
      enrollmentId: "enr1",
    },
    history: [
      {
        id: "tpl",
        direction: "outbound",
        body: "Template aprovado",
        created_at: "2026-10-19T10:00:00Z",
      },
      {
        id: "in1",
        direction: "inbound",
        body: "Quero conversar",
        created_at: "2026-10-19T10:59:00Z",
      },
    ],
    config: ALL,
    exposed: new Set(TOOL_IDS),
    scheduling: SCHED,
    calendar: cal,
    store,
    offers: [
      {
        offer_key: "outsourcing",
        name: "Outsourcing de TI",
        summary: "Profissionais alocados e geridos pela WK",
        commercial_notes: "Alocação em até 15 dias",
      },
    ],
    materials: [{ id: "mat1", title: "Apresentação Outsourcing" }],
    kbSources: [],
    attachMaterials: true,
    questions: [],
    assigneeId: "00000000-0000-4000-8000-0000000000a1",
    now: () => NOW,
    newEventId: () => `liaevent${++evSeq}`,
    effects: emptyEffects(),
    ...over,
  };
  return { ctx, store, cal };
}
const say = (ctx: ToolCtx, id: string, body = "ok") => {
  ctx.history = [
    ...ctx.history,
    { id, direction: "inbound", body, created_at: new Date(NOW).toISOString() },
  ];
  ctx.jobId = `job-${id}`;
  ctx.effects = emptyEffects(); // novo turno
};
const avail = (extra: Record<string, unknown> = {}) => ({
  date: null,
  time: null,
  timezone: null,
  part_of_day: null,
  rejected_previous: false,
  ...extra,
});
type Opt = { option: number; start: string; label: string };

describe("cálculo de horários", () => {
  const sch: Schedule = { ...SCHED, holidays: [] };
  it("3 opções cronológicas, turnos diferentes e ao menos 2 dias", () => {
    const picked = pickDiverse(generateSlots(sch, [], NOW), TZ, 3);
    expect(picked).toHaveLength(3);
    expect(picked.map((p) => p.start)).toEqual(
      [...picked.map((p) => p.start)].sort((a, b) => a - b),
    );
    const days = new Set(picked.map((p) => localParts(p.start, TZ).ymd));
    expect(days.size).toBeGreaterThanOrEqual(2);
    const turns = new Set(
      picked.map((p) => `${localParts(p.start, TZ).ymd}-${localParts(p.start, TZ).h < 12}`),
    );
    expect(turns.size).toBe(3);
  });
  it("antecedência mínima respeitada (nada antes das 10h de hoje)", () => {
    expect(generateSlots(sch, [], NOW)[0]!.start).toBe(sp(2026, 10, 19, 10));
  });
  it("buffer bloqueia horários colados a um compromisso", () => {
    const busy = [{ start: sp(2026, 10, 19, 11), end: sp(2026, 10, 19, 12) }];
    const slots = generateSlots(
      { ...sch, buffer_before_minutes: 15, buffer_after_minutes: 15 },
      busy,
      NOW,
    );
    expect(slots.some((s) => s.start === sp(2026, 10, 19, 10, 30))).toBe(false);
    expect(slots.some((s) => s.start === sp(2026, 10, 19, 12))).toBe(false);
    expect(slots.some((s) => s.start === sp(2026, 10, 19, 12, 30))).toBe(true);
  });
  it("feriado não oferece horários", () => {
    const slots = generateSlots({ ...sch, holidays: ["2026-10-20"] }, [], NOW);
    expect(slots.some((s) => localParts(s.start, TZ).ymd === "2026-10-20")).toBe(false);
  });
  it("menos de 3 horários: não inventa", () => {
    const one = {
      ...sch,
      horizon_days: 1,
      working_hours: { mon: [{ start: "16:00", end: "16:30" }] },
    };
    expect(pickDiverse(generateSlots(one, [], NOW), TZ, 3)).toHaveLength(1);
  });
  it("virada de horário de verão (Nova York, 01/11/2026) mantém 09:00 local", () => {
    const ny = {
      ...sch,
      timezone: "America/New_York",
      min_notice_hours: 0,
      working_hours: { mon: [WH], fri: [WH] },
    };
    const from = Date.UTC(2026, 9, 30, 4);
    const slots = generateSlots(ny, [], from, { fromYmd: "2026-11-02", toYmd: "2026-11-02" });
    expect(localParts(slots[0]!.start, "America/New_York").h).toBe(9);
    expect(new Date(slots[0]!.start).toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });
  it("pedido em outro fuso é convertido exatamente", () => {
    const r = evaluateSpecific(sch, [], NOW, {
      date: "2026-10-21",
      time: "09:00",
      timezone: "America/Manaus",
    });
    expect(r.status).toBe("free");
    if (r.status === "free") expect(localParts(r.slot.start, TZ).h).toBe(10);
  });
  it("data sem ano/inválida pede esclarecimento", () => {
    expect(
      evaluateSpecific(sch, [], NOW, { date: "21/10", time: "09:00", timezone: null }).status,
    ).toBe("invalid");
    expect(
      evaluateSpecific(sch, [], NOW, { date: "2026-02-30", time: null, timezone: null }).status,
    ).toBe("invalid");
  });
});

describe("fluxo template → inbound → Lia → agenda → reunião", () => {
  it("oferece 3 opções reais, cliente escolhe, revalida, marca e confirma com link de vídeo", async () => {
    const { ctx, store, cal } = makeCtx();
    const r = (await executeTool(ctx, "calendar.availability", avail(), "c1")) as {
      options: Opt[];
    };
    expect(r.options).toHaveLength(3);
    say(ctx, "in2", "Pode ser a segunda opção");
    const b = (await executeTool(
      ctx,
      "calendar.book",
      { option: 2, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    )) as Record<string, unknown>;
    expect(b.status).toBe("confirmed");
    expect(cal.calls.filter((c) => c === "freeBusy").length).toBeGreaterThanOrEqual(2); // consulta + revalidação
    expect(store.meetings[0]!.start_at).toBe(r.options[1]!.start);
    expect(store.meetings[0]!.status).toBe("confirmed");
    expect(store.activities[0]).toMatchObject({ type: "meeting", related_lead_id: "lead1" });
    expect(store.enrollments.get("enr1")).toMatchObject({
      meeting_status: "confirmed",
      commercial_stage: "meeting_booked",
    });
    const text = buildOutgoingText({
      reply: "Confirmado! https://wk.app/book/wk-30min",
      materials: [],
      meeting: ctx.effects.meeting,
    });
    expect(text).not.toMatch(/\/book\//);
    expect(text).toMatch(/Link da videoconferência: https:\/\/meet\.google\.com\//);
  });

  it("recusa: registra e pede dia e turno, sem novos horários", async () => {
    const { ctx, store } = makeCtx();
    const first = (await executeTool(ctx, "calendar.availability", avail(), "c1")) as {
      options: Opt[];
    };
    say(ctx, "in2", "nenhum desses");
    const ask = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ rejected_previous: true }),
      "c2",
    )) as { status: string; options: Opt[] };
    expect(ask.status).toBe("ask_preference");
    expect(ask.options).toHaveLength(0);
    expect((await store.rejectedStarts("conv1")).length).toBe(first.options.length);
    say(ctx, "in3", "à tarde");
    const pref = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ part_of_day: "afternoon" }),
      "c3",
    )) as { options: (Opt & { part_of_day: string })[] };
    expect(pref.options.length).toBeGreaterThan(0);
    expect(pref.options.every((o) => o.part_of_day === "afternoon")).toBe(true);
    const near = (x: string) =>
      first.options.some((f) => Math.abs(Date.parse(f.start) - Date.parse(x)) < 3600000);
    expect(pref.options.some((o) => near(o.start))).toBe(false);
  });

  it("nova consulta após opções mostradas registra a recusa mesmo sem pedido explícito", async () => {
    const { ctx, store } = makeCtx();
    const first = (await executeTool(ctx, "calendar.availability", avail(), "c1")) as {
      options: Opt[];
    };
    say(ctx, "in2", "prefiro outro dia, de manhã");
    const r = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ part_of_day: "morning" }),
      "c2",
    )) as { options: Opt[] };
    const firstStarts = new Set(first.options.map((o) => o.start));
    expect(r.options.some((o) => firstStarts.has(o.start))).toBe(false);
    expect((await store.rejectedStarts("conv1")).length).toBe(first.options.length);
  });

  it("dia e turno pedidos: só horários daquele turno no dia", async () => {
    const { ctx } = makeCtx();
    const r = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ date: "2026-10-22", part_of_day: "afternoon" }),
      "c1",
    )) as { options: (Opt & { part_of_day: string })[] };
    expect(r.options.length).toBeGreaterThan(0);
    expect(r.options.length).toBeLessThanOrEqual(3);
    for (const o of r.options) {
      expect(o.part_of_day).toBe("afternoon");
      expect(o.label).toContain("22/10/2026");
    }
  });

  it("turno sem horário no dia: mais próximo depois, no mesmo turno", async () => {
    const cal = new FakeCalendar();
    cal.externalBusy.push({
      start: Date.parse("2026-10-22T15:00:00Z"),
      end: Date.parse("2026-10-22T21:00:00Z"),
    });
    const { ctx } = makeCtx({}, new MemoryStore(), cal);
    const r = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ date: "2026-10-22", part_of_day: "afternoon" }),
      "c1",
    )) as { status: string; options: (Opt & { part_of_day: string })[] };
    expect(r.status).toBe("requested_part_unavailable_next");
    expect(r.options.length).toBeGreaterThan(0);
    for (const o of r.options) {
      expect(o.part_of_day).toBe("afternoon");
      expect(o.label).not.toContain("22/10/2026");
    }
  });

  it("dois períodos no dia: nenhum horário no intervalo entre eles", () => {
    const two = {
      ...SCHED,
      holidays: [],
      working_hours: {
        thu: [
          { start: "09:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ],
      },
    };
    const slots = generateSlots(two, [], NOW, { fromYmd: "2026-10-22", toYmd: "2026-10-22" });
    expect(slots.length).toBeGreaterThan(0);
    for (const x of slots) {
      const h = localParts(x.start, TZ).h;
      expect(h === 12).toBe(false);
    }
  });

  it("valida períodos: fim antes do início, sobreposição e limite", () => {
    expect(
      windowsError([
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ]),
    ).toBeNull();
    expect(windowsError([{ start: "12:00", end: "09:00" }])).toMatch(/fim/);
    expect(
      windowsError([
        { start: "09:00", end: "13:00" },
        { start: "12:00", end: "17:00" },
      ]),
    ).toMatch(/sobreposição/);
    expect(
      windowsError([
        { start: "09:00", end: "12:00" },
        { start: "", end: "" },
      ]),
    ).toMatch(/HH:MM/);
  });

  it("não marca opção criada no mesmo turno (cliente ainda não viu)", async () => {
    const { ctx, store } = makeCtx();
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    const b = await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in1" },
      "c2",
    );
    expect(b.status).toBe("option_not_current");
    expect(store.meetings).toHaveLength(0);
  });

  it("opção que não está entre as vigentes não marca", async () => {
    const { ctx, store } = makeCtx();
    say(ctx, "in2");
    const b = (await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c1",
    )) as Record<string, unknown>;
    expect(b.status).toBe("option_not_current");
    expect(store.meetings).toHaveLength(0);
  });

  it("data específica livre é aceita mesmo fora das 3 opções", async () => {
    const { ctx, store } = makeCtx();
    const r = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ date: "2026-10-22", time: "15:30" }),
      "c1",
    )) as { status: string; options: Opt[] };
    expect(r.status).toBe("requested_free");
    expect(r.options).toHaveLength(1);
    say(ctx, "in2", "fechado");
    await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    );
    expect(store.meetings[0]!.start_at).toBe(new Date(sp(2026, 10, 22, 15, 30)).toISOString());
  });

  it("data específica ocupada oferece alternativas do dia e posteriores", async () => {
    const busy = [{ start: sp(2026, 10, 22, 15), end: sp(2026, 10, 22, 16) }];
    const { ctx } = makeCtx({}, new MemoryStore(), new FakeCalendar(busy));
    const r = (await executeTool(
      ctx,
      "calendar.availability",
      avail({ date: "2026-10-22", time: "15:30" }),
      "c1",
    )) as { status: string; options: Opt[] };
    expect(r.status).toBe("requested_busy");
    expect(r.options.length).toBeGreaterThan(0);
    expect(r.options.every((o) => o.start >= new Date(sp(2026, 10, 22, 0)).toISOString())).toBe(
      true,
    );
  });

  it("agenda sem resposta não é tratada como livre", async () => {
    const cal = new FakeCalendar();
    cal.freeBusyFails = true;
    const { ctx } = makeCtx({}, new MemoryStore(), cal);
    const r = (await executeTool(ctx, "calendar.availability", avail(), "c1")) as Record<
      string,
      unknown
    >;
    expect(r.status).toBe("calendar_unavailable");
    expect(r.options).toBeUndefined();
  });

  it("horário ocupado entre a oferta e a reserva: revalidação recusa", async () => {
    const cal = new FakeCalendar();
    const { ctx, store } = makeCtx({}, new MemoryStore(), cal);
    const r = (await executeTool(ctx, "calendar.availability", avail(), "c1")) as {
      options: Opt[];
    };
    const s = Date.parse(r.options[0]!.start);
    cal.externalBusy.push({ start: s, end: s + 1800000 });
    say(ctx, "in2", "a primeira");
    const b = (await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    )) as Record<string, unknown>;
    expect(b.status).toBe("slot_taken");
    expect(store.meetings).toHaveLength(0);
  });
});

describe("concorrência e idempotência", () => {
  it("dois clientes no mesmo horário: só um reserva", async () => {
    const store = new MemoryStore();
    const cal = new FakeCalendar();
    const a = makeCtx({}, store, cal).ctx;
    const b = makeCtx(
      {
        conversation: {
          ...a.conversation,
          id: "conv2",
          phone: "+5511999990000",
          enrollmentId: "enr2",
        },
      },
      store,
      cal,
    ).ctx;
    const ra = (await executeTool(a, "calendar.availability", avail(), "a1")) as { options: Opt[] };
    const rb = (await executeTool(b, "calendar.availability", avail(), "b1")) as { options: Opt[] };
    expect(ra.options[0]!.start).toBe(rb.options[0]!.start);
    say(a, "ia");
    say(b, "ib");
    const [x, y] = await Promise.all([
      executeTool(
        a,
        "calendar.book",
        { option: 1, attendee_email: null, confirmation_message_id: "ia" },
        "a2",
      ),
      executeTool(
        b,
        "calendar.book",
        { option: 1, attendee_email: null, confirmation_message_id: "ib" },
        "b2",
      ),
    ]);
    const statuses = [x.status, y.status].sort();
    expect(statuses).toEqual(["confirmed", "slot_taken"]);
    expect([...cal.events.values()].filter((e) => !e.cancelled)).toHaveLength(1);
  });

  it("mesma chamada repetida (retry) não cria segundo evento", async () => {
    const { ctx, cal } = makeCtx();
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    say(ctx, "in2");
    const args = { option: 1, attendee_email: null, confirmation_message_id: "in2" };
    await executeTool(ctx, "calendar.book", args, "c2");
    await executeTool(ctx, "calendar.book", args, "c2");
    expect(cal.calls.filter((c) => c === "createEvent")).toHaveLength(1);
  });

  it("tempo esgotado: fica pendente, não confirma e concilia sem recriar", async () => {
    const { ctx, store, cal } = makeCtx();
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    say(ctx, "in2");
    cal.nextCreate = "timeout";
    const b = (await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    )) as Record<string, unknown>;
    expect(b.status).toBe("pending_confirmation");
    expect(store.meetings[0]!.status).toBe("reconcile");
    expect(
      buildOutgoingText({
        reply: "Estou confirmando",
        materials: [],
        meeting: ctx.effects.meeting,
      }),
    ).not.toMatch(/meet\.google/);
    expect(await reconcileMeeting(store, cal, store.meetings[0]!)).toBe("confirmed");
    expect(cal.calls.filter((c) => c === "createEvent")).toHaveLength(1);
  });

  it("nova tentativa do turno após tempo esgotado conclui a mesma reserva", async () => {
    const { ctx, store, cal } = makeCtx();
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    say(ctx, "in2");
    cal.nextCreate = "timeout";
    await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    );
    ctx.jobId = "job-retry";
    const again = (await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c9",
    )) as Record<string, unknown>;
    expect(again.status).toBe("confirmed");
    expect(store.meetings).toHaveLength(1);
    expect(cal.calls.filter((c) => c === "createEvent")).toHaveLength(1);
  });

  it("falha definitiva libera o horário e não confirma", async () => {
    const { ctx, store, cal } = makeCtx();
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    say(ctx, "in2");
    cal.nextCreate = "fail";
    const b = (await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    )) as Record<string, unknown>;
    expect(b.status).toBe("failed");
    expect(store.meetings[0]!.status).toBe("failed");
    expect(ctx.effects.meeting?.status).toBe("failed");
  });
});

describe("cancelar e remarcar", () => {
  async function booked() {
    const env = makeCtx();
    await executeTool(env.ctx, "calendar.availability", avail(), "c1");
    say(env.ctx, "in2");
    await executeTool(
      env.ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c2",
    );
    return env;
  }
  it("cancelar exige confirmação da mensagem atual", async () => {
    const { ctx, store, cal } = await booked();
    say(ctx, "in3", "quero cancelar");
    const denied = await executeTool(
      ctx,
      "calendar.cancel",
      { reason: null, confirmation_message_id: "in2" },
      "c3",
    );
    expect(String(denied.error)).toMatch(/Confirmação/);
    expect(store.meetings[0]!.status).toBe("confirmed");
    const ok = await executeTool(
      ctx,
      "calendar.cancel",
      { reason: "Imprevisto", confirmation_message_id: "in3" },
      "c4",
    );
    expect(ok.status).toBe("canceled");
    expect(cal.calls).toContain("deleteEvent");
  });
  it("remarca para opção vigente movendo o mesmo evento", async () => {
    const { ctx, store, cal } = await booked();
    const r = (await executeTool(ctx, "calendar.availability", avail(), "c5")) as {
      options: Opt[];
    };
    say(ctx, "in4", "pode ser a terceira");
    const ok = await executeTool(
      ctx,
      "calendar.reschedule",
      { option: 3, confirmation_message_id: "in4" },
      "c6",
    );
    expect(ok.status).toBe("rescheduled");
    expect(store.meetings[0]!.start_at).toBe(r.options[2]!.start);
    expect(cal.calls).toContain("moveEvent");
    expect(cal.calls.filter((c) => c === "createEvent")).toHaveLength(1);
  });
  it("não cancela reunião de outra conversa", async () => {
    const { store, cal } = await booked();
    const other = makeCtx(
      {
        conversation: {
          id: "conv-x",
          phone: "+5511911112222",
          leadId: null,
          contactId: null,
          companyId: null,
          dealId: null,
          campaignId: null,
          enrollmentId: null,
        },
      },
      store,
      cal,
    ).ctx;
    say(other, "ox");
    const r = await executeTool(
      other,
      "calendar.cancel",
      { reason: null, confirmation_message_id: "ox" },
      "x1",
    );
    expect(r.status).toBe("no_meeting");
    expect(store.meetings[0]!.status).toBe("confirmed");
    const look = (await executeTool(other, "calendar.lookup", {}, "x2")) as { meetings: unknown[] };
    expect(look.meetings).toHaveLength(0);
  });
});

describe("permissões e escopo", () => {
  it("ferramenta desligada não executa", async () => {
    const { ctx, store } = makeCtx({ exposed: new Set(["calendar.availability"]) });
    say(ctx, "in2");
    const r = await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in2" },
      "c1",
    );
    expect(String(r.error)).toMatch(/desligada/);
    expect(store.meetings).toHaveLength(0);
  });
  it("só ferramentas ligadas e prontas são expostas; sem agenda pronta não há agendamento", () => {
    const facts = {
      calendar: { ok: false, reason: "sem agenda" },
      crmLinked: true,
      questionnaire: false,
      materials: true,
      assignee: true,
    };
    const ids = exposedTools(ALL, facts).map((d) => d.id);
    expect(ids).not.toContain("calendar.book");
    expect(ids).not.toContain("web.fetch");
    expect(ids).toContain("knowledge.search");
    expect(exposedTools(null, facts)).toHaveLength(0);
  });
  it("configuração inválida não liga nada", () => {
    expect(parseToolConfig({ enabled_tools: "tudo" })).toBeNull();
    expect(
      parseToolConfig({ enabled_tools: ["exec.sql", "calendar.lookup"] })?.enabled_tools,
    ).toEqual(["calendar.lookup"]);
  });
  it("retomada automática (sem mensagem do cliente) não marca reunião", async () => {
    const { ctx, store } = makeCtx({ jobKind: "follow_up" });
    await executeTool(ctx, "calendar.availability", avail(), "c1");
    const r = await executeTool(
      ctx,
      "calendar.book",
      { option: 1, attendee_email: null, confirmation_message_id: "in1" },
      "c2",
    );
    expect(String(r.error)).toMatch(/só respondem/);
    expect(store.meetings).toHaveLength(0);
  });
  it("descadastro registra efeito e exige a mensagem atual", async () => {
    const { ctx } = makeCtx();
    await executeTool(ctx, "optout.register", { confirmation_message_id: "tpl" }, "c1");
    expect(ctx.effects.optOut).toBe(false);
    await executeTool(ctx, "optout.register", { confirmation_message_id: "in1" }, "c2");
    expect(ctx.effects.optOut).toBe(true);
  });
  it("pedido de humano registra transferência", async () => {
    const { ctx } = makeCtx();
    await executeTool(
      ctx,
      "human.handoff",
      { reason: "Cliente pediu para falar com pessoa" },
      "c1",
    );
    expect(ctx.effects.handoff).toMatch(/pessoa/);
  });
  it("etiqueta fora da lista permitida é recusada", async () => {
    const { ctx, store } = makeCtx();
    const r = (await executeTool(
      ctx,
      "tags.update",
      { add: ["interessado", "vip"], remove: [] },
      "c1",
    )) as { tags: string[]; refused: string[] };
    expect(r.tags).toEqual(["interessado"]);
    expect(r.refused).toEqual(["vip"]);
    expect(store.enrollments.get("enr1")?.tags).toEqual(["interessado"]);
  });
  it("material só com envio ligado e da lista aprovada", async () => {
    const { ctx } = makeCtx({ attachMaterials: false });
    const r = await executeTool(
      ctx,
      "materials.send",
      { material_id: "mat1", confirmation_message_id: "in1" },
      "c1",
    );
    expect(r.status).toBe("disabled");
    const { ctx: c2 } = makeCtx();
    const r2 = await executeTool(
      c2,
      "materials.send",
      { material_id: "outro", confirmation_message_id: "in1" },
      "c1",
    );
    expect(r2.status).toBe("not_allowed");
  });
});

describe("identificação do cliente sem vazamento", () => {
  const base = { last_name: "Kologeski", email: "g@wk.com.br" };
  it("cliente ambíguo não revela ninguém", async () => {
    const { ctx, store } = makeCtx();
    store.customers = [
      { kind: "lead", id: "a", first_name: "Ana", last_name: "Souza", email: null, phones: [] },
      { kind: "contact", id: "b", first_name: "Ana", last_name: "Souza", email: null, phones: [] },
    ];
    const r = await executeTool(
      ctx,
      "crm.customer.lookup",
      { full_name: "Ana Souza", email: null, phone: null },
      "c1",
    );
    expect(r.status).toBe("ambiguous");
    expect(JSON.stringify(r)).not.toMatch(/Ana/);
  });
  it("cadastro de outro número não é confirmado", async () => {
    const { ctx, store } = makeCtx();
    store.customers = [
      { kind: "contact", id: "x", first_name: "Guilherme", ...base, phones: ["+5511999990000"] },
    ];
    const r = await executeTool(
      ctx,
      "crm.customer.lookup",
      { full_name: null, email: "G@WK.com.br", phone: null },
      "c1",
    );
    expect(r.status).toBe("found_unverified");
    expect(JSON.stringify(r)).not.toMatch(/Guilherme/);
  });
  it("cadastro do próprio número (com ou sem 9º dígito) é reconhecido", async () => {
    const { ctx, store } = makeCtx();
    store.customers = [
      { kind: "contact", id: "x", first_name: "Guilherme", ...base, phones: ["+554891104003"] },
    ];
    const r = await executeTool(
      ctx,
      "crm.customer.lookup",
      { full_name: null, email: "g@wk.com.br", phone: null },
      "c1",
    );
    expect(r).toMatchObject({ status: "found", first_name: "Guilherme" });
  });
  it("nome parcial não procura por termo solto", async () => {
    const { ctx } = makeCtx();
    const r = await executeTool(
      ctx,
      "crm.customer.lookup",
      { full_name: "Silva", email: null, phone: null },
      "c1",
    );
    expect(r.status).toBe("need_more");
  });
  it("conhecimento sem fonte não inventa", async () => {
    const { ctx } = makeCtx();
    const r = await executeTool(ctx, "knowledge.search", { query: "certificação ISO 27001" }, "c1");
    expect(r.status).toBe("no_results");
    const ok = (await executeTool(ctx, "knowledge.search", { query: "outsourcing" }, "c2")) as {
      results: { source: string }[];
    };
    expect(ok.results[0]!.source).toBe("catálogo:outsourcing");
  });
});

describe("modo simulado", () => {
  it("toda saída do sandbox é marcada como simulada", async () => {
    const { ctx } = makeCtx({ mode: "sandbox" });
    const r = await executeTool(ctx, "calendar.availability", avail(), "c1");
    expect(r.simulated).toBe(true);
  });
});
