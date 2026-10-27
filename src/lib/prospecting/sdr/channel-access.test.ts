import { describe, expect, it, vi } from "vitest";
import { requireChannelAccess } from "./channel-access.server";
const user = "user-a";
const client = (error?: string, access = { workspace: "workspace-a", actor: user, keys: {} }) => ({
  rpc: vi
    .fn()
    .mockResolvedValue(
      error ? { error: { message: error }, data: null } : { data: access, error: null },
    ),
});
describe("service channel boundary", () => {
  it("allows active authorized channel manager", async () => {
    const db = client();
    await expect(requireChannelAccess(db as any, user, "manage")).resolves.toMatchObject({
      actor: user,
    });
    expect(db.rpc).toHaveBeenCalledWith("service_channel_authorize", { p_action: "manage" });
  });
  it("rejects missing channel permission", async () => {
    await expect(
      requireChannelAccess(client("missing permission") as any, user, "manage"),
    ).rejects.toThrow("missing permission");
  });
  it("rejects explicit channel deny", async () => {
    await expect(
      requireChannelAccess(client("explicit deny") as any, user, "view"),
    ).rejects.toThrow("explicit deny");
  });
  it("rejects foreign workspace channel access", async () => {
    await expect(
      requireChannelAccess(client("foreign workspace") as any, user, "manage"),
    ).rejects.toThrow("foreign workspace");
  });
  it("rejects inactive channel member", async () => {
    await expect(
      requireChannelAccess(client("inactive member") as any, user, "view"),
    ).rejects.toThrow("inactive member");
  });
  it("rejects a mismatched resolved actor", async () => {
    await expect(
      requireChannelAccess(
        client(undefined, { workspace: "workspace-a", actor: "other", keys: {} }) as any,
        user,
        "view",
      ),
    ).rejects.toThrow("Sessão");
  });
});
