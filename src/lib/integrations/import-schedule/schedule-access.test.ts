import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: vi.fn(async () => "00000000-0000-0000-0000-0000000000aa"),
}));
import { authorizeImportSchedule } from "./schedule.server";

const U = "00000000-0000-0000-0000-000000000001";
const client = (data: unknown, message?: string) =>
  ({
    rpc: vi
      .fn()
      .mockResolvedValue(message ? { data: null, error: { message } } : { data, error: null }),
  }) as unknown as SupabaseClient;

describe("agenda de importação contínua — acesso", () => {
  it("import schedule permits an authorized active admin", async () => {
    const c = client(true);
    const ctx = await authorizeImportSchedule(c, U, "clickup", true);
    expect(ctx.workspaceId).toBe("00000000-0000-0000-0000-0000000000aa");
    expect(c.rpc).toHaveBeenCalledWith("clickup_import_access", {
      p_ws: ctx.workspaceId,
      p_user: U,
      p_action: "manage",
    });
  });
  it("import schedule rejects missing permission", async () => {
    await expect(authorizeImportSchedule(client(false), U, "clickup", true)).rejects.toThrow();
  });
  it("import schedule rejects explicit deny", async () => {
    await expect(
      authorizeImportSchedule(client(null, "explicit deny"), U, "clickup", true),
    ).rejects.toThrow();
  });
  it("import schedule rejects a foreign workspace", async () => {
    await expect(
      authorizeImportSchedule(client(null, "foreign workspace"), U, "clickup", false),
    ).rejects.toThrow();
  });
  it("import schedule rejects inactive membership", async () => {
    await expect(
      authorizeImportSchedule(client(null, "inactive membership"), U, "clickup", false),
    ).rejects.toThrow();
  });
  it("lista do ClickUp nunca importada fica fora da importação automática", async () => {
    const { groupsToHold } = await import("./clickup-schedule.server");
    const held = groupsToHold(
      [
        { id: "a", list_ext_id: "L1", action: "import" },
        { id: "b", list_ext_id: "L2", action: "import" },
        { id: "c", list_ext_id: "L3", action: "skip" },
      ],
      new Set(["L1"]),
    );
    expect(held.map((g) => g.id)).toEqual(["b"]);
  });
});
