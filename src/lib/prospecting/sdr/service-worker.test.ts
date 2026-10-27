import { beforeEach, describe, expect, it, vi } from "vitest";
const spies = vi.hoisted(() => ({ turn: vi.fn(), context: vi.fn(), store: vi.fn() }));
vi.mock("./turn", () => ({ decideTurn: spies.turn }));
vi.mock("./worker.server", () => ({
  loadKnowledge: async () => ({ offers: [], materials: [] }),
  loadQuestions: async () => [],
  loadPromptContext: spies.context,
  prepareSdrQualification: async () => ({
    canonical: null,
    qualificationPayload: null,
    evidence: [],
  }),
}));
vi.mock("./tools/store.server", () => ({
  createDbToolStore: spies.store,
  checkHostCalendar: async () => ({ ok: false }),
  createGoogleCalendar: vi.fn(),
  primaryCalendarId: vi.fn(),
}));
vi.mock("@/lib/gmail.server", () => ({
  buildRawMime: vi.fn(),
  ensureAccessToken: vi.fn(),
  gmailSendRaw: vi.fn(),
}));
import { FakeDb } from "./test-fake-db";
import {
  processServiceJob,
  tickServiceAgents,
  type ServiceWorkerDeps,
} from "./service-worker.server";
import type { ServiceJob } from "./service-transports.server";
const ws = "11111111-1111-4111-8111-111111111111";
const account = "22222222-2222-4222-8222-222222222222";
let db: FakeDb;
let job: ServiceJob;
let deps: ServiceWorkerDeps;
const decision = () => ({
  kind: "decided",
  out: {
    intent: "continue",
    reply: "Como posso ajudar?",
    offer_keys: [],
    material_ids: [],
    warnings: [],
    answers: [],
  },
  text: "Como posso ajudar?",
  materials: [],
  optOut: false,
  close: null,
  state: { patch: {} },
  trace: {},
});
beforeEach(() => {
  vi.clearAllMocks();
  db = new FakeDb();
  db.t("workspaces").push({ id: ws, name: "WK" });
  db.t("service_channel_accounts").push({
    id: account,
    workspace_id: ws,
    channel: "chat",
    source_key: ws,
    label: "Chat comercial",
    display_name: "Bruna",
    enabled: true,
    routing_configured: true,
  });
  db.t("service_channel_bindings").push({
    account_id: account,
    workspace_id: ws,
    agent_id: "pb1",
    enabled: true,
    inbound: true,
    campaigns: false,
  });
  db.t("sdr_playbooks").push({
    id: "pb1",
    workspace_id: ws,
    name: "Comercial",
    enabled: true,
    mode: "supervised",
    questionnaire_id: null,
  });
  db.t("sdr_agent_versions").push({
    id: "v1",
    workspace_id: ws,
    playbook_id: "pb1",
    status: "published",
    persona: { assistant_name: "Lia", description: "Sou a Lia" },
    tool_config: { enabled_tools: ["crm.customer.lookup", "crm.context.read"] },
  });
  db.t("service_agent_sessions").push({
    id: "s1",
    workspace_id: ws,
    account_id: account,
    channel: "chat",
    source_id: "chat1",
    enrollment_id: "e1",
    origin: "inbound",
    ai_owner: "ai",
    ai_version: 1,
    identity_verified: false,
    context_approved: false,
  });
  db.t("sdr_enrollments").push({
    id: "e1",
    workspace_id: ws,
    playbook_id: "pb1",
    status: "active",
    lead_id: "l1",
    contact_id: null,
    company_id: "company1",
    deal_id: "deal1",
    conversation_state: {},
    conversation_state_version: 0,
  });
  db.t("live_chat_messages").push({
    id: "m1",
    workspace_id: ws,
    session_id: "chat1",
    direction: "inbound",
    body: "Preciso de ajuda",
    created_at: new Date().toISOString(),
  });
  db.t("sdr_workspace_settings").push({ workspace_id: ws, auto_send_enabled: true });
  job = {
    id: "j1",
    session_id: "s1",
    workspace_id: ws,
    inbound_message_id: "m1",
    lease_token: "lease1",
    attempts: 1,
    status: "running",
    conversation_version: 1,
  } as ServiceJob;
  db.t("service_agent_jobs").push(job);
  const rpc = db.rpc.bind(db);
  db.rpc = vi.fn(async (name, args) =>
    ["service_agent_commit_turn", "service_agent_finish_decision"].includes(name)
      ? { data: "ok", error: null }
      : name === "service_agent_technical_limit"
        ? { data: false, error: null }
        : rpc(name, args),
  );
  spies.turn.mockResolvedValue(decision());
  spies.context.mockResolvedValue({});
  spies.store.mockReturnValue({ getOffers: async () => null });
  deps = {
    guard: vi.fn(async () => {}),
    callAgent: vi.fn() as never,
    deliver: vi.fn() as never,
    opportunity: vi.fn() as never,
  };
});
describe("email/chat service orchestration", () => {
  it("uses the account persona and only drafts in supervised mode", async () => {
    expect(await processServiceJob(db, job, deps)).toBe("drafted");
    expect(spies.turn.mock.calls[0][0].persona.assistant_name).toBe("Bruna");
    expect(spies.turn.mock.calls[0][0].persona.description).toBe("Sou a Bruna");
    expect(db.rpc).toHaveBeenCalledWith("service_agent_finish_decision", {
      p_job: "j1",
      p_lease: "lease1",
      p_status: "drafted",
    });
    expect(deps.deliver).not.toHaveBeenCalled();
  });
  it("blocks private context and CRM lookup for an unverified visitor", async () => {
    await processServiceJob(db, job, deps);
    const turn = spies.turn.mock.calls[0][0];
    expect(turn.tools.specs).toEqual([]);
    expect(spies.context.mock.calls[0][1].enr).toMatchObject({
      lead_id: null,
      contact_id: null,
      company_id: null,
      deal_id: null,
    });
    expect(spies.store.mock.calls[0][1].restrictCustomerContext).toBe(true);
  });
  it("allows private prompt context only after explicit approval", async () => {
    Object.assign(db.t("service_agent_sessions")[0], {
      identity_verified: true,
      context_approved: true,
    });
    await processServiceJob(db, job, deps);
    expect(spies.context.mock.calls[0][1].enr).toMatchObject({
      lead_id: "l1",
      company_id: "company1",
      deal_id: "deal1",
    });
    expect(spies.store.mock.calls[0][1].customerScope).toEqual({ leadId: "l1", contactId: null });
  });
  it("stops before inference when the account binding is disabled", async () => {
    db.t("service_channel_bindings")[0].enabled = false;
    expect(await processServiceJob(db, job, deps)).toBe("skipped");
    expect(spies.turn).not.toHaveBeenCalled();
    expect(deps.opportunity).not.toHaveBeenCalled();
  });
  it("does not commit after ownership changes during inference", async () => {
    (deps.guard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error("owner_not_ai"), { serviceGuard: true }));
    expect(await processServiceJob(db, job, deps)).toBe("skipped");
    expect(db.rpc).not.toHaveBeenCalledWith("service_agent_commit_turn", expect.anything());
    expect(deps.opportunity).not.toHaveBeenCalled();
  });
  it("readies a reply only when both agent and workspace enable automatic sending", async () => {
    db.t("sdr_playbooks")[0].mode = "auto";
    expect(await processServiceJob(db, job, deps)).toBe("ready");
    expect(db.rpc).toHaveBeenCalledWith("service_agent_finish_decision", {
      p_job: "j1",
      p_lease: "lease1",
      p_status: "ready",
    });
  });
  it("retains a draft when workspace automatic sending is disabled", async () => {
    db.t("sdr_playbooks")[0].mode = "auto";
    db.t("sdr_workspace_settings")[0].auto_send_enabled = false;
    expect(await processServiceJob(db, job, deps)).toBe("drafted");
  });
  it("hands over without attempting an automatic reply", async () => {
    const output = decision();
    output.out.intent = "handoff";
    spies.turn.mockResolvedValue(output);
    expect(await processServiceJob(db, job, deps)).toBe("handoff");
    expect(db.rpc).toHaveBeenCalledWith(
      "service_agent_commit_turn",
      expect.objectContaining({
        p_enrollment: expect.objectContaining({ status: "paused" }),
        p_job_patch: expect.objectContaining({ status: "drafted" }),
      }),
    );
    expect(deps.deliver).not.toHaveBeenCalled();
  });
  it("escalates a repeated automatic menu before calling the model", async () => {
    const body = "Mensagem automática: selecione uma opção do nosso menu de atendimento.";
    db.t("live_chat_messages")[0].body = body;
    db.t("live_chat_messages").push({
      id: "m0",
      workspace_id: ws,
      session_id: "chat1",
      direction: "inbound",
      body,
      created_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await processServiceJob(db, job, deps)).toBe("handoff");
    expect(spies.turn).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "service_agent_commit_turn",
      expect.objectContaining({
        p_job_patch: expect.objectContaining({
          draft_payload: { intent: "handoff", technical_stop: "repeated_inbound" },
        }),
      }),
    );
  });
  it("does not treat an old repeated question as an automatic loop", async () => {
    const body = "Preciso conversar sobre a alocação de uma equipe de desenvolvimento.";
    db.t("live_chat_messages")[0].body = body;
    db.t("live_chat_messages").push({
      id: "old",
      workspace_id: ws,
      session_id: "chat1",
      direction: "inbound",
      body,
      created_at: "2020-01-01",
    });
    expect(await processServiceJob(db, job, deps)).toBe("drafted");
    expect(spies.turn).toHaveBeenCalledOnce();
  });
  it("uses only the technical rate setting to hand over before inference", async () => {
    const original = db.rpc.bind(db);
    db.rpc = vi.fn(async (name, args) =>
      name === "service_agent_technical_limit" ? { data: true, error: null } : original(name, args),
    );
    expect(await processServiceJob(db, job, deps)).toBe("handoff");
    expect(spies.turn).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "service_agent_commit_turn",
      expect.objectContaining({
        p_job_patch: expect.objectContaining({
          draft_payload: { intent: "handoff", technical_stop: "conversation_rate" },
        }),
      }),
    );
  });
  it("does not process a source event from another workspace", async () => {
    db.t("live_chat_messages")[0].workspace_id = "foreign";
    expect(await processServiceJob(db, job, deps)).toBe("skipped");
    expect(spies.turn).not.toHaveBeenCalled();
  });
});

describe("service queue customer wait", () => {
  it("rechecks a postponed burst deadline instead of waiting for the next cron", async () => {
    vi.useFakeTimers();
    try {
      const started = Date.now();
      db.t("service_agent_jobs").splice(0);
      const queued = {
        id: "waiting",
        workspace_id: ws,
        status: "queued",
        available_at: new Date(started + 5000).toISOString(),
      };
      db.t("service_agent_jobs").push(queued);
      const original = db.rpc.bind(db);
      db.rpc = vi.fn(async (name, args) =>
        name === "service_agent_claim" ? { data: [], error: null } : original(name, args),
      );
      let settled = false;
      const pending = tickServiceAgents(db, 3, deps).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2000);
      queued.available_at = new Date(started + 7000).toISOString();
      await vi.advanceTimersByTimeAsync(3100);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(2100);
      await pending;
      expect(settled).toBe(true);
      expect(db.rpc).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
