// Perfil da Lia: tarefas e notas criadas pelo agente saem com ela como
// responsável e autora; sem perfil, o comportamento anterior é mantido.
import { describe, expect, it } from "vitest";
import { emptyEffects, executeTool, type ToolCtx } from "./dispatcher";
import { FakeCalendar, MemoryStore } from "./memory";
import { TOOL_IDS, type ToolConfig } from "./catalog";

const LIA = "00000000-0000-4000-8000-00000000011a";
const HUMAN = "00000000-0000-4000-8000-0000000000a1";

function ctx(agentUserId: string | null, store: MemoryStore): ToolCtx {
  const cfg = { tools: Object.fromEntries(TOOL_IDS.map((t) => [t, { enabled: true }])) } as unknown as ToolConfig;
  return {
    mode: "live",
    jobId: `job-${Math.random()}`,
    jobKind: "reply",
    workspaceId: "ws1",
    playbookId: "pb1",
    agentVersionId: "v1",
    conversation: {
      id: "c1", phone: "+5548991104003", leadId: "lead1", contactId: null,
      companyId: null, dealId: null, campaignId: null, enrollmentId: "enr1",
    },
    history: [],
    config: cfg,
    exposed: new Set(TOOL_IDS),
    scheduling: null as never,
    calendar: new FakeCalendar(),
    store,
    offers: [], materials: [], kbSources: [], attachMaterials: false, questions: [],
    assigneeId: HUMAN,
    agentUserId,
    now: () => Date.UTC(2026, 9, 21, 14),
    newEventId: () => "e1",
    effects: emptyEffects(),
  };
}

describe("perfil da Lia como responsável", () => {
  it("tarefa criada pela Lia fica com ela", async () => {
    const store = new MemoryStore();
    await executeTool(ctx(LIA, store), "tasks.create", { title: "Retomar contato" }, "t1");
    expect(store.activities[0]).toMatchObject({ owner_id: LIA, assigned_to: LIA, created_by: LIA });
  });
  it("resumo da conversa fica com a Lia", async () => {
    const store = new MemoryStore();
    await executeTool(ctx(LIA, store), "conversation.summarize", { summary: "Cliente quer outsourcing." }, "s1");
    expect(store.activities[0]).toMatchObject({ owner_id: LIA, assigned_to: LIA, created_by: LIA });
  });
  it("sem perfil da Lia continua com o responsável configurado", async () => {
    const store = new MemoryStore();
    await executeTool(ctx(null, store), "tasks.create", { title: "Retomar contato" }, "t1");
    expect(store.activities[0]).toMatchObject({ owner_id: HUMAN, assigned_to: HUMAN });
    expect(store.activities[0]).not.toHaveProperty("created_by");
  });
});
