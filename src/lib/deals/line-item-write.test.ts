import { describe, expect, it } from "vitest";
import {
  LINE_ITEM_BUSY_MESSAGE,
  LINE_ITEM_DENIED_MESSAGE,
  LINE_ITEM_RLS_MESSAGE,
  updateLineItemGuarded,
  type LineItemUpdateClient,
} from "./line-item-write";

type Reply = { data: { id: string }[] | null; error: { message?: string } | null };

function client(replies: Reply[]) {
  let calls = 0;
  const c: LineItemUpdateClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => Promise.resolve(replies[Math.min(calls++, replies.length - 1)]!),
        }),
      }),
    }),
  };
  return { c, calls: () => calls };
}

describe("line item update", () => {
  it("line item update permits an authorized active member", async () => {
    const { c } = client([{ data: [{ id: "a" }], error: null }]);
    expect(await updateLineItemGuarded(c, "a", { quantity: 2 })).toEqual({ ok: true });
  });

  it("line item update refuses missing permission", async () => {
    const { c } = client([
      { data: null, error: { message: "new row violates row-level security policy" } },
    ]);
    expect(await updateLineItemGuarded(c, "a", {})).toEqual({
      ok: false,
      message: LINE_ITEM_RLS_MESSAGE,
    });
  });

  it("line item update refuses an explicit deny", async () => {
    const { c } = client([{ data: [], error: null }]);
    expect(await updateLineItemGuarded(c, "a", {})).toEqual({
      ok: false,
      message: LINE_ITEM_DENIED_MESSAGE,
    });
  });

  it("line item update refuses a foreign workspace item", async () => {
    const { c } = client([{ data: null, error: null }]);
    expect((await updateLineItemGuarded(c, "other", {})).ok).toBe(false);
  });

  it("line item update refuses an inactive member", async () => {
    const { c } = client([{ data: null, error: { message: "permission denied for table" } }]);
    expect(await updateLineItemGuarded(c, "a", {})).toEqual({
      ok: false,
      message: LINE_ITEM_RLS_MESSAGE,
    });
  });

  it("retries statement timeout and succeeds", async () => {
    const { c, calls } = client([
      { data: null, error: { message: "canceling statement due to statement timeout" } },
      { data: [{ id: "a" }], error: null },
    ]);
    expect(await updateLineItemGuarded(c, "a", {})).toEqual({ ok: true });
    expect(calls()).toBe(2);
  });

  it("shows a Portuguese message after repeated timeouts", async () => {
    const { c } = client([
      { data: null, error: { message: "canceling statement due to statement timeout" } },
    ]);
    expect(await updateLineItemGuarded(c, "a", {})).toEqual({
      ok: false,
      message: LINE_ITEM_BUSY_MESSAGE,
    });
  });
});
