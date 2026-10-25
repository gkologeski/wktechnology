// Fase 3 do construtor: espera dentro de caminhos, caminhos em paralelo com
// junção, link de agendamento e material — banco falso, nada é enviado.
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
import { decideJoin, initialParallelState } from "./engine/actions-parallel.server";
import { splitResumeData } from "./engine-runtime.server";
import { hasApprovalInsideParallel, collectResourceIds } from "./flow-checks";
import { parseActionsAtDepth } from "./schemas";
import type { WorkflowAction } from "./types";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const writes: { table: string; row: Row }[] = [];
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
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
      insert: (row: Row) => {
        const r = { id: `${table}-${rows.length + 1}`, ...row };
        rows.push(r);
        writes.push({ table, row: r });
        filters.push((x) => x === r);
        return q;
      },
      then: (res: (v: unknown) => void) => res({ data: result(), error: null }),
    };
    return q;
  };
  return { client: { from }, writes, tables };
}

const ctx = (after: Row, extra: Row = {}) => ({
  entity: "leads" as const,
  entityId: "lead-1",
  ownerId: "owner-1",
  workspaceId: "ws-1",
  after,
  before: null,
  workflowId: "wf-1",
  runId: "run-1",
  ...extra,
});

const material = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "ws-1",
  title: "Portfólio",
  url: "https://ex.com/p.pdf",
  approved: true,
  active: true,
};

describe("espera dentro de caminhos", () => {
  const flow: WorkflowAction[] = [
    {
      type: "branch_if",
      filters: [{ field: "status", op: "eq", value: "new" }],
      then: [
        { type: "delay", amount: 1, unit: "hours" },
        { type: "share_material", material_id: material.id },
      ],
      else: [],
    },
  ];

  it("pausa dentro do caminho e grava o ponto de retomada", async () => {
    const db = fakeDb({ sdr_materials: [material] });
    const res = await runActions(db.client as never, flow, ctx({ status: "new" }));
    expect(res.hadError).toBe(false);
    expect(res.suspendedAt?.resumeCursor).toBe(0);
    expect(res.suspendedAt?.resumePath).toEqual([{ key: "then", cursor: 1 }]);
    expect(res.log.some((l) => l.action === "share_material")).toBe(false);
  });

  it("retoma no mesmo caminho sem reavaliar a condição", async () => {
    const db = fakeDb({ sdr_materials: [material] });
    // Status mudou: se reavaliasse, iria para "senão" e nada aconteceria.
    const res = await runActions(
      db.client as never,
      flow,
      ctx({ status: "won" }, { resumeFrames: [{ key: "then", cursor: 1 }] }),
      0,
    );
    expect(res.hadError).toBe(false);
    expect(res.suspendedAt).toBeUndefined();
    const step = res.log.find((l) => l.action === "share_material");
    expect(step?.ok).toBe(true);
    expect(step?.step_path).toBe("1.then.2");
  });
});

describe("caminhos em paralelo", () => {
  const lead = { id: "lead-1", phone: "+5548991104003" };
  const anyFlow: WorkflowAction[] = [
    {
      type: "parallel",
      join: "any",
      branches: [
        {
          label: "WhatsApp",
          actions: [
            {
              type: "wait_for_reply",
              channels: ["whatsapp"],
              timeout_amount: 2,
              timeout_unit: "days",
              then: [{ type: "share_material", material_id: material.id }],
              else: [],
            },
          ],
        },
        { label: "E-mail", actions: [{ type: "delay", amount: 2, unit: "days" }] },
      ],
    },
    { type: "share_material", material_id: material.id },
  ];

  it("todos esperando: pausa o passo e guarda o estado de cada caminho", async () => {
    const db = fakeDb({ sdr_materials: [material], whatsapp_messages: [] });
    const c = ctx(lead);
    const res = await runActions(db.client as never, anyFlow, c);
    expect(res.suspendedAt?.resumeCursor).toBe(0);
    const st = res.suspendedAt?.state?.["par:1"] as { branches: { status: string }[] };
    expect(st.branches.map((b) => b.status)).toEqual(["waiting", "waiting"]);
    // Próxima conferência é a mais cedo (aguardar resposta, 10 min), não a de 2 dias.
    const next = new Date(res.suspendedAt!.runAtIso).getTime();
    expect(next - Date.now()).toBeLessThan(11 * 60_000);
  });

  it("resposta no WhatsApp: segue no primeiro e cancela o caminho do e-mail", async () => {
    const db = fakeDb({ sdr_materials: [material], whatsapp_messages: [] });
    const c = ctx(lead);
    const first = await runActions(db.client as never, anyFlow, c);
    const state = first.suspendedAt!.state!;
    const par = state["par:1"] as { branches: { runAt?: string }[] };
    par.branches[0]!.runAt = new Date(Date.now() - 1000).toISOString();
    db.tables.whatsapp_messages!.push({
      workspace_id: "ws-1",
      direction: "inbound",
      from_number: "+554891104003",
      created_at: new Date(Date.now() + 1000).toISOString(),
    });
    const res = await runActions(db.client as never, anyFlow, ctx(lead, { state }), 0);
    expect(res.hadError).toBe(false);
    expect(res.suspendedAt).toBeUndefined();
    const join = res.log.find((l) => l.action === "parallel");
    expect(join?.detail).toMatchObject({
      caminhos: [
        { caminho: "WhatsApp", status: "done" },
        { caminho: "E-mail", status: "cancelled" },
      ],
    });
    // Passo depois da junção executou.
    expect(res.log.filter((l) => l.action === "share_material")).toHaveLength(2);
  });

  it("join 'all': erro em um caminho não derruba o outro", async () => {
    const bad = { ...material, id: "22222222-2222-4222-8222-222222222222", approved: false };
    const db = fakeDb({ sdr_materials: [material, bad] });
    const flow: WorkflowAction[] = [
      {
        type: "parallel",
        join: "all",
        branches: [
          { actions: [{ type: "share_material", material_id: bad.id }] },
          { actions: [{ type: "share_material", material_id: material.id }] },
        ],
      },
    ];
    const res = await runActions(db.client as never, flow, ctx({}));
    expect(res.hadError).toBe(false);
    expect(res.log.find((l) => l.action === "parallel")?.ok).toBe(true);
  });

  it("join 'all': todos falhando encerra com erro", () => {
    const st = initialParallelState(2);
    st.branches.forEach((b) => (b.status = "error"));
    expect(decideJoin("all", st).kind).toBe("fail");
  });
});

describe("agenda e material", () => {
  it("material de outra empresa é recusado", async () => {
    const db = fakeDb({ sdr_materials: [{ ...material, workspace_id: "ws-2" }] });
    const res = await runActions(
      db.client as never,
      [{ type: "share_material", material_id: material.id }],
      ctx({}),
    );
    expect(res.hadError).toBe(true);
    expect(res.log[0]?.error).toMatch(/fora da empresa/);
  });

  it("agenda ativa da empresa gera o link em vars.booking_url", async () => {
    const page = {
      id: "p1",
      slug: "wk-30min",
      title: "Reunião",
      active: true,
      workspace_id: "ws-1",
    };
    const db = fakeDb({ booking_pages: [page] });
    const c = ctx({}) as ReturnType<typeof ctx> & { vars?: Record<string, unknown> };
    const res = await runActions(
      db.client as never,
      [{ type: "share_booking_link", booking_page_id: "p1" }],
      c,
    );
    expect(res.hadError).toBe(false);
    expect(String(c.vars?.["booking_url"])).toMatch(/\/book\/wk-30min$/);
  });

  it("publicação: bloco sem recurso e aprovação em paralelo são detectados", () => {
    expect(collectResourceIds([{ type: "share_material", material_id: "" }]).missing).toBe(true);
    expect(
      hasApprovalInsideParallel([
        {
          type: "parallel",
          join: "all",
          branches: [{ actions: [{ type: "approval_step", title: "x" }] }, { actions: [] }],
        },
      ]),
    ).toBe(true);
  });
});

describe("validação e retomada", () => {
  it("caminhos em paralelo exigem de 2 a 5 caminhos", () => {
    expect(() =>
      parseActionsAtDepth([{ type: "parallel", join: "all", branches: [{ actions: [] }] }], 0),
    ).toThrow(/2 a 5/);
  });
  it("separa estado e ponto de retomada do registro", () => {
    const r = splitResumeData({
      name: "x",
      __wf_state: { "par:1": {} },
      __wf_path: [{ key: "then", cursor: 2 }],
    });
    expect(r.after).toEqual({ name: "x" });
    expect(r.frames).toEqual([{ key: "then", cursor: 2 }]);
    expect(Object.keys(r.state)).toEqual(["par:1"]);
  });
});
