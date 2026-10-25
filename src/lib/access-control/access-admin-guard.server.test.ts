import { describe, it, expect } from "vitest";
import { assertAccessManagementPermission } from "./access-admin-guard.server";
const client = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) });
describe("access management matrix guard", () => {
  it("accepts only the effective workspace key from the canonical object map", async () => {
    expect(
      await assertAccessManagementPermission(
        client({ workspace: "A", keys: { "system.roles.view.workspace": true }, read_only: false }),
        "view",
        "A",
      ),
    ).toBe("A");
    await expect(
      assertAccessManagementPermission(
        client({ workspace: "A", keys: { "system.roles.view.own": true } }),
        "view",
        "A",
      ),
    ).rejects.toThrow();
    await expect(
      assertAccessManagementPermission(
        client({ workspace: "A", keys: { "system.roles.view.workspace": false } }),
        "view",
        "A",
      ),
    ).rejects.toThrow();
  });
  it("rejects workspace changes, read-only writes and context errors", async () => {
    const ctx = {
      workspace: "A",
      keys: { "system.roles.manage.workspace": true },
      read_only: true,
    };
    await expect(assertAccessManagementPermission(client(ctx), "manage", "A")).rejects.toThrow();
    await expect(
      assertAccessManagementPermission(client({ ...ctx, read_only: false }), "manage", "B"),
    ).rejects.toThrow();
    await expect(
      assertAccessManagementPermission(client(null, { message: "unavailable" }), "view"),
    ).rejects.toThrow("unavailable");
  });
});
