import { expect, it } from "vitest";
import { linkedinCallbackTarget } from "./callback-target";
const input = { account_id: "account", state: "a".repeat(64) };
it("passes a bounded callback pointer to local authenticated settings", () =>
  expect(linkedinCallbackTarget(input).ok).toBe(true));
it("rejects absent state", () =>
  expect(linkedinCallbackTarget({ account_id: "account" }).ok).toBe(false));
it("rejects provider failure even with valid pointers", () =>
  expect(linkedinCallbackTarget({ ...input, error_type: "denied" }).ok).toBe(false));
it("cannot redirect to another site", () =>
  expect(linkedinCallbackTarget({ ...input, redirect: "https://evil.test" }).target).toMatch(
    /^\/settings\/integrations\/linkedin\?/,
  ));
it("rejects an oversized account pointer", () =>
  expect(linkedinCallbackTarget({ ...input, account_id: "x".repeat(201) }).ok).toBe(false));
