// Testes de orquestração do SDR com banco em memória e provedores simulados.
// Não chamam IA, WhatsApp nem Google reais.
import { beforeEach, describe, expect, it, vi } from "vitest";

const metaSend = vi.fn();
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  isWithinServiceWindow: () => true,
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
  });
  db.t("leads").push({ id: "L1", workspace_id: W1, company_id: null });
  db.t("whatsapp_messages").push({
    id: "m1",
    conversation_id: "c1",
    workspace_id: W1,
    direction: "inbound",
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
  it("recusa encerra sem enfileirar", async () => {
    expect(await ingestInboundForSdr(db, { ...p, body: "não tenho interesse" })).toBe("opted_out");
    expect(db.find("sdr_enrollments", "e1")?.status).toBe("opted_out");
    expect(db.t("sdr_turn_jobs")).toHaveLength(0);
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
  it("opt-out da IA encerra, pausa a conversa e não envia", async () => {
    job(db);
    const j = await claimOne(db);
    const d = deps({
      reply: "Tudo bem",
      intent: "opt_out",
      offer_keys: [],
      material_ids: [],
      answers: [],
      handoff_reason: "",
    });
    expect(await processJob(db, j, d)).toBe("opt_out");
    expect(db.find("sdr_enrollments", "e1")?.status).toBe("opted_out");
    expect(db.find("whatsapp_conversations", "c1")?.ai_owner).toBe("paused");
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.handoffToHuman).not.toHaveBeenCalled();
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
    metaSend.mockRejectedValue(new Error("Meta 500"));
    const r = await sendSdrMessage(db, {
      jobId: "j1",
      expectedStatus: "drafted",
      text: "Oi",
      actorUserId: "u1",
    });
    expect(r).toEqual({ ok: false, reason: "provider_failed" });
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
    expect(r).toEqual({ ok: false, reason: "owner_not_ai" });
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
    metaSend.mockResolvedValue({ messages: [{ id: "wamid.out" }] });
    const sent = await sendSdrMessage(db, {
      jobId: j.id,
      expectedStatus: "drafted",
      text: "Que bom! Posso te enviar nosso material?",
      actorUserId: "u1",
    });
    expect(sent.ok).toBe(true);
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
    expect(await processJob(db, c2, d2)).toBe("opt_out");
    expect(db.find("sdr_enrollments", "e1")).toMatchObject({
      status: "opted_out",
      follow_up_at: null,
    });
    expect(d2.handoffToHuman).not.toHaveBeenCalled();
    expect(metaSend).toHaveBeenCalledTimes(1);
  });
});
