import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.workspace }));
import { readWorkspaceSettings, writeWorkspaceSettings } from "./workspace-settings.server";
const client = { rpc: mocks.rpc } as unknown as SupabaseClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("active-workspace");
});
describe("settings use authenticated database authorization", () => {
  it.each(["payments", "nfse", "meeting"] as const)(
    "reads only the requested %s section",
    async (section) => {
      mocks.rpc.mockResolvedValue({ data: { enabled: true }, error: null });
      expect(await readWorkspaceSettings(client, "actor", section)).toEqual({ enabled: true });
      expect(mocks.workspace).toHaveBeenCalledWith(client, "actor");
      expect(mocks.rpc).toHaveBeenCalledWith("get_workspace_sensitive_settings", {
        _workspace: "active-workspace",
        _section: section,
      });
    },
  );
  it("cannot invoke the RPC without an active workspace", async () => {
    mocks.workspace.mockRejectedValue(new Error("No workspace"));
    await expect(readWorkspaceSettings(client, "actor", "payments")).rejects.toThrow(
      "No workspace",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("propagates authorization denial without privileged fallback", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "database internal detail" },
    });
    await expect(writeWorkspaceSettings(client, "actor", "meeting", {})).rejects.toThrow(
      "Você não tem permissão",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, [], "settings"])("rejects malformed read results: %s", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(readWorkspaceSettings(client, "actor", "nfse")).rejects.toThrow("carregar");
  });
  it.each([true, false])("accepts confirmed save or idempotent result %s", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await writeWorkspaceSettings(client, "actor", "payments", { gateway: "manual" });
    expect(mocks.rpc).toHaveBeenCalledWith("save_workspace_sensitive_settings", {
      _workspace: "active-workspace",
      _section: "payments",
      _value: { gateway: "manual" },
    });
  });
  it("does not report unconfirmed saves as success", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(writeWorkspaceSettings(client, "actor", "nfse", {})).rejects.toThrow("confirmar");
  });
});
