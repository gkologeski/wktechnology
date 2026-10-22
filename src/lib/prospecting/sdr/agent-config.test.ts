// Configuração por agente: cada agente tem catálogo, ferramentas e guardrails
// próprios; nada aqui depende de IA, WhatsApp ou banco real.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  isWithinServiceWindow: (t: string | null) =>
    !!t && Date.now() - new Date(t).getTime() < 86400_000,
  resolveWaNumber: async () => ({ displayPhoneNumber: "5511900000000", phoneNumberId: "pn1" }),
  metaSend: vi.fn(),
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({ aiChatFetch: vi.fn() }));
vi.mock("@/lib/scoring/icp.server", () => ({
  computeIcpFit: () => ({ points: 0, max: 0, percent: null, matched: [], level: "unknown" }),
}));

import { FakeDb } from "./test-fake-db";
import { processJob, type WorkerDeps } from "./worker.server";
import {
  agentConfigPromptSection,
  configFromRow,
  hasTool,
  parseAgentConfig,
  scopeKnowledge,
} from "./agent-config";
import { buildSystemPrompt } from "./agent.server";

const W1 = "11111111-1111-4111-8111-111111111111";
const W2 = "22222222-2222-4222-8222-222222222222";

describe("configuração por agente (pura)", () => {
  it("listas vazias herdam todo o catálogo ativo", () => {
    const cfg = parseAgentConfig({});
    const k = scopeKnowledge(cfg, {
      offers: [{ offer_key: "fabrica" }, { offer_key: "hunting" }],
      materials: [{ id: "m1" }, { id: "m2" }],
    });
    expect(k.offers).toHaveLength(2);
    expect(k.materials).toHaveLength(2);
  });

  it("dois agentes no mesmo workspace têm catálogos independentes", () => {
    const a = parseAgentConfig({ offer_keys: ["fabrica"], material_ids: [] });
    const b = parseAgentConfig({ offer_keys: ["hunting"], allowed_tools: ["qualify", "handoff"] });
    const base = {
      offers: [{ offer_key: "fabrica" }, { offer_key: "hunting" }],
      materials: [{ id: "m1" }],
    };
    expect(scopeKnowledge(a, base).offers.map((o) => o.offer_key)).toEqual(["fabrica"]);
    expect(scopeKnowledge(b, base).offers.map((o) => o.offer_key)).toEqual(["hunting"]);
    // Sem a ferramenta de material, o agente B não recebe material nenhum.
    expect(scopeKnowledge(a, base).materials).toHaveLength(1);
    expect(scopeKnowledge(b, base).materials).toHaveLength(0);
  });

  it("ferramentas desligadas aparecem como proibição explícita no prompt", () => {
    const cfg = parseAgentConfig({ allowed_tools: ["qualify"] });
    const txt = agentConfigPromptSection(cfg);
    expect(txt).toContain(
      "Capacidades desligadas: materiais, agendamento, transferência para pessoa",
    );
    expect(hasTool(cfg, "schedule")).toBe(false);
  });

  it("agendamento só com ferramentas de agenda prontas; nunca link de autoagendamento", () => {
    const base = {
      offers: [],
      materials: [],
      questions: [],
      bookingAvailable: true,
      config: parseAgentConfig({}),
    };
    const direct = buildSystemPrompt({ ...base, directBooking: true, toolsAvailable: true });
    const legacy = buildSystemPrompt(base);
    expect(direct).toContain("calendar.book exige opção vigente");
    expect(legacy).not.toContain("calendar.book");
    expect(legacy).toContain("não existe link de autoagendamento");
    expect(direct).not.toMatch(/anexa o link de agenda/);
  });

  it("linha do banco com valores inválidos cai no padrão seguro", () => {
    const cfg = configFromRow({ allowed_tools: ["inexistente"], channels: ["sms"] });
    expect(cfg.allowed_tools).toEqual([]);
    expect(cfg.channels).toEqual(["whatsapp"]);
  });
});

// ---------- runtime: dois agentes independentes no mesmo workspace ----------

function seedTwoAgents(db: FakeDb) {
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
  // Agente A: só Fábrica, com materiais e agenda. Agente B: só Hunting, sem materiais/agenda.
  db.t("sdr_playbooks").push(
    {
      id: "pbA",
      workspace_id: W1,
      enabled: true,
      mode: "supervised",
      questionnaire_id: null,
      booking_page_id: "bp1",
      opportunity_min_score: 40,
      follow_up_hours: 24,
      max_follow_ups: 2,
      opt_out_phrases: [],
      offer_keys: ["fabrica"],
      material_ids: [],
      allowed_tools: ["qualify", "material", "schedule", "handoff"],
      channels: ["whatsapp"],
      guardrails: {},
      kb_sources: [],
    },
    {
      id: "pbB",
      workspace_id: W1,
      enabled: true,
      mode: "supervised",
      questionnaire_id: null,
      booking_page_id: "bp1",
      opportunity_min_score: 40,
      follow_up_hours: 24,
      max_follow_ups: 2,
      opt_out_phrases: [],
      offer_keys: ["hunting"],
      material_ids: [],
      allowed_tools: ["qualify"],
      channels: ["whatsapp"],
      guardrails: { no_pricing: true, extra_rules: "Só fale de recrutamento." },
      kb_sources: [],
    },
  );
  db.t("sdr_offers").push(
    {
      id: "o1",
      workspace_id: W1,
      offer_key: "fabrica",
      name: "Fábrica de Software",
      status: "active",
      approved_at: "2026-01-01",
      summary: "",
      fit_signals: [],
      discovery_questions: [],
      commercial_notes: "",
      pricing_policy: "",
      position: 0,
    },
    {
      id: "o2",
      workspace_id: W1,
      offer_key: "hunting",
      name: "Hunting de TI",
      status: "active",
      approved_at: "2026-01-01",
      summary: "",
      fit_signals: [],
      discovery_questions: [],
      commercial_notes: "",
      pricing_policy: "",
      position: 1,
    },
  );
  db.t("sdr_materials").push({
    id: "33333333-3333-4333-8333-333333333333",
    workspace_id: W1,
    title: "Case Fábrica",
    approved: true,
    active: true,
    url: "https://x",
  });
  // Versões: A publicada, B apenas rascunho (rascunho nunca entra em produção).
  db.t("sdr_agent_versions").push(
    {
      id: "vA",
      workspace_id: W1,
      playbook_id: "pbA",
      version: 1,
      status: "published",
      persona: { assistant_name: "Ana" },
    },
    {
      id: "vBdraft",
      workspace_id: W1,
      playbook_id: "pbB",
      version: 1,
      status: "draft",
      persona: { assistant_name: "Bia" },
    },
  );
  for (const [conv, enr, pb] of [
    ["cA", "eA", "pbA"],
    ["cB", "eB", "pbB"],
  ] as const) {
    db.t("whatsapp_conversations").push({
      id: conv,
      workspace_id: W1,
      ai_owner: "ai",
      ai_version: 1,
      sdr_enrollment_id: enr,
      contact_phone: "5511988887777",
      last_inbound_at: new Date().toISOString(),
      lead_id: null,
      contact_id: null,
    });
    db.t("sdr_enrollments").push({
      id: enr,
      workspace_id: W1,
      owner_id: "u1",
      playbook_id: pb,
      conversation_id: conv,
      status: "active",
      commercial_stage: "awaiting_reply",
      lead_id: null,
      contact_id: null,
      deal_id: null,
      offers: [],
      follow_up_count: 0,
    });
    db.t("whatsapp_messages").push({
      id: `m-${conv}`,
      conversation_id: conv,
      workspace_id: W1,
      direction: "inbound",
      wa_message_id: `wamid.${conv}`,
      body: "Oi, quero entender melhor",
      created_at: "2026-10-06T10:00:00Z",
    });
  }
}

function pushJob(db: FakeDb, enrollment: string, conversation: string) {
  const j = {
    id: `j-${enrollment}`,
    workspace_id: W1,
    enrollment_id: enrollment,
    conversation_id: conversation,
    kind: "reply",
    inbound_message_id: `m-${conversation}`,
    status: "queued",
    attempts: 0,
    conversation_version: 1,
    idem_key: `k-${enrollment}`,
    created_at: new Date().toISOString(),
  };
  db.t("sdr_turn_jobs").push(j);
  return j;
}

async function claim(db: FakeDb) {
  const { data } = await db.rpc("sdr_claim_jobs", { p_limit: 10, p_lease_seconds: 120 });
  return data[0];
}

function deps(capture: { system?: string }) {
  return {
    callAgent: vi.fn(async (args: { system: string }) => {
      capture.system = args.system;
      return {
        ok: true as const,
        output: {
          reply: "Claro, me conta um pouco do contexto?",
          intent: "continue",
          offer_keys: [],
          material_ids: [],
          answers: [],
          handoff_reason: "",
        },
      };
    }),
    ensureOpportunity: vi.fn(async () => "deal1"),
    handoffToHuman: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => ({ ok: true as const, wamid: "w" })),
  } as unknown as WorkerDeps;
}

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  seedTwoAgents(db);
});

describe("runtime por agente", () => {
  it("cada agente recebe só o próprio catálogo e as próprias ferramentas", async () => {
    pushJob(db, "eA", "cA");
    const capA: { system?: string } = {};
    await processJob(db, await claim(db), deps(capA));
    expect(capA.system).toContain("Fábrica de Software");
    expect(capA.system).not.toContain("Hunting de TI");
    expect(capA.system).toContain("Ana");

    db.t("sdr_turn_jobs").length = 0;
    pushJob(db, "eB", "cB");
    const capB: { system?: string } = {};
    await processJob(db, await claim(db), deps(capB));
    expect(capB.system).toContain("Hunting de TI");
    expect(capB.system).not.toContain("Fábrica de Software");
    expect(capB.system).toContain("Só fale de recrutamento.");
    expect(capB.system).toMatch(/Capacidades desligadas: [^\n]*materiais/);
    // Rascunho não vai para produção: o nome da persona em rascunho não aparece.
    expect(capB.system).not.toContain("Bia");
  });

  it("agente de outro workspace não é usado", async () => {
    const j = pushJob(db, "eA", "cA");
    const claimed = await claim(db);
    const cap: { system?: string } = {};
    const status = await processJob(db, { ...claimed, workspace_id: W2 }, deps(cap));
    expect(status).toBe("discarded");
    expect(cap.system).toBeUndefined();
    expect(db.find("sdr_turn_jobs", j.id)?.error).toBe("context_mismatch");
  });
});
