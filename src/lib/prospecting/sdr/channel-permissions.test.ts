import { describe, expect, it } from "vitest";
import { transportCapabilities } from "./channel-permissions";
const context = (keys: string[], workspaceId: string | null = "w1") => ({
  workspaceId,
  isLoading: false,
  isError: false,
  can: (key: string) => keys.includes(key),
});
describe("connection configuration UI permissions", () => {
  it("allows active matching workspace transport management", () => {
    expect(
      transportCapabilities(
        "whatsapp",
        context(["system.whatsapp.view.workspace", "system.whatsapp.manage.workspace"]),
        "w1",
      ),
    ).toMatchObject({ view: true, manage: true });
  });
  it("rejects missing transport permission despite channel management", () => {
    expect(transportCapabilities("email", context(["system.channels.manage.workspace"])).view).toBe(
      false,
    );
  });
  it("preserves an effective management deny while allowing read", () => {
    expect(
      transportCapabilities("whatsapp", context(["system.whatsapp.view.workspace"])),
    ).toMatchObject({ view: true, manage: false });
  });
  it("rejects configuration for a foreign workspace", () => {
    expect(
      transportCapabilities(
        "whatsapp",
        context(["system.whatsapp.view.workspace", "system.whatsapp.manage.workspace"]),
        "w2",
      ).view,
    ).toBe(false);
  });
  it("rejects inactive context without an active workspace", () => {
    expect(
      transportCapabilities("chat", context(["system.widget.view.workspace"], null)).view,
    ).toBe(false);
  });
  it("keeps email connect, synchronization, deletion and composing independent", () => {
    expect(
      transportCapabilities(
        "email",
        context(["techsales.email_accounts.view.own", "techsales.email_accounts.update.own"]),
      ),
    ).toEqual({
      view: true,
      create: false,
      update: true,
      remove: false,
      manage: false,
      compose: false,
    });
  });
  it("fails closed while permissions are loading or unavailable", () => {
    expect(
      transportCapabilities("chat", { ...context(["system.widget.view.workspace"]), isError: true })
        .view,
    ).toBe(false);
  });
});
