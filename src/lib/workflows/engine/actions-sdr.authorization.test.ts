import { describe, expect, it, vi } from "vitest";
import { handleSdrAction, hasReplySince } from "./actions-sdr.server";
import type { RunCtx } from "./run-context";
const source = (): RunCtx => ({
  entity: "leads",
  entityId: "lead-1",
  workspaceId: "ws-1",
  ownerId: "actor-1",
  workflowId: "wf-1",
  after: { phone: "+5548991104003" },
  before: null,
});
function deniedDb() {
  const update = vi.fn();
  const rpc = vi.fn(async () => ({ data: false, error: null }));
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    gt: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({
      data: { id: "conv-1", contact_phone: "+5548991104003" },
      error: null,
    }),
    then: (resolve: (data: unknown) => unknown) =>
      resolve({ data: [{ id: "message-1" }], error: null }),
    update,
  };
  return { db: { from: () => query, rpc } as never, update, rpc };
}
describe("SDR workflow effect authorization", () => {
  for (const action of [
    { type: "sdr_agent", mode: "off" },
    { type: "handoff", reason: "Atendimento", user_id: "recipient" },
  ] as const)
    it(`blocks ${action.type} before mutating an inaccessible conversation`, async () => {
      const c = deniedDb();
      await expect(
        handleSdrAction(c.db, action, source(), new Date().toISOString()),
      ).rejects.toThrow("suspensa");
      expect(c.update).not.toHaveBeenCalled();
      expect(c.rpc).toHaveBeenCalledWith(
        "sales_worker_authorize",
        expect.objectContaining({
          p_refs: expect.arrayContaining([
            { table: "whatsapp_conversations", id: "conv-1", action: "update" },
          ]),
        }),
      );
    });
  it("does not use a message outside the owner's permitted Inbox to branch a workflow", async () => {
    const c = deniedDb();
    await expect(
      hasReplySince(c.db, source(), ["whatsapp"], "2026-10-25T00:00:00Z"),
    ).rejects.toThrow("suspensa");
    expect(c.rpc).toHaveBeenCalledWith(
      "sales_worker_authorize",
      expect.objectContaining({ p_refs: [{ table: "whatsapp_messages", id: "message-1" }] }),
    );
  });
});
