import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({
  recovery: vi.fn(),
  dynamic: vi.fn(),
  worker: vi.fn(),
  legacy: vi.fn(),
  log: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/cron-observability.server", () => ({ runCronWithLogging: m.log }));
vi.mock("./voice.server", () => ({ reconcileSequenceVoice: m.recovery }));
vi.mock("./dynamic.server", () => ({ tickSequenceSubscriptions: m.dynamic }));
vi.mock("./worker.server", () => ({ tickProspectingSequences: m.worker }));
vi.mock("./delivery.server", () => ({ sequenceDeliveryPorts: () => ({}) }));
vi.mock("./handoff.server", () => ({ sequenceHandoff: () => ({}) }));
vi.mock("@/lib/sequences/engine.server", () => ({ tickSequences: m.legacy }));
import { scheduledSequenceTick } from "./tick.server";
const admin = {} as SupabaseClient;
const request = (token?: string) =>
  new Request("https://example.test/api/public/hooks/sequences-tick", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "synthetic-cron");
  vi.clearAllMocks();
  m.order.length = 0;
  m.recovery.mockImplementation(async () => {
    m.order.push("recovery");
    return { checked: 0, failed: 0 };
  });
  m.dynamic.mockImplementation(async () => {
    m.order.push("dynamic");
    return { scanned: 0, started: 0, failed: 0 };
  });
  m.worker.mockImplementation(async () => {
    m.order.push("worker");
    return {
      processed: 1,
      deferredByBudget: 0,
      repaired: { fixed: 0, failed: 0 },
      released: 0,
      awakened: 0,
      replied: 0,
      results: [{ id: "private-run", status: "blocked" }],
    };
  });
  m.legacy.mockImplementation(async () => {
    m.order.push("legacy");
    return {
      processed: 1,
      results: [{ id: "private-legacy", ok: false, error: "private-provider-detail" }],
    };
  });
  m.log.mockImplementation(async (_name, task) => {
    try {
      const metrics = await task();
      return { status: "success", duration_ms: 1, metrics };
    } catch (e) {
      return { status: "error", duration_ms: 1, error: (e as Error).message, metrics: {} };
    }
  });
});
afterEach(() => vi.unstubAllEnvs());
it("scheduled tick allows the service secret and preserves bounded stage order", async () => {
  const response = await scheduledSequenceTick(request("synthetic-cron"), admin);
  expect(response.status).toBe(200);
  expect(m.order).toEqual(["recovery", "dynamic", "worker", "legacy"]);
  expect(m.worker).toHaveBeenCalledWith(admin, {}, 5, 20000);
  expect(m.legacy).toHaveBeenCalledWith(admin, 100);
  const body = await response.text();
  expect(body).not.toContain("private-");
  expect(body).toContain('"blocked":1');
});
it("scheduled tick rejects missing service permission before any work", async () => {
  expect((await scheduledSequenceTick(request(), admin)).status).toBe(401);
  expect(m.log).not.toHaveBeenCalled();
  expect(m.order).toEqual([]);
});
it("scheduled tick explicitly refuses the wrong service secret", async () => {
  expect((await scheduledSequenceTick(request("wrong"), admin)).status).toBe(401);
  expect(m.log).not.toHaveBeenCalled();
  expect(m.order).toEqual([]);
});
it("scheduled tick refuses missing server configuration before any work", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await scheduledSequenceTick(request("synthetic-cron"), admin)).status).toBe(500);
  expect(m.log).not.toHaveBeenCalled();
});
it("scheduled tick still executes independent stages after a failure and hides raw errors", async () => {
  m.dynamic.mockImplementationOnce(async () => {
    m.order.push("dynamic");
    throw Error("private-provider-payload");
  });
  const response = await scheduledSequenceTick(request("synthetic-cron"), admin);
  expect(response.status).toBe(500);
  expect(m.order).toEqual(["recovery", "dynamic", "worker", "legacy"]);
  expect(await response.text()).not.toContain("private-provider-payload");
});
