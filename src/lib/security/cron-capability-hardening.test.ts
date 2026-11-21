import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requireCronAuth } from "@/lib/cron-auth.server";
beforeEach(() => vi.stubEnv("CRON_SECRET", "synthetic-cron-secret"));
afterEach(() => vi.unstubAllEnvs());
const request = (key: string) =>
  new Request("https://app.example.invalid/api/public/hooks/ats-emails-tick", {
    headers: { authorization: `Bearer ${key}` },
  });
it("cron capability permits its configured service credential", () => {
  expect(requireCronAuth(request("synthetic-cron-secret"))).toBeNull();
});
it("cron capability rejects missing service credential", () => {
  expect(requireCronAuth(new Request("https://app.example.invalid"))?.status).toBe(401);
});
it("cron capability rejects invalid service credential", () => {
  expect(requireCronAuth(request("invalid"))?.status).toBe(401);
});
it("cron capability rejects credentials from another service", () => {
  expect(requireCronAuth(request("synthetic-other-key"))?.status).toBe(401);
});
it("cron capability rejects revoked service credential", () => {
  vi.stubEnv("CRON_SECRET", "rotated-secret");
  expect(requireCronAuth(request("synthetic-cron-secret"))?.status).toBe(401);
});
