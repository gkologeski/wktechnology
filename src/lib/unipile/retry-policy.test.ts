import { expect, it } from "vitest";
import { linkedinRetryPolicy } from "./retry-policy";
it("defers throttled sourcing without completing its step", () =>
  expect(linkedinRetryPolicy({ code: "rate_limited", retryAfterMs: 120000 }, 0)).toEqual({
    status: "active",
    nextRunAt: new Date(120000).toISOString(),
  }));
it("preserves a provider wait beyond a day", () =>
  expect(linkedinRetryPolicy({ code: "rate_limited", retryAfterMs: 172800000 }, 0).nextRunAt).toBe(
    new Date(172800000).toISOString(),
  ));
it("pauses an uncertain delivery for review", () =>
  expect(linkedinRetryPolicy({ code: "delivery_uncertain" }, 0)).toEqual({
    status: "paused",
    nextRunAt: null,
  }));
it("pauses a disconnected account rather than skipping the step", () =>
  expect(linkedinRetryPolicy({ code: "account_disconnected" }, 0).status).toBe("paused"));
it("pauses an unknown network failure for review", () =>
  expect(linkedinRetryPolicy({}, 0).status).toBe("paused"));
