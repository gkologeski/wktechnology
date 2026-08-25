import { describe, it, expect, vi } from "vitest";
import { tickServicesBilling } from "./billing.server";

type Service = {
  id: string;
  workspace_id: string;
  owner_id: string;
  role: "provider" | "consumer";
  name: string;
  quantity: number;
  unit_price: number;
  currency: string;
  status: string;
  type: string;
  cadence: "monthly" | "quarterly" | "yearly" | null;
  next_billing_at: string | null;
  ends_at: string | null;
  contract_id: string | null;
};

function makeService(over: Partial<Service> = {}): Service {
  return {
    id: "svc-1",
    workspace_id: "ws-1",
    owner_id: "user-1",
    role: "provider",
    name: "Recurring service",
    quantity: 1,
    unit_price: 100,
    currency: "BRL",
    status: "active",
    type: "recurring",
    cadence: "monthly",
    next_billing_at: "2025-01-10",
    ends_at: null,
    contract_id: null,
    ...over,
  };
}

/**
 * Minimal mock of the PostgREST query builder chain used by
 * `tickServicesBilling`. `upsertBehavior` decides whether an insert is
 * treated as a fresh row (returns [{id}]) or a duplicate skipped by the
 * unique index (returns []). `updateShouldFail` toggles the update error path.
 */
function makeAdminMock(opts: {
  due: Service[];
  upsertBehavior?: "insert" | "duplicate";
  updateShouldFail?: boolean;
}) {
  const upsertCalls: unknown[] = [];
  const updateCalls: unknown[] = [];

  const client = {
    from(table: string) {
      if (table === "services") {
        // Two shapes are used against `services`:
        //   .select().eq().eq().not().lte().order().limit()  → returns due list
        //   .update({...}).eq(id)                            → advances cursor
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: opts.due, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ id, payload });
              return Promise.resolve({
                error: opts.updateShouldFail ? { message: "update failed" } : null,
              });
            },
          }),
        };
      }
      if (table === "financial_entries") {
        return {
          upsert: (payload: unknown, options: unknown) => {
            upsertCalls.push({ payload, options });
            const inserted = opts.upsertBehavior === "duplicate" ? [] : [{ id: "fe-new" }];
            return {
              select: () => Promise.resolve({ data: inserted, error: null }),
            };
          },
        };
      }
      throw new Error("unexpected table: " + table);
    },
  };
  return { client: client as never, upsertCalls, updateCalls };
}

describe("tickServicesBilling", () => {
  it("gera lançamento e avança next_billing_at para serviço mensal", async () => {
    const svc = makeService({ next_billing_at: "2025-01-10", cadence: "monthly" });
    const { client, upsertCalls, updateCalls } = makeAdminMock({ due: [svc] });

    const res = await tickServicesBilling(client);

    expect(res).toEqual({
      generated: 1,
      scanned: 1,
      skippedDuplicates: 0,
      updateErrors: 0,
    });
    expect(upsertCalls).toHaveLength(1);
    const upsert = upsertCalls[0] as { payload: any; options: any };
    expect(upsert.payload.competence_date).toBe("2025-01-10");
    expect(upsert.payload.amount).toBe(100);
    expect(upsert.payload.direction).toBe("receivable");
    // O upsert deve ser idempotente por (service_id, competence_date).
    expect(upsert.options).toEqual({
      onConflict: "service_id,competence_date",
      ignoreDuplicates: true,
    });
    expect(updateCalls[0]).toMatchObject({
      id: "svc-1",
      payload: { next_billing_at: "2025-02-10", status: "active" },
    });
  });

  it("não conta duplicidade como gerada quando o índice único ignora insert", async () => {
    const svc = makeService();
    const { client } = makeAdminMock({ due: [svc], upsertBehavior: "duplicate" });

    const res = await tickServicesBilling(client);

    expect(res.generated).toBe(0);
    expect(res.skippedDuplicates).toBe(1);
    expect(res.scanned).toBe(1);
  });

  it("marca status completed quando o próximo ciclo ultrapassa ends_at", async () => {
    const svc = makeService({
      next_billing_at: "2025-01-10",
      ends_at: "2025-01-31",
      cadence: "monthly",
    });
    const { client, updateCalls } = makeAdminMock({ due: [svc] });

    await tickServicesBilling(client);

    expect(updateCalls[0]).toMatchObject({
      payload: { next_billing_at: null, status: "completed" },
    });
  });

  it("registra updateErrors mas não desfaz o generated do upsert", async () => {
    const svc = makeService();
    const { client } = makeAdminMock({ due: [svc], updateShouldFail: true });

    const res = await tickServicesBilling(client);

    expect(res.generated).toBe(1);
    expect(res.updateErrors).toBe(1);
  });

  it("direção é payable quando o serviço tem role=consumer", async () => {
    const svc = makeService({ role: "consumer" });
    const { client, upsertCalls } = makeAdminMock({ due: [svc] });

    await tickServicesBilling(client);

    expect((upsertCalls[0] as { payload: any }).payload.direction).toBe("payable");
  });

  it("retorna zeros quando não há serviços vencendo", async () => {
    const { client, upsertCalls } = makeAdminMock({ due: [] });
    const res = await tickServicesBilling(client);
    expect(res).toEqual({ generated: 0, scanned: 0, skippedDuplicates: 0, updateErrors: 0 });
    expect(upsertCalls).toHaveLength(0);
  });
});

// silencia logs de console durante os testes
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
