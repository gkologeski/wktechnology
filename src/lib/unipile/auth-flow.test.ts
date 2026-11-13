import { expect, it } from "vitest";
import { validateLinkedinCallback } from "./auth-flow";
const base = {
  expectedStateHash: "issued",
  actualStateHash: "issued",
  expiresAt: "2030-01-01",
  consumed: false,
  expectedScope: "personal",
  expectedAccountId: "account",
  account: { id: "account", provider: "linkedin", status: "running", account_scope_id: "personal" },
  now: 0,
};
it("accepts the exact operational account in its personal scope", () =>
  expect(validateLinkedinCallback(base).id).toBe("account"));
it("rejects a different state", () =>
  expect(() => validateLinkedinCallback({ ...base, actualStateHash: "forged" })).toThrow());
it("rejects an expired authentication", () =>
  expect(() => validateLinkedinCallback({ ...base, expiresAt: "1970-01-01" })).toThrow());
it("rejects a consumed flow", () =>
  expect(() => validateLinkedinCallback({ ...base, consumed: true })).toThrow());
it("rejects another workspace or user's scope", () =>
  expect(() => validateLinkedinCallback({ ...base, expectedScope: "foreign" })).toThrow());
it("rejects a different provider account", () =>
  expect(() => validateLinkedinCallback({ ...base, expectedAccountId: "foreign" })).toThrow());
it("rejects disconnected provider status", () =>
  expect(() =>
    validateLinkedinCallback({ ...base, account: { ...base.account, status: "disconnected" } }),
  ).toThrow());
it("rejects a non LinkedIn provider", () =>
  expect(() =>
    validateLinkedinCallback({ ...base, account: { ...base.account, provider: "instagram" } }),
  ).toThrow());
