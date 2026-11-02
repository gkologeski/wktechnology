import { describe, expect, it } from "vitest";
import { messengerAllowed } from "./messenger-gate";

const perms = (keys: string[], extra: { isLoading?: boolean; isError?: boolean } = {}) => ({
  isLoading: extra.isLoading ?? false,
  isError: extra.isError ?? false,
  can: (k: string) => keys.includes(k),
});

describe("side dock messenger gate", () => {
  it("side dock allows messenger with permission", () => {
    expect(messengerAllowed(perms(["system.messenger.view.own"]))).toBe(true);
  });
  it("side dock hides messenger without permission", () => {
    expect(messengerAllowed(perms([]))).toBe(false);
  });
  it("side dock hides messenger when deny removes the key", () => {
    expect(messengerAllowed(perms(["system.messenger.view.team"]))).toBe(false);
  });
  it("side dock hides messenger when workspace context fails", () => {
    expect(messengerAllowed(perms(["system.messenger.view.own"], { isError: true }))).toBe(false);
  });
  it("side dock hides messenger while inactive membership has no loaded permissions", () => {
    expect(messengerAllowed(perms(["system.messenger.view.own"], { isLoading: true }))).toBe(false);
  });
});
