import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/access-control/sales-core.server", () => ({ assertSalesArea: vi.fn() }));
import { findRecentlyContacted } from "./recent-contact.server";

function fakeDb(rows: Array<Record<string, string | null>>) {
  const cols: string[] = [];
  const q = {
    select: (c: string) => (cols.push(c), q),
    eq: () => q,
    neq: () => q,
    gte: () => q,
    not: () => q,
    range: async () => ({ data: rows, error: null }),
  };
  return { db: { from: () => q } as never, cols };
}

describe("contato recente por destino da ligação", () => {
  it("Contato: procura ligações de outra campanha pelo contact_id", async () => {
    const { db, cols } = fakeDb([{ contact_id: "c1" }]);
    const out = await findRecentlyContacted(
      db,
      "ws",
      "camp",
      [
        { id: "c1", phone: null },
        { id: "c2", phone: null },
      ],
      { days: 7, scope: "calls" },
      "contact",
    );
    expect(cols).toEqual(["contact_id"]);
    expect([...out.keys()]).toEqual(["c1"]);
  });

  it("Lead continua usando lead_id", async () => {
    const { db, cols } = fakeDb([{ lead_id: "l1" }]);
    const out = await findRecentlyContacted(db, "ws", "camp", [{ id: "l1", phone: null }], {
      days: 7,
      scope: "calls",
    });
    expect(cols).toEqual(["lead_id"]);
    expect(out.has("l1")).toBe(true);
  });
});
