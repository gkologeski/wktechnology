// Testes de orquestração do SDR com banco em memória e provedores simulados.
// Não chamam IA, WhatsApp nem Google reais.
import { beforeEach, describe, expect, it, vi } from "vitest";

const metaSend = vi.fn();
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  isWithinServiceWindow: (t: string | null) =>
    !!t && Date.now() - new Date(t).getTime() < 86400_000,
  resolveWaNumber: async () => ({ displayPhoneNumber: "5511900000000", phoneNumberId: "pn1" }),
  metaSend: (...a: unknown[]) => metaSend(...a),
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({ aiChatFetch: vi.fn() }));
vi.mock("@/lib/scoring/icp.server", () => ({
  computeIcpFit: () => ({ points: 0, max: 0, percent: null, matched: [], level: "unknown" }),
}));

import { FakeDb } from "./test-fake-db";
import { processJob, tickSdr, type WorkerDeps } from "./worker.server";
import { ingestInboundForSdr } from "./ingest.server";
import { sendSdrMessage } from "./actions.server";

const W1 = "11111111-1111-4111-8111-111111111111";
const W2 = "22222222-2222-4222-8222-222222222222";
const Q = {
  budget: "aaaaaaaa-0000-4000-8000-000000000001",
  need: "aaaaaaaa-0000-4000-8000-000000000002",
};

function seed(db: FakeDb) {
  db.unique.sdr_turn_jobs = ["workspace_id", "idem_key"];
  db.t("sdr_workspace_settings").push({
    workspace_id: W1,
    enabled: true,
    auto_send_enabled: false,
    daily_send_limit: 50,
    timezone: "America/Sao_Paulo",
    quiet_hours_start: 0,
    quiet_hours_end: 0,
  });
  db.t("sdr_playbooks").push({
    id: "pb1",
    workspace_id: W1,
    enabled: true,
    mode: "supervised",
    questionnaire_id: "qn1",
    booking_page_id: null,
    opportunity_min_score: 40,
    follow_up_hours: 24,
    max_follow_ups: 2,
    opt_out_phrases: [],
  });
  db.t("prospecting_questions").push(
    {
      id: Q.budget,
      workspace_id: W1,
      questionnaire_id: "qn1",
      position: 0,
      label: "Budget",
      type: "single",
      required: true,
      weight: 1,
      options: [
        { label: "Sim, aprovado", points: 25 },
        { label: "Não", points: 0 },
      ],
    },
    {
      id: Q.need,
      workspace_id: W1,
      questionnaire_id: "qn1",
      position: 1,
      label: "Need",
      type: "single",
      required: true,
      weight: 1,
      options: [{ label: "Alta demanda de desenvolvimento", points: 25 }],
    },
  );
  db.t("sdr_offers").push({
    id: "o1",
    workspace_id: W1,
    offer_key: "outsourcing",
    name: "Outsourcing de TI",
    status: "active",
    approved_at: "2026-01-01",
    summary: "",
    fit_signals: [],
    discovery_questions: [],
    commercial_notes: "",
    pricing_policy: "",
    position: 0,
  });
  db.t("whatsapp_conversations").push({
    id: "c1",
    workspace_id: W1,
    ai_owner: "ai",
    ai_version: 1,
    sdr_enrollment_id: "e1",
    contact_phone: "5511988887777",
    last_inbound_at: new Date().toISOString(),
    lead_id: "L1",
    contact_id: null,
  });
  db.t("sdr_enrollments").push({
    id: "e1",
    workspace_id: W1,
    owner_id: "u1",
    playbook_id: "pb1",
    conversation_id: "c1",
    status: "active",
    commercial_stage: "awaiting_reply",
    lead_id: "L1",
    contact_id: null,
    deal_id: null,
    offers: [],
    follow_up_count: 0,
    // Padrões do banco (0184).
    conversation_state: {},
    conversation_state_version: 0,
  });
  db.t("leads").push({ id: "L1", workspace_id: W1, company_id: null });
  db.t("whatsapp_messages").push({
    id: "m1",
    conversation_id: "c1",
    workspace_id: W1,
    direction: "inbound",
    wa_message_id: "wamid.in1",
    body: "Temos orçamento sim, aprovado. Alta demanda de desenvolvimento aqui.",
    created_at: "2026-10-06T10:00:00Z",
  });
}

function job(db: FakeDb, extra: Record<string, unknown> = {}) {
  const j = {
    id: `j${db.t("sdr_turn_jobs").length + 1}`,
    workspace_id: W1,
    enrollment_id: "e1",
    conversation_id: "c1",
    kind: "reply",
    inbound_message_id: "m1",
    status: "queued",
    attempts: 0,
    conversation_version: 1,
    idem_key: `k${Math.random()}`,
    created_at: new Date(Date.now() + db.t("sdr_turn_jobs").length).toISOString(),
    ...extra,
  };
  db.t("sdr_turn_jobs").push(j);
  return j;
}

async function claimOne(db: FakeDb) {
  const { data } = await db.rpc("sdr_claim_jobs", { p_limit: 10, p_lease_seconds: 120 });
  return data[0];
}

const goodAnswers = [
  {
    question_id: Q.budget,
    value: "Sim, aprovado",
    message_id: "m1",
    excerpt: "orçamento sim, aprovado",
  },
  {
    question_id: Q.need,
    value: "Alta demanda de desenvolvimento",
    message_id: "m1",
    excerpt: "Alta demanda de desenvolvimento",
  },
];

function deps(output: unknown, over: Partial<WorkerDeps> = {}) {
  return {
    callAgent: vi.fn(async () => ({ ok: true as const, output })),
    ensureOpportunity: vi.fn(async () => "deal1"),
    handoffToHuman: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => ({ ok: true as const, wamid: "w" })),
    ...over,
  } as unknown as WorkerDeps & Record<string, ReturnType<typeof vi.fn>>;
}

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  seed(db);
  metaSend.mockReset();
});

describe("entrada (ingest)", () => {
  const p = {
    workspaceId: W1,
    conversationId: "c1",
    messageId: "m1",
    waMessageId: "wamid.1",
    providerPhoneId: "pn1",
    body: "Olá",
  };
  it("webhook repetido enfileira uma única vez", async () => {
    expect(await ingestInboundForSdr(db, p)).toBe("queued");
    expect(await ingestInboundForSdr(db, p)).toBe("duplicate");
    expect(db.t("sdr_turn_jobs")).toHaveLength(1);
  });
  it("isolamento: outro workspace não aciona a conversa", async () => {
    expect(await ingestInboundForSdr(db, { ...p, workspaceId: W2 })).toBe("not_sdr");
    expect(db.t("sdr_turn_jobs")).toHaveLength(0);
  });
  it("recusa com a Lia atendendo vai para o turno (que confirma ao cliente)", async () => {
    expect(await ingestInboundForSdr(db, { ...p, body: "não tenho interesse" })).toBe("queued");
    expect(db.find("sdr_enrollments", "e1")?.status).toBe("active");
  });
  it("pedido explícito de parar sem a Lia atendendo descadastra sem enfileirar", async () => {
    db.t("sdr_workspace_settings")[0].enabled = false;
    expect(await ingestInboundForSdr(db, { ...p, body: "pare de me mandar mensagem" })).toBe(
      "opted_out",
    );
    expect(db.find("sdr_enrollments", "e1")?.status).toBe("opted_out");
    expect(db.t("sdr_turn_jobs")).toHaveLength(0);
  });
  it("recusa comercial sem a Lia atendendo não descadastra permanentemente", async () => {
    db.t("sdr_workspace_settings")[0].enabled = false;
    expect(await ingestInboundForSdr(db, { ...p, body: "não quero reunião" })).toBe("disabled");
    expect(db.find("sdr_enrollments", "e1")?.status).toBe("active");
  });
});

describe("concorrência", () => {
  it("dois workers na mesma conversa: só um trabalho em execução", async () => {
    job(db);
    job(db);
    const [a, b] = await Promise.all([
      db.rpc("sdr_claim_jobs", { p_limit: 10, p_lease_seconds: 120 }),
      db.rpc("sdr_claim_jobs", { p_limit: 10, p_lease_seconds: 120 }),
    ]);
    expect(a.data.length + b.data.length).toBe(1);
    expect(db.t("sdr_turn_jobs").filter((j) => j.status === "running")).toHaveLength(1);
  });

  it("humano assume enquanto a IA calcula: nada é gravado nem enviado", async () => {
    job(db);
    const j = await claimOne(db);
    const d = deps(null, {
      callAgent: vi.fn(async () => {
        await db.rpc("sdr_set_conversation_owner", { p_conversation: "c1", p_owner: "human" });
        return {
          ok: true as const,
          output: {
            reply: "Oi",
            intent: "continue",
            offer_keys: ["outsourcing"],
            material_ids: [],
            answers: goodAnswers,
            handoff_reason: "",
          },
        };
      }),
    });
    expect(await processJob(db, j, d)).toBe("discarded");
    expect(db.t("prospecting_qualifications")).toHaveLength(0);
    expect(db.t("sdr_qualification_evidence")).toHaveLength(0);
    expect(db.find("sdr_enrollments", "e1")?.offers).toEqual([]);
    expect(d.ensureOpportunity).not.toHaveBeenCalled();
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(db.find("sdr_turn_jobs", j.id)?.status).toBe("discarded");
  });

  it("qualificação alterada por humano durante o turno: compare-and-set descarta", async () => {
    db.t("prospecting_qualifications").push({
      id: "pq1",
      workspace_id: W1,
      questionnaire_id: "qn1",
      entity: "lead",
      entity_id: "L1",
      answers: {},
      updated_at: "2026-10-01T00:00:00Z",
      decision: "pending",
    });
    job(db);
    const j = await claimOne(db);
    db.hooks.beforeCommit = () => {
      db.find("prospecting_qualifications", "pq1")!.updated_at = "2026-10-06T12:00:00Z";
    };
    const d = deps({
      reply: "Ok",
      intent: "continue",
      offer_keys: [],
      material_ids: [],
      answers: goodAnswers,
      handoff_reason: "",
    });
    expect(await processJob(db, j, d)).toBe("discarded");
    expect(db.find("prospecting_qualifications", "pq1")?.answers).toEqual({});
  });
});

describe("qualificação canônica", () => {
  it("grava na mesma qualificação da Prospecção com nota do servidor e ignora score da IA", async () => {
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Perfeito",
      intent: "continue",
      offer_keys: ["outsourcing"],
      material_ids: [],
      answers: goodAnswers,
      score: 100,
      handoff_reason: "",
    });
    expect(await processJob(db, j, d)).toBe("drafted");
    const [q] = db.t("prospecting_qualifications");
    expect(q).toMatchObject({
      entity: "lead",
      entity_id: "L1",
      questionnaire_id: "qn1",
      decision: "pending",
      score: 50,
    });
    expect(q.answers).toEqual({
      [Q.budget]: "Sim, aprovado",
      [Q.need]: "Alta demanda de desenvolvimento",
    });
    expect(q.total_score).toBe(50); // sem ICP configurado: teto de 50
    expect(db.find("sdr_enrollments", "e1")?.qualification_score).toBe(50);
    expect(
      db
        .t("sdr_qualification_evidence")
        .map((e) => e.question_id)
        .sort(),
    ).toEqual([Q.budget, Q.need].sort());
    expect(d.ensureOpportunity).toHaveBeenCalledTimes(1);
  });

  it("rejeita trecho inventado e opção inexistente; sem nota mínima não cria negócio", async () => {
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Ok",
      intent: "continue",
      offer_keys: ["outsourcing"],
      material_ids: [],
      handoff_reason: "",
      answers: [
        {
          question_id: Q.budget,
          value: "Sim, aprovado",
          message_id: "m1",
          excerpt: "orçamento de 1 milhão",
        },
        { question_id: Q.need, value: "Outra dor", message_id: "m1", excerpt: "Alta demanda" },
      ],
    });
    await processJob(db, j, d);
    expect(db.t("prospecting_qualifications")).toHaveLength(0);
    expect(d.ensureOpportunity).not.toHaveBeenCalled();
    expect(db.find("sdr_turn_jobs", j.id)?.draft_payload.warnings.length).toBeGreaterThan(0);
  });

  it("resposta humana existente prevalece sobre a da IA", async () => {
    db.t("prospecting_qualifications").push({
      id: "pq1",
      workspace_id: W1,
      questionnaire_id: "qn1",
      entity: "lead",
      entity_id: "L1",
      answers: { [Q.budget]: "Não" },
      updated_at: "2026-10-01T00:00:00Z",
      decision: "qualified",
    });
    job(db);
    const j = await claimOne(db);
    await processJob(
      db,
      j,
      deps({
        reply: "Ok",
        intent: "continue",
        offer_keys: ["outsourcing"],
        material_ids: [],
        answers: goodAnswers,
        handoff_reason: "",
      }),
    );
    const q = db.find("prospecting_qualifications", "pq1")!;
    expect(q.answers[Q.budget]).toBe("Não");
    expect(q.answers[Q.need]).toBe("Alta demanda de desenvolvimento");
    expect(q.decision).toBe("qualified");
    expect(db.t("prospecting_qualifications")).toHaveLength(1);
  });
});

describe("recusa, falhas e desligado", () => {
  it("pedido explícito de parar: confirmação vem da IA e o descadastro é permanente", async () => {
    db.find("whatsapp_messages", "m1")!.body = "Por favor, pare de me mandar mensagens.";
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Combinado, não vou mais te escrever. Desculpe o incômodo!",
      intent: "continue",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
    });
    await processJob(db, j, d);
    const e = db.find("sdr_enrollments", "e1")!;
    expect(e.status).toBe("opted_out");
    expect(e.opted_out_at).toBeTruthy();
    expect(db.find("whatsapp_conversations", "c1")?.ai_owner).toBe("paused");
    // Texto é o da IA (persona), não uma frase fixa do código.
    expect(db.find("sdr_turn_jobs", j.id)?.draft_text).toBe(
      "Combinado, não vou mais te escrever. Desculpe o incômodo!",
    );
    expect(d.handoffToHuman).not.toHaveBeenCalled();
  });

  it("opt_out do modelo sem pedido explícito vira encerramento, não descadastro", async () => {
    db.t("sdr_workspace_settings")[0].auto_send_enabled = true;
    db.find("sdr_playbooks", "pb1")!.mode = "auto";
    db.find("whatsapp_messages", "m1")!.body = "Não quero reunião agora.";
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Sem problema, obrigada pela atenção!",
      intent: "opt_out",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
    });
    await processJob(db, j, d);
    const e = db.find("sdr_enrollments", "e1")!;
    expect(e.status).toBe("paused");
    expect(e.cancel_reason).toBe("declined");
    expect(e.opted_out_at).toBeFalsy();
    expect(e.follow_up_at).toBeNull();
    expect(e.conversation_state.closed.reason).toBe("declined");
  });

  it("erro transitório da IA volta à fila; erro definitivo falha e registra", async () => {
    job(db);
    let j = await claimOne(db);
    await processJob(
      db,
      j,
      deps(null, {
        callAgent: vi.fn(async () => ({
          ok: false as const,
          status: 500,
          error: "500",
          retryable: true,
        })),
      }),
    );
    expect(db.find("sdr_turn_jobs", j.id)?.status).toBe("queued");
    db.find("sdr_turn_jobs", j.id)!.lease_until = null;
    j = await claimOne(db);
    await processJob(
      db,
      j,
      deps(null, {
        callAgent: vi.fn(async () => ({
          ok: false as const,
          status: 403,
          error: "403",
          retryable: false,
        })),
      }),
    );
    expect(db.find("sdr_turn_jobs", j.id)?.status).toBe("failed");
    expect(db.t("sdr_actions").some((a) => a.kind === "ai_paused")).toBe(true);
  });

  it("falha do WhatsApp na aprovação não confirma envio", async () => {
    job(db, { status: "drafted", draft_payload: {} });
    metaSend.mockRejectedValue(Object.assign(new Error("Meta 400"), { status: 400 }));
    const r = await sendSdrMessage(db, {
      jobId: "j1",
      expectedStatus: "drafted",
      text: "Oi",
      actorUserId: "u1",
    });
    expect(r).toMatchObject({ ok: false, reason: "provider_failed" });
    expect(db.find("sdr_turn_jobs", "j1")?.status).toBe("failed");
    expect(
      db.t("sdr_actions").filter((a) => a.kind === "message_sent" && a.status === "success"),
    ).toHaveLength(0);
    expect(db.t("whatsapp_messages").filter((m) => m.direction === "outbound")).toHaveLength(0);
  });

  it("aprovação após humano assumir é recusada sem chamar a Meta", async () => {
    job(db, { status: "drafted", draft_payload: {} });
    db.find("whatsapp_conversations", "c1")!.ai_owner = "human";
    const r = await sendSdrMessage(db, {
      jobId: "j1",
      expectedStatus: "drafted",
      text: "Oi",
      actorUserId: "u1",
    });
    expect(r).toMatchObject({ ok: false, reason: "owner_not_ai" });
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("rotina sem workspace ligado não faz nada", async () => {
    db.t("sdr_workspace_settings")[0].enabled = false;
    job(db);
    const d = deps({});
    expect(await tickSdr(db, 10, d)).toEqual({ disabled: true, claimed: 0 });
    expect(d.callAgent).not.toHaveBeenCalled();
    expect(db.t("sdr_turn_jobs")[0].status).toBe("queued");
  });
});

describe("homologação sintética ponta a ponta (provedores simulados)", () => {
  it("inbound → turno → qualificação canônica → oportunidade → envio aprovado → recusa encerra", async () => {
    // 1) resposta ao template entra uma vez na fila
    expect(
      await ingestInboundForSdr(db, {
        workspaceId: W1,
        conversationId: "c1",
        messageId: "m1",
        waMessageId: "wamid.e2e",
        providerPhoneId: "pn1",
        body: "Temos orçamento sim, aprovado.",
      }),
    ).toBe("queued");
    // O banco real aplica os defaults da fila; o fake recebe-os aqui.
    Object.assign(db.t("sdr_turn_jobs")[0], {
      status: db.t("sdr_turn_jobs")[0].status ?? "queued",
      attempts: 0,
      lease_until: null, // tempo de aguardo do cliente já transcorrido
      created_at: new Date().toISOString(),
    });
    // 2) turno supervisionado: rascunho + qualificação do servidor + oportunidade
    const j = await claimOne(db);
    const d = deps({
      reply: "Que bom! Posso te enviar nosso material?",
      intent: "continue",
      offer_keys: ["outsourcing"],
      material_ids: [],
      answers: goodAnswers,
      handoff_reason: "",
    });
    expect(await processJob(db, j, d)).toBe("drafted");
    expect(db.t("prospecting_qualifications")[0].total_score).toBe(50);
    expect(d.ensureOpportunity).toHaveBeenCalledTimes(1);
    // 3) humano aprova; envio só conta como feito após sucesso da Meta simulada
    metaSend.mockResolvedValue({ wamid: "wamid.out", raw: {} });
    const sent = await sendSdrMessage(db, {
      jobId: j.id,
      expectedStatus: "drafted",
      text: "Que bom! Posso te enviar nosso material?",
      actorUserId: "u1",
    });
    expect(sent).toMatchObject({ ok: true, wamid: "wamid.out" });
    expect(metaSend).toHaveBeenCalledTimes(1);
    // 4) cliente recusa: encerra sem novo envio
    db.t("whatsapp_messages").push({
      id: "m2",
      conversation_id: "c1",
      workspace_id: W1,
      direction: "inbound",
      body: "Não tenho interesse, pare de mandar.",
      created_at: "2026-10-06T11:00:00Z",
    });
    const j2 = job(db);
    const c2 = await claimOne(db);
    expect(c2.id).toBe(j2.id);
    const d2 = deps({
      reply: "Entendido, obrigado.",
      intent: "opt_out",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
    });
    // Envio manual (sem envio automático): a confirmação vira rascunho, mas o opt-out já vale.
    expect(await processJob(db, c2, d2)).toBe("drafted");
    expect(db.find("sdr_enrollments", "e1")).toMatchObject({
      status: "opted_out",
      follow_up_at: null,
    });
    expect(d2.handoffToHuman).not.toHaveBeenCalled();
    expect(metaSend).toHaveBeenCalledTimes(1);
  });
});

describe("rascunho superado", () => {
  it("rascunho anterior a uma resposta já enviada não é enviado", async () => {
    const a = job(db, { status: "drafted", draft_payload: {}, created_at: "2026-01-01T10:00:00Z" });
    db.t("whatsapp_messages").push({
      id: "o1",
      conversation_id: "c1",
      direction: "outbound",
      created_at: "2026-01-01T10:05:00Z",
      wa_message_id: "wamid.later",
      raw: {},
    });
    const r = await sendSdrMessage(db, {
      jobId: a.id,
      expectedStatus: "drafted",
      text: "Oi",
      actorUserId: "u1",
    });
    expect(r).toMatchObject({ ok: false, reason: "stale_version" });
    expect(metaSend).not.toHaveBeenCalled();
  });
});

describe("três políticas de envio", () => {
  const settings = () => db.t("sdr_workspace_settings")[0];
  let seq = 0;
  const base = Date.now();
  /** Nova mensagem recebida real + turno de resposta derivado dela. */
  function inboundTurn(i: number, extra: Record<string, unknown> = {}) {
    const mid = `in${++seq}`;
    db.t("whatsapp_messages").push({
      id: mid,
      conversation_id: "c1",
      workspace_id: W1,
      direction: "inbound",
      wa_message_id: `wamid.${mid}`,
      body: `mensagem ${i}`,
      created_at: new Date(base + 10_000 + i * 1000).toISOString(),
    });
    return job(db, {
      status: "running",
      lease_token: `L${mid}`,
      inbound_message_id: mid,
      created_at: new Date(base + 10_000 + i * 1000 + 1).toISOString(),
      ...extra,
    });
  }
  const sendAuto = (j: { id: string; lease_token?: unknown }, text: string) =>
    sendSdrMessage(db, {
      jobId: j.id,
      expectedStatus: "running",
      leaseToken: j.lease_token as string,
      text,
      actorUserId: null,
    });
  function followUp(extra: Record<string, unknown> = {}) {
    return job(db, {
      kind: "follow_up",
      inbound_message_id: null,
      status: "running",
      lease_token: `F${++seq}`,
      created_at: new Date(base + 500_000 + seq).toISOString(),
      ...extra,
    });
  }
  function confirmedFollowUp(wamid: string) {
    const j = job(db, {
      kind: "follow_up",
      inbound_message_id: null,
      status: "sent",
      created_at: new Date(base - 3600_000).toISOString(),
    });
    db.t("sdr_actions").push({
      id: `a-${wamid}`,
      workspace_id: W1,
      job_id: j.id,
      kind: "message_sent",
      status: "success",
      provider_ref: wamid,
      created_at: new Date().toISOString(),
    });
  }
  beforeEach(() => {
    db.find("sdr_playbooks", "pb1")!.max_follow_ups = 5;
    settings().followup_daily_limit = 1;
    settings().daily_send_limit = 1;
    metaSend.mockImplementation(async () => ({ wamid: `wamid.out.${Math.random()}`, raw: {} }));
  });

  it("cota comercial esgotada: 35 turnos de conversa seguem e a retomada fica bloqueada", async () => {
    confirmedFollowUp("wamid.fu.prev");
    for (let i = 0; i < 35; i++) {
      const j = inboundTurn(i);
      const r = await sendAuto(j, `resposta ${i}`);
      expect(r.ok).toBe(true);
    }
    expect(metaSend).toHaveBeenCalledTimes(35);
    const fu = followUp();
    // Retomada não pode ser mais nova que a última resposta (senão fica obsoleta).
    db.t("whatsapp_messages").forEach((m) => {
      if (m.direction === "outbound") m.created_at = new Date(base).toISOString();
    });
    expect(await sendAuto(fu, "retomando")).toMatchObject({
      ok: false,
      reason: "followup_quota",
      category: "prospecting",
    });
    expect(metaSend).toHaveBeenCalledTimes(35);
  });

  it("trabalho forjado ou reclassificado é negado", async () => {
    db.t("whatsapp_messages").push({
      id: "out1",
      conversation_id: "c1",
      workspace_id: W1,
      direction: "outbound",
      wa_message_id: "wamid.o",
      body: "x",
      created_at: new Date(base - 999_999).toISOString(),
    });
    const fakeReply = job(db, { status: "running", lease_token: "X1", inbound_message_id: "out1" });
    expect(await sendAuto(fakeReply, "a")).toMatchObject({ reason: "invalid_origin" });
    const noInbound = job(db, { status: "running", lease_token: "X2", inbound_message_id: null });
    expect(await sendAuto(noInbound, "b")).toMatchObject({ reason: "invalid_origin" });
    const fuWithInbound = job(db, {
      kind: "follow_up",
      status: "running",
      lease_token: "X3",
      inbound_message_id: "m1",
    });
    expect(await sendAuto(fuWithInbound, "c")).toMatchObject({ reason: "invalid_origin" });
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("retomada: falha definitiva não consome cota; replay não reenvia nem conta 2x", async () => {
    const a = followUp();
    metaSend.mockRejectedValueOnce(Object.assign(new Error("Meta 400"), { status: 400 }));
    expect(await sendAuto(a, "oi")).toMatchObject({ reason: "provider_failed" });
    db.t("sdr_turn_jobs").forEach((j) => {
      if (j.id === a.id) j.created_at = new Date(base - 10).toISOString();
    });
    const b = followUp();
    metaSend.mockResolvedValueOnce({ wamid: "wamid.fu.ok", raw: {} });
    expect(await sendAuto(b, "olá")).toEqual({ ok: true, wamid: "wamid.fu.ok" });
    const bj = db.find("sdr_turn_jobs", b.id)!;
    Object.assign(bj, { status: "running", lease_token: "R" });
    expect(await sendAuto({ id: b.id, lease_token: "R" }, "olá")).toEqual({
      ok: true,
      wamid: "wamid.fu.ok",
    });
    expect(metaSend).toHaveBeenCalledTimes(2);
    expect(
      db.t("sdr_actions").filter((x) => x.job_id === b.id && x.status === "success"),
    ).toHaveLength(1);
  });

  it("corrida: reserva ativa de outra retomada ocupa a cota", async () => {
    followUp({
      status: "running",
      lease_token: "OTHER",
      send_reserved_until: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date(base - 50).toISOString(),
    });
    const b = followUp();
    // A outra é mais antiga; esta é a mais nova e passa na checagem de versão.
    expect(await sendAuto(b, "x")).toMatchObject({ reason: "followup_quota" });
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("resposta não usa a cota de retomadas mesmo com cota zerada", async () => {
    settings().followup_daily_limit = 0;
    expect((await sendAuto(inboundTurn(1), "oi")).ok).toBe(true);
  });

  it("duas mensagens rápidas: o turno antigo é coalescido sem chamar a IA", async () => {
    const old = inboundTurn(1);
    inboundTurn(2, { status: "queued", lease_token: null });
    const d = deps({});
    expect(await processJob(db, { ...old, status: "running" } as never, d)).toBe("discarded");
    expect(db.find("sdr_turn_jobs", old.id)?.error).toMatch(/^merged_into:/);
    expect(d.callAgent).not.toHaveBeenCalled();
  });

  it("mensagens simultâneas fora de ordem: o turno restante responde por todas", async () => {
    // Caso real: "Olá, boa tarde!" e "Sim" chegaram juntos; o turno do "Sim"
    // (mais recente) foi criado antes do turno do "Olá".
    const ola = inboundTurn(1, {
      status: "queued",
      lease_token: null,
      created_at: new Date(base + 50_000).toISOString(),
    });
    const sim = inboundTurn(2, { created_at: new Date(base + 40_000).toISOString() });
    expect(await processJob(db, sim as never, deps({}))).toBe("discarded");
    Object.assign(db.find("sdr_turn_jobs", ola.id)!, { status: "running", lease_token: "LO" });
    const d = deps({
      reply: "Que ótimo, Simone!",
      intent: "continue",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
    });
    expect(await processJob(db, { ...ola, status: "running", lease_token: "LO" } as never, d)).toBe(
      "drafted",
    );
    expect(db.find("sdr_turn_jobs", ola.id)?.inbound_message_id).toBe(sim.inbound_message_id);
    const r = await sendSdrMessage(db, {
      jobId: ola.id,
      expectedStatus: "drafted",
      text: "Que ótimo, Simone!",
      actorUserId: "u1",
    });
    expect(r.ok).toBe(true);
  });

  it("resposta para mensagem que não é a mais recente fica obsoleta", async () => {
    const old = inboundTurn(1);
    db.t("whatsapp_messages").push({
      id: "newest",
      conversation_id: "c1",
      workspace_id: W1,
      direction: "inbound",
      wa_message_id: "wamid.newest",
      body: "nova",
      created_at: new Date(base + 900_000).toISOString(),
    });
    expect(await sendAuto(old, "x")).toMatchObject({ reason: "stale_version" });
  });

  it("disjuntor aberto bloqueia envio automático; aprovação humana é a retomada controlada", async () => {
    settings().tech_breaker_open_at = new Date().toISOString();
    const j = inboundTurn(1);
    expect(await sendAuto(j, "x")).toMatchObject({ reason: "circuit_open", category: "technical" });
    Object.assign(db.find("sdr_turn_jobs", j.id)!, { status: "drafted", lease_token: null });
    const r = await sendSdrMessage(db, {
      jobId: j.id,
      expectedStatus: "drafted",
      text: "x",
      actorUserId: "u1",
    });
    expect(r.ok).toBe(true);
  });

  it("repetição e ritmo anormal são limites técnicos específicos", async () => {
    expect((await sendAuto(inboundTurn(1), "mesma frase")).ok).toBe(true);
    expect(await sendAuto(inboundTurn(2), "Mesma   frase")).toMatchObject({
      reason: "repetition_detected",
    });
    settings().tech_conv_turns_per_hour = 1;
    expect(await sendAuto(inboundTurn(3), "outra")).toMatchObject({
      reason: "conversation_rate_anomaly",
    });
  });

  it("falha incerta após chamar a Meta exige reconciliação e nunca reenvia", async () => {
    const j = inboundTurn(1);
    metaSend.mockRejectedValueOnce(new Error("network timeout"));
    expect(await sendAuto(j, "x")).toMatchObject({
      reason: "uncertain_after_send",
      category: "reconcile",
    });
    expect(db.find("sdr_turn_jobs", j.id)?.status).toBe("failed");
    Object.assign(db.find("sdr_turn_jobs", j.id)!, { status: "running", lease_token: "again" });
    expect(await sendAuto({ id: j.id, lease_token: "again" }, "x")).toMatchObject({
      reason: "uncertain_after_send",
    });
    expect(metaSend).toHaveBeenCalledTimes(1);
  });

  it("prova do provedor guardada no trabalho basta para não reenviar", async () => {
    const j = inboundTurn(1, { provider_message_id: "wamid.saved", send_started_at: "x" });
    expect(await sendAuto(j, "x")).toEqual({ ok: true, wamid: "wamid.saved" });
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("isolamento: trabalho de outro workspace não envia", async () => {
    const j = inboundTurn(1, { workspace_id: W2 });
    expect(await sendAuto(j, "x")).toMatchObject({ reason: "conversation_missing" });
  });

  it("janela de 24 h e allowlist do piloto continuam valendo para respostas", async () => {
    db.find("whatsapp_conversations", "c1")!.last_inbound_at = new Date(
      Date.now() - 2 * 86400_000,
    ).toISOString();
    expect(await sendAuto(inboundTurn(1), "x")).toMatchObject({ reason: "window_closed" });
    db.find("whatsapp_conversations", "c1")!.last_inbound_at = new Date().toISOString();
    settings().pilot_allowlist = ["+5511999999999"];
    expect(await sendAuto(inboundTurn(2), "y")).toMatchObject({ reason: "not_allowlisted" });
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("resposta do cliente descarta retomadas pendentes", async () => {
    const fu = followUp({ status: "queued", lease_token: null });
    await ingestInboundForSdr(db, {
      workspaceId: W1,
      conversationId: "c1",
      messageId: "m1",
      waMessageId: "wamid.in1",
      providerPhoneId: "pn1",
      body: "voltei",
    });
    expect(db.find("sdr_turn_jobs", fu.id)?.status).toBe("discarded");
  });
});

describe("ferramentas reais no turno (agenda falsa)", () => {
  it("inbound → IA escolhe opção já apresentada → rascunho com vídeo, sem link /book/", async () => {
    const { FakeCalendar, MemoryStore } = await import("./tools/memory");
    const { TOOL_IDS } = await import("./tools/catalog");
    const store = new MemoryStore();
    const cal = new FakeCalendar();
    const WH = { start: "09:00", end: "17:00" };
    db.t("sdr_agent_versions").push({
      id: "v1",
      playbook_id: "pb1",
      workspace_id: W1,
      status: "published",
      persona: {},
      tool_config: {
        enabled_tools: TOOL_IDS,
        allowed_tags: [],
        scheduling: {
          host_user_id: "00000000-0000-4000-8000-0000000000a1",
          calendar_account_id: "00000000-0000-4000-8000-0000000000c1",
          timezone: "America/Sao_Paulo",
          min_notice_hours: 0,
          horizon_days: 14,
          working_hours: {
            mon: [WH],
            tue: [WH],
            wed: [WH],
            thu: [WH],
            fri: [WH],
            sat: [WH],
            sun: [WH],
          },
        },
      },
    });
    // Turno anterior já apresentou a opção 1 ao cliente; ele escreveu o e-mail.
    db.find("whatsapp_messages", "m1")!.body += " Pode ser a opção 1, meu e-mail é ana@acme.com.br";
    const start = Date.now() + 86400000;
    await store.saveOffers("c1", [{ start, end: start + 1800000 }], "superseded");
    job(db);
    const j = await claimOne(db);
    const seenTools: string[][] = [];
    const callAgent = vi.fn(
      async (a: {
        tools?: { name: string }[];
        executeTool?: (n: string, x: unknown, id: string) => Promise<unknown>;
      }) => {
        seenTools.push((a.tools ?? []).map((t) => t.name));
        const bk = (await a.executeTool!(
          "calendar__book",
          { option: 1, attendee_email: "ana@acme.com.br", confirmation_message_id: "m1" },
          "t2",
        )) as { status: string };
        expect(bk.status).toBe("confirmed");
        return {
          ok: true as const,
          output: {
            reply: "Reunião confirmada! Agende em https://x/book/wk",
            intent: "schedule_meeting",
            offer_keys: [],
            material_ids: [],
            answers: [],
            handoff_reason: "",
          },
        };
      },
    );
    const d = deps(null, {
      callAgent: callAgent as never,
      toolEnv: async () => ({ store, calendar: cal, calendarFacts: { ok: true } }),
    });
    expect(await processJob(db, j, d)).toBe("drafted");
    expect(seenTools[0]).toContain("calendar__book");
    const saved = db.t("sdr_turn_jobs").find((x) => x.id === j.id)!;
    expect(saved.draft_text).not.toMatch(/\/book\//);
    expect(saved.draft_text).toMatch(/Link da videoconferência: https:\/\/meet\.google\.com\//);
    expect(saved.draft_payload.planned_stage).toBe("meeting_booked");
    expect(store.meetings[0]!.status).toBe("confirmed");
  });

  it("versão publicada sem ferramentas: IA não recebe ferramentas e nada é anexado", async () => {
    job(db);
    const j = await claimOne(db);
    const callAgent = vi.fn(async (a: { tools?: unknown[] }) => {
      expect(a.tools).toBeUndefined();
      return {
        ok: true as const,
        output: {
          reply: "Vamos marcar",
          intent: "schedule_meeting",
          offer_keys: [],
          material_ids: [],
          answers: [],
          handoff_reason: "",
        },
      };
    });
    const d = deps(null, {
      callAgent: callAgent as never,
      toolEnv: async () => {
        throw new Error("não deveria");
      },
    });
    await processJob(db, j, d);
    const saved = db.t("sdr_turn_jobs").find((x) => x.id === j.id)!;
    expect(String(saved.draft_text)).not.toMatch(/\/book\//);
  });
});

describe("tempo de aguardo do cliente (ingest)", () => {
  const msg = (n: number) => ({
    workspaceId: W1,
    conversationId: "c1",
    messageId: `m${n}`,
    waMessageId: `wamid.wait${n}`,
    providerPhoneId: "pn1",
    body: `parte ${n}`,
  });
  it("adia a resposta e reinicia o relógio de todas as mensagens em espera", async () => {
    db.find("sdr_playbooks", "pb1")!.guardrails = { customer_wait_seconds: 30 };
    const t0 = Date.now();
    expect(await ingestInboundForSdr(db, msg(1))).toBe("queued");
    for (const j of db.t("sdr_turn_jobs")) Object.assign(j, { status: "queued", attempts: 0 });
    const first = new Date(db.t("sdr_turn_jobs")[0].lease_until).getTime();
    expect(first - t0).toBeGreaterThanOrEqual(29_000);
    await new Promise((r) => setTimeout(r, 20));
    expect(await ingestInboundForSdr(db, msg(2))).toBe("queued");
    for (const j of db.t("sdr_turn_jobs")) Object.assign(j, { status: "queued", attempts: 0 });
    const [a, b] = db.t("sdr_turn_jobs");
    expect(a.lease_until).toBe(b.lease_until);
    expect(new Date(a.lease_until).getTime()).toBeGreaterThan(first);
  });
  it("aguardo 0 responde na hora", async () => {
    db.find("sdr_playbooks", "pb1")!.guardrails = { customer_wait_seconds: 0 };
    expect(await ingestInboundForSdr(db, msg(3))).toBe("queued");
    expect(db.t("sdr_turn_jobs")[0].lease_until).toBeNull();
  });
});

describe("estado explícito da conversa (commit atômico)", () => {
  const closedOut = (reason: string) => ({
    reply: "Sem problemas, obrigada pela atenção!",
    intent: "continue",
    offer_keys: [],
    material_ids: [],
    answers: [],
    handoff_reason: "",
    situation: { conversation: "closed", close_reason: reason },
  });
  const auto = () => {
    db.t("sdr_workspace_settings")[0].auto_send_enabled = true;
    db.find("sdr_playbooks", "pb1")!.mode = "auto";
  };

  it("estado alterado durante a IA: compare-and-set descarta sem enviar", async () => {
    auto();
    job(db);
    const j = await claimOne(db);
    db.hooks.beforeCommit = () => {
      db.find("sdr_enrollments", "e1")!.conversation_state_version = 7;
    };
    const d = deps(closedOut("no_demand"));
    expect(await processJob(db, j, d)).toBe("discarded");
    expect(db.find("sdr_turn_jobs", j.id)?.error).toBe("state_changed");
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(db.find("sdr_enrollments", "e1")!.status).toBe("active");
  });

  it("encerramento pela situação: envia o texto da IA, pausa e grava o motivo", async () => {
    auto();
    job(db);
    const j = await claimOne(db);
    const d = deps(closedOut("left_company"));
    const send = d.sendMessage as unknown as ReturnType<typeof vi.fn>;
    send.mockImplementation(async () => {
      db.find("sdr_turn_jobs", j.id)!.status = "sent";
      return { ok: true, wamid: "w1" };
    });
    expect(await processJob(db, j, d)).toBe("sent");
    expect(send.mock.calls[0]![1].text).toBe("Sem problemas, obrigada pela atenção!");
    const e = db.find("sdr_enrollments", "e1")!;
    expect(e).toMatchObject({
      status: "paused",
      cancel_reason: "left_company",
      follow_up_at: null,
    });
    expect(e.conversation_state.closed).toMatchObject({ reason: "left_company", job_id: j.id });
    expect(db.find("whatsapp_conversations", "c1")!.ai_owner).toBe("paused");
  });

  it("nova mensagem após encerramento reabre para a IA interpretar; 'nada a responder' volta a pausar sem enviar", async () => {
    const e = db.find("sdr_enrollments", "e1")!;
    Object.assign(e, { status: "paused", cancel_reason: "left_company" });
    db.find("whatsapp_conversations", "c1")!.ai_owner = "paused";
    db.t("whatsapp_messages").push({
      id: "m2",
      conversation_id: "c1",
      workspace_id: W1,
      direction: "inbound",
      wa_message_id: "wamid.in2",
      body: "👍",
      created_at: "2026-10-06T10:05:00Z",
    });
    const r = await ingestInboundForSdr(db, {
      workspaceId: W1,
      conversationId: "c1",
      messageId: "m2",
      waMessageId: "wamid.in2",
      providerPhoneId: "pn1",
      body: "👍",
    });
    expect(r).toBe("queued");
    expect(db.find("sdr_enrollments", "e1")!.conversation_state.closed.reason).toBe("left_company");
    // Padrões do banco para a linha criada pelo ingest; aguardo do cliente zerado.
    Object.assign(db.t("sdr_turn_jobs")[0], { status: "queued", lease_until: null, attempts: 0 });
    // O turno nasce na versão já reaberta da conversa (senão seria obsoleto).
    expect(db.t("sdr_turn_jobs")[0].conversation_version).toBe(
      db.find("whatsapp_conversations", "c1")!.ai_version,
    );
    const j = await claimOne(db);
    const d = deps({
      reply: "",
      intent: "continue",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
      situation: { suppress_reply: "closed_no_reply_needed" },
    });
    expect(await processJob(db, j, d)).toBe("skipped");
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(db.find("sdr_enrollments", "e1")).toMatchObject({
      status: "paused",
      cancel_reason: "left_company",
    });
    expect(db.find("whatsapp_conversations", "c1")!.ai_owner).toBe("paused");
  });

  it("pergunta legítima após encerramento: responde e não agenda retomada automática", async () => {
    auto();
    db.find("sdr_enrollments", "e1")!.conversation_state = {
      closed: { at: "", job_id: null, reason: "left_company" },
    };
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Fazemos sim! Quer que eu explique como funciona?",
      intent: "continue",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
      situation: { conversation: "active" },
    });
    expect(await processJob(db, j, d)).toBe("sent");
    const payload = db.find("sdr_turn_jobs", j.id)!.draft_payload;
    expect(payload.no_follow_up).toBe(true);
    expect(db.find("sdr_enrollments", "e1")!.conversation_state.closed).toBeNull();
  });

  it("indicação por cartão: grava o contato indicado e encerra; texto não promete contatá-lo", async () => {
    auto();
    db.find("whatsapp_messages", "m1")!.body =
      "👤 Contato compartilhado\nRafael Montini (Zhaz): +55 11 91717-7728";
    job(db);
    const j = await claimOne(db);
    const d = deps({
      ...closedOut("referral_received"),
      reply: "Muito obrigada pela indicação!",
      situation: {
        conversation: "closed",
        close_reason: "referral_received",
        shared_contact: "referral",
      },
    });
    expect(await processJob(db, j, d)).toBe("sent");
    const act = db.t("sdr_actions").find((a) => a.kind === "referral_saved");
    expect(act?.payload.phone).toBe("+5511917177728");
    expect(db.find("sdr_enrollments", "e1")!.cancel_reason).toBe("referral_received");
  });

  it("automação 'pergunta sobre IA' desligada por padrão: ninguém é transferido", async () => {
    const asked = new Date(Date.now() - 2 * 3600_000).toISOString();
    const answered = new Date(Date.now() - 3600_000).toISOString();
    db.t("whatsapp_messages").push(
      {
        id: "q1",
        conversation_id: "c1",
        workspace_id: W1,
        direction: "inbound",
        body: "Você é uma IA?",
        created_at: asked,
      },
      {
        id: "a1",
        conversation_id: "c1",
        workspace_id: W1,
        direction: "outbound",
        body: "Sou uma assistente virtual.",
        created_at: answered,
      },
    );
    db.t("sdr_agent_versions").push({
      id: "v9",
      playbook_id: "pb1",
      workspace_id: W1,
      status: "published",
      persona: {},
      tool_config: { enabled_tools: [] },
    });
    const d = deps(null);
    await tickSdr(db, 10, d);
    expect(d.handoffToHuman).not.toHaveBeenCalled();
    db.find("sdr_agent_versions", "v9")!.tool_config = {
      enabled_tools: [],
      automations: { ai_question_silence_handoff: { enabled: true, minutes: 30 } },
    };
    await tickSdr(db, 10, d);
    expect(d.handoffToHuman).toHaveBeenCalledTimes(1);
  });
});

describe("permissões atuais do worker", () => {
  it("interrompe antes da IA e de ferramentas após revogação", async () => {
    db.workerAuthorized = false;
    job(db);
    const j = await claimOne(db);
    const d = deps({ intent: "qualify", reply: "Olá" });
    expect(await processJob(db as never, j, d)).toBe("failed");
    expect(d.callAgent).not.toHaveBeenCalled();
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(db.find("sdr_turn_jobs", j.id)?.error).toBe("permission_revoked");
    expect(metaSend).not.toHaveBeenCalled();
  });

  it("revalida a permissão também ao enviar um rascunho aprovado", async () => {
    db.workerAuthorized = false;
    const j = job(db, { status: "drafted" });
    const result = await sendSdrMessage(db as never, {
      jobId: j.id,
      expectedStatus: "drafted",
      actorUserId: null,
      text: "Olá",
    });
    expect(result).toMatchObject({ ok: false, reason: "permission_revoked" });
    expect(metaSend).not.toHaveBeenCalled();
  });
});
