import { describe, it, expect } from "vitest";
import { unlinkDealContact } from "./unlink-deal-contact";

type Write = { table: string; op: "delete" | "update" };

/** Fake client: reads come from `state`; writes affect `affected` rows. */
function fakeDb(state: { linked: boolean; primary: string | null }, affected = 1) {
  const writes: Write[] = [];
  const from = (table: string) => {
    let op: Write["op"] | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      limit: () => q,
      maybeSingle: () => q,
      delete: () => ((op = "delete"), q),
      update: () => ((op = "update"), q),
      then: (resolve: (v: unknown) => unknown) => {
        if (op) {
          writes.push({ table, op });
          return resolve({
            data: Array.from({ length: affected }, () => ({ id: "x" })),
            error: null,
          });
        }
        if (table === "deal_contacts")
          return resolve({ data: state.linked ? [{ contact_id: "c1" }] : [], error: null });
        return resolve({ data: { primary_contact_id: state.primary }, error: null });
      },
    };
    return q;
  };
  const reader = { from };
  return { reader, writes };
}

describe("unlinkDealContact", () => {
  it("clears a primary contact that has no deal_contacts row without a false denial", async () => {
    const db = fakeDb({ linked: false, primary: "c1" });
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error).toBeNull();
    expect(db.writes).toEqual([{ table: "deals", op: "update" }]);
  });

  it("removes both the link row and the primary contact when both exist", async () => {
    const db = fakeDb({ linked: true, primary: "c1" });
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error).toBeNull();
    expect(db.writes).toEqual([
      { table: "deal_contacts", op: "delete" },
      { table: "deals", op: "update" },
    ]);
  });

  it("only removes the link row for a non-primary contact", async () => {
    const db = fakeDb({ linked: true, primary: "other" });
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error).toBeNull();
    expect(db.writes).toEqual([{ table: "deal_contacts", op: "delete" }]);
  });

  it("still reports a denial when RLS blocks clearing the primary contact", async () => {
    const db = fakeDb({ linked: false, primary: "c1" }, 0);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error?.code).toBe("42501");
  });
});

/**
 * Authorization scenarios: database RLS (`sales_context_access`) decides how many
 * rows a write touches; the checked writer must surface every refusal instead of
 * reporting the unlink as done.
 */
describe("deal contact unlink authorization", () => {
  it("deal contact unlink permits an authorized active member", async () => {
    const db = fakeDb({ linked: true, primary: "c1" }, 1);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error).toBeNull();
    expect(db.writes).toHaveLength(2);
  });
  it("deal contact unlink refuses missing permission", async () => {
    const db = fakeDb({ linked: true, primary: "other" }, 0);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error?.code).toBe("42501");
  });
  it("deal contact unlink refuses an explicit deny", async () => {
    const db = fakeDb({ linked: true, primary: "c1" }, 0);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error?.code).toBe("42501");
    expect(db.writes).toEqual([{ table: "deal_contacts", op: "delete" }]);
  });
  it("deal contact unlink refuses a foreign workspace deal", async () => {
    const db = fakeDb({ linked: false, primary: "c1" }, 0);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error?.code).toBe("42501");
  });
  it("deal contact unlink refuses an inactive member", async () => {
    const db = fakeDb({ linked: false, primary: "c1" }, 0);
    const { error } = await unlinkDealContact(db.reader, "d1", "c1");
    expect(error?.code).toBe("42501");
    expect(db.writes).toEqual([{ table: "deals", op: "update" }]);
  });
});
