import { describe, expect, it, vi } from "vitest";
import { runScoringFullScan, tickScoring } from "./engine.server";

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return holder.client;
  },
}));

type Row = Record<string, unknown>;
function fixture(twoRules = false) {
  const tables: Record<string, Row[]> = {
    scoring_rules: [
      {
        id: "rule-B",
        workspace_id: "B",
        owner_id: "same-owner",
        entity: "lead",
        enabled: true,
        points: 5,
        name: "B",
        condition: { field: "status", op: "eq", value: "new" },
      },
    ],
    leads: [
      { id: "lead-A", workspace_id: "A", status: "new", score: 0 },
      { id: "lead-B", workspace_id: "B", status: "new", score: 0 },
    ],
    workflow_events: [
      {
        id: "event-A",
        workspace_id: "A",
        owner_id: "same-owner",
        entity: "leads",
        entity_id: "lead-A",
        created_at: "2026-01-01",
        after: { status: "new" },
      },
      {
        id: "event-B",
        workspace_id: "B",
        owner_id: "same-owner",
        entity: "leads",
        entity_id: "lead-B",
        created_at: "2026-02-01",
        after: { status: "new" },
      },
    ],
    score_events: [],
    scoring_cursors: [],
  };
  if (twoRules)
    tables.scoring_rules.push({
      ...tables.scoring_rules[0],
      id: "rule-A",
      workspace_id: "A",
      points: 1,
    });
  const client = {
    rpc: vi.fn(async (_name: string, _args: unknown) => ({ data: true, error: null })),
    from: (table: string) => {
      const filters: ((row: Row) => boolean)[] = [];
      let patch: Row | undefined;
      const matching = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return query;
        },
        gt: (key: string, value: string) => {
          filters.push((r) => String(r[key]) > value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((r) => values.includes(r[key]));
          return query;
        },
        insert: (row: Row) => {
          tables[table].push({ id: `insert-${tables[table].length}`, ...row });
          return query;
        },
        update: (row: Row) => {
          patch = row;
          return query;
        },
        upsert: (row: Row) => {
          tables[table].push(row);
          return query;
        },
        single: async () => ({ data: tables[table].at(-1), error: null }),
        maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => {
          const rows = matching();
          if (patch) rows.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  holder.client = client;
  return { tables, client };
}

describe("pontuação isolada por empresa", () => {
  it("regra B não pontua registro A, mesmo quando ambos são visíveis ao cliente", async () => {
    const { tables, client } = fixture();
    expect(await runScoringFullScan(client as never)).toMatchObject({ scanned: 1, applied: 1 });
    expect(client.rpc).toHaveBeenCalledWith(
      "sales_scoring_apply",
      expect.objectContaining({ p_rule: "rule-B", p_table: "leads", p_record: "lead-B" }),
    );
    expect(client.rpc.mock.calls.filter(([name]) => name === "sales_scoring_apply")).toHaveLength(
      1,
    );
  });
  it("mantém duas filas e cursores independentes para o mesmo responsável", async () => {
    const { tables, client } = fixture(true);
    expect(await tickScoring(client as never)).toEqual({ owners: 1, events: 2, applied: 2 });
    expect(
      client.rpc.mock.calls
        .filter(([name]) => name === "sales_scoring_apply")
        .map(([, args]) => (args as { p_record: string }).p_record)
        .sort(),
    ).toEqual(["lead-A", "lead-B"]);
    expect(tables.scoring_cursors).toHaveLength(2);
    expect(tables.scoring_cursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workspace_id: "A", last_event_at: "2026-01-01" }),
        expect.objectContaining({ workspace_id: "B", last_event_at: "2026-02-01" }),
      ]),
    );
  });
});
