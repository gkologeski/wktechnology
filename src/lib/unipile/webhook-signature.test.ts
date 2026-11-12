import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { verifyUnipileSignature } from "./webhook-signature.server";
const body = '{"event_type":"account.connected"}';
const secret = "isolated-test-endpoint-secret";
const t = 1800000000;
const sign = (value = body, key = secret) =>
  `t=${t},v0=${createHmac("sha256", key).update(`${t}.${value}`).digest("hex")}`;
it("accepts a valid timestamped provider signature", () =>
  expect(verifyUnipileSignature(body, sign(), secret, t)).toBe(true));
it("rejects a missing provider signature", () =>
  expect(verifyUnipileSignature(body, null, secret, t)).toBe(false));
it("rejects a modified raw body", () =>
  expect(verifyUnipileSignature(body + " ", sign(), secret, t)).toBe(false));
it("rejects another endpoint secret", () =>
  expect(verifyUnipileSignature(body, sign(body, "foreign"), secret, t)).toBe(false));
it("rejects expired and future signatures", () => {
  expect(verifyUnipileSignature(body, sign(), secret, t + 301)).toBe(false);
  expect(verifyUnipileSignature(body, sign(), secret, t - 301)).toBe(false);
});
it("rejects malformed signatures", () => {
  for (const s of ["t=NaN,v0=abc", "t=1800000000,v0=abc", sign() + ",v0=abc"])
    expect(verifyUnipileSignature(body, s, secret, t)).toBe(false);
});
