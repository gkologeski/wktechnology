import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: vi.fn(async () => "00000000-0000-0000-0000-0000000000aa"),
}));
import { authorizeImportSchedule, saveSchedule } from "./schedule.server";

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
  it("ClickUp não aceita importação contínua ligada", async () => {
    await expect(
      saveSchedule(
        client(true),
        { workspaceId: "w", userId: U },
        {
          provider: "clickup",
          enabled: true,
          frequency: "daily",
          runHour: 2,
          runWeekday: 1,
          mode: "preview",
        },
      ),
    ).rejects.toThrow(/ClickUp/);
  });
});
