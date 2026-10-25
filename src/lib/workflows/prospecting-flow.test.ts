// Fluxo multicanal de ponta a ponta no motor, com banco e fornecedores falsos:
// nenhuma mensagem real é enviada.
import { describe, expect, it, vi } from "vitest";

// Business-flow unit tests inject authorization; real RLS is exercised by the isolated worker suite.
vi.mock("@/lib/access-control/sales-worker.server", () => ({
  assertSalesWorker: async () => undefined,
}));
vi.mock("./engine/authorization.server", () => ({
  authorizeWorkflowStep: async () => undefined,
  sanitizeWorkflowSnapshot: (value: unknown) => value,
}));
vi.mock("./engine/record-write.server", () => ({
  workflowRecord: async (
    db: any,
    _ctx: unknown,
    table: string,
    operation: string,
    id: string | null,
    payload: Record<string, unknown>,
  ) => {
    const query =
      operation === "create"
        ? db.from(table).insert(payload).select("id").single()
        : operation === "update"
          ? db.from(table).update(payload).eq("id", id)
          : db.from(table).delete().eq("id", id);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return result.data ?? { id };
  },
}));

import { runActions } from "./engine.server";
import type { WorkflowAction } from "./types";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; row: Row }[] = [];
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let lim = Infinity;
    const result = () => rows.filter((r) => filters.every((f) => f(r))).slice(0, lim);
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      gt: (k: string, v: string) => (filters.push((r) => String(r[k]) > v), q),
      ilike: (k: string, v: string) => (
        filters.push((r) => String(r[k]).toLowerCase() === v.toLowerCase()),
        q
      ),
      order: () => q,
      limit: (n: number) => ((lim = n), q),
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      single: async () => ({ data: result()[0] ?? null, error: null }),
      update: (p: Row) => ((patch = p), q),
      insert: (row: Row) => {
        const r = { id: `${table}-${rows.length + 1}`, ...row };
        rows.push(r);
        writes.push({ table, op: "insert", row: r });
        filters.push((x) => x === r);
        return q;
      },
      then: (res: (v: unknown) => void) => {
        const data = result();
        if (patch)
          for (const r of data) {
            Object.assign(r, patch);
            writes.push({ table, op: "update", row: r });
          }
        res({ data, error: null });
      },
    };
    return q;
  };
  return { client: { from }, writes, tables };
}

const ctx = (after: Row) => ({
  entity: "leads" as const,
  entityId: "lead-1",
  ownerId: "owner-1",
  workspaceId: "ws-1",
  after,
  before: null,
  workflowId: "wf-1",
  runId: "run-1",
});

const flow: WorkflowAction[] = [
  {
    type: "wait_for_reply",
    channels: ["whatsapp", "email"],
    timeout_amount: 2,
    timeout_unit: "days",
    then: [{ type: "handoff", reason: "Cliente respondeu" }],
    else: [{ type: "sdr_agent", mode: "off" }],
  },
];

const lead = { id: "lead-1", phone: "+5548991104003", email: "cliente@ex.com" };
const conv = { id: "c1", workspace_id: "ws-1", contact_phone: "+554891104003" };

describe("fluxo de prospecção multicanal (fornecedores falsos)", () => {
  it("sem resposta ainda: pausa e agenda nova conferência no mesmo passo", async () => {
    const db = fakeDb({ whatsapp_messages: [], email_messages: [] });
    const res = await runActions(db.client as never, flow, ctx(lead));
    expect(res.hadError).toBe(false);
    expect(res.suspendedAt?.resumeCursor).toBe(0);
    expect(res.suspendedAt?.waitState?.cursor).toBe(0);
    expect(db.writes).toHaveLength(0);
  });

  it("resposta no WhatsApp (número sem o nono dígito) transfere e pausa o agente", async () => {
    const started = new Date(Date.now() - 60_000).toISOString();
    const db = fakeDb({
      whatsapp_messages: [
        {
          workspace_id: "ws-1",
          direction: "inbound",
          from_number: "+554891104003",
          created_at: new Date().toISOString(),
        },
      ],
      email_messages: [],
      whatsapp_conversations: [conv],
      sdr_enrollments: [
        { id: "e1", workspace_id: "ws-1", conversation_id: "c1", status: "active" },
      ],
      notifications: [],
    });
    const after = {
      ...lead,
      __wf_wait: {
        cursor: 0,
        started_at: started,
        deadline: new Date(Date.now() + 1e8).toISOString(),
      },
    };
    const res = await runActions(db.client as never, flow, ctx(after));
    expect(res.hadError).toBe(false);
    expect(res.log.find((l) => l.action === "wait_for_reply")?.detail).toMatchObject({
      outcome: "replied",
      channel: "whatsapp",
    });
    expect(db.tables.sdr_enrollments![0]!.status).toBe("handoff");
    expect(db.tables.notifications).toHaveLength(1);
  });

  it("resposta de outro workspace não conta", async () => {
    const db = fakeDb({
      whatsapp_messages: [
        {
          workspace_id: "ws-2",
          direction: "inbound",
          from_number: "+554891104003",
          created_at: new Date().toISOString(),
        },
      ],
      email_messages: [],
    });
    const res = await runActions(db.client as never, flow, ctx(lead));
    expect(res.suspendedAt).toBeDefined();
  });

  it("prazo esgotado sem resposta desliga o agente (e só ele)", async () => {
    const db = fakeDb({
      whatsapp_messages: [],
      email_messages: [],
      whatsapp_conversations: [conv],
      sdr_enrollments: [
        { id: "e1", workspace_id: "ws-1", conversation_id: "c1", status: "active" },
        { id: "e2", workspace_id: "ws-2", conversation_id: "c1", status: "active" },
      ],
    });
    const after = {
      ...lead,
      __wf_wait: {
        cursor: 0,
        started_at: "2026-01-01T00:00:00Z",
        deadline: "2026-01-03T00:00:00Z",
      },
    };
    const res = await runActions(db.client as never, flow, ctx(after));
    expect(res.log.find((l) => l.action === "wait_for_reply")?.detail).toMatchObject({
      outcome: "timeout",
    });
    expect(db.tables.sdr_enrollments!.map((e) => e.status)).toEqual(["inactive", "active"]);
  });
});
