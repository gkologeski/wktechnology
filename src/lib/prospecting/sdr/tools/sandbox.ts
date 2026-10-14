// Sandbox do estúdio: mesmo catálogo, schemas e dispatcher do runtime, com
// armazenamento em memória e agenda falsa. Nada sai do servidor; toda saída
// é marcada como simulada. O estado volta ao navegador para o próximo turno.
import type { ConversationMessage } from "../policy";
import type { CanonicalQuestion } from "../qualification";
import { exposedTools, type ReadinessFacts, type ToolConfig } from "./catalog";
import { emptyEffects, type ToolCtx } from "./dispatcher";
import { FakeCalendar, MemoryStore } from "./memory";
import { newEventId } from "./runtime";

export type SandboxState = {
  offers?: MemoryStore["offers"];
  meetings?: MemoryStore["meetings"];
  events?: [string, { start: number; end: number; cancelled: boolean; meetLink: string | null }][];
};

export function createSandbox(p: {
  workspaceId: string;
  playbookId: string;
  config: ToolConfig;
  facts: ReadinessFacts;
  history: ConversationMessage[];
  offers: ToolCtx["offers"];
  materials: ToolCtx["materials"];
  kbSources: ToolCtx["kbSources"];
  attachMaterials: boolean;
  questions: CanonicalQuestion[];
  assigneeId: string | null;
  state: SandboxState | null;
}) {
  const store = new MemoryStore();
  store.offers = p.state?.offers ?? [];
  store.meetings = p.state?.meetings ?? [];
  const calendar = new FakeCalendar();
  for (const [k, v] of p.state?.events ?? []) calendar.events.set(k, v);
  // Na simulação a agenda falsa conta como pronta se o anfitrião estiver definido.
  const facts = {
    ...p.facts,
    calendar: { ok: !!p.config.scheduling, reason: "Defina o anfitrião e a agenda." },
  };
  const exposed = new Set(exposedTools(p.config, facts).map((d) => d.id));
  const ctx: ToolCtx = {
    mode: "sandbox",
    jobId: null,
    jobKind: "reply",
    workspaceId: p.workspaceId,
    playbookId: p.playbookId,
    agentVersionId: null,
    conversation: {
      id: `sandbox-${p.playbookId}`,
      phone: "+5500000000000",
      leadId: null,
      contactId: null,
      companyId: null,
      dealId: null,
      campaignId: null,
      enrollmentId: "sandbox-enrollment",
    },
    history: p.history,
    config: p.config,
    exposed,
    scheduling: p.config.scheduling,
    calendar,
    store,
    offers: p.offers,
    materials: p.materials,
    kbSources: p.kbSources,
    attachMaterials: p.attachMaterials,
    questions: p.questions,
    assigneeId: p.assigneeId,
    now: () => Date.now(),
    newEventId,
    effects: emptyEffects(),
  };
  const snapshot = (): SandboxState => ({
    offers: store.offers,
    meetings: store.meetings,
    events: [...calendar.events.entries()],
  });
  return { ctx, store, calendar, exposed, snapshot };
}
