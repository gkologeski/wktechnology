import { describe, expect, it, vi } from "vitest";
import { applyRotation } from "./engine.server";
function db() {
  const update = vi.fn();
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({
      data: {
        id: "rule",
        entity: "leads",
        enabled: true,
        strategy: "round_robin",
        assignees: [{ user_id: "next" }],
        last_index: -1,
      },
      error: null,
    }),
    update,
  };
  return { client: { from: () => query } as never, update };
}
describe("delegated rotation", () => {
  it("uses the delegated writer and current assignee without changing original author", async () => {
    const c = db(),
      write = vi.fn(async () => undefined);
    await applyRotation(c.client, "rule", "leads", "lead", write);
    expect(write.mock.calls[0]).toEqual(["leads", "lead", { assigned_to: "next" }]);
    expect(write).toHaveBeenLastCalledWith(
      "rotation_rules",
      "rule",
      expect.objectContaining({ last_assigned_user_id: "next" }),
    );
    expect(c.update).not.toHaveBeenCalled();
  });
  it("does not advance the rotation checkpoint after a denied assignment", async () => {
    const c = db(),
      write = vi.fn(async () => {
        throw new Error("denied by RLS");
      });
    await expect(applyRotation(c.client, "rule", "leads", "lead", write)).rejects.toThrow("denied");
    expect(write).toHaveBeenCalledTimes(1);
    expect(c.update).not.toHaveBeenCalled();
  });
});
