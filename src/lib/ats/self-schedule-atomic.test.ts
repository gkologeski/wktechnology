import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), audit: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const c = { middleware: () => c, inputValidator: () => c, handler: (fn: unknown) => fn };
    return c;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("./audit.server", () => ({ recordAtsEvent: mocks.audit }));
vi.mock("@lovable.dev/email-js", () => ({ sendLovableEmail: vi.fn() }));
vi.mock("@/lib/email-unsubscribe.server", () => ({ getOrCreateEmailUnsubscribeToken: vi.fn() }));
import { confirmSelfSchedule } from "./self-schedule.functions";
import { confirmSelfScheduledSlot } from "./interviews-engine.server";
const token = "a".repeat(64);
let slot: string;
let row: Record<string, unknown>;
let claims: number;
let loseAll: boolean;
const queries: Array<{
  table: string;
  filters: Array<[string, unknown]>;
  payload?: Record<string, unknown>;
}> = [];
const call = (fn: unknown, data: unknown) => (fn as (x: unknown) => Promise<unknown>)({ data });
beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  claims = 0;
  loseAll = false;
  slot = new Date(Date.now() + 86400_000).toISOString();
  row = {
    id: "interview",
    owner_id: "creator",
    application_id: "app",
    job_id: "job",
    candidate_id: "candidate",
    status: "pending_candidate",
    slots: [slot],
    offered_slots: [slot],
    self_schedule_expires_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
  };
  mocks.from.mockImplementation((table: string) => {
    const record: (typeof queries)[number] = { table, filters: [] };
    queries.push(record);
    let write = false;
    const finish = async () => ({
      data: write ? (++claims === 1 && !loseAll ? { id: "interview" } : null) : row,
      error: null,
    });
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        record.filters.push([k, v]);
        return q;
      },
      maybeSingle: finish,
      update: (p: Record<string, unknown>) => {
        write = true;
        record.payload = p;
        return q;
      },
      insert: (p: Record<string, unknown>) => {
        record.payload = p;
        return q;
      },
      then: (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };
    return q;
  });
});
it("concurrent confirmations of one invitation produce exactly one success and one audit event", async () => {
  const result = await Promise.allSettled([
    call(confirmSelfSchedule, { token, slot }),
    call(confirmSelfSchedule, { token, slot }),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(mocks.audit).toHaveBeenCalledTimes(1);
  for (const q of queries.filter((q) => q.payload && q.table === "ats_interviews")) {
    expect(q.filters).toContainEqual(["status", "pending_candidate"]);
    expect(q.filters).toContainEqual(["self_schedule_token", token]);
    expect(q.payload).toHaveProperty("self_schedule_token", null);
  }
});
it("the reminder engine also refuses a confirmation that lost its conditional update", async () => {
  loseAll = true;
  expect(await confirmSelfScheduledSlot({ token, slot })).toEqual({
    ok: false,
    error: "Horário já confirmado ou indisponível",
  });
  expect(queries.some((q) => q.table === "ats_application_events")).toBe(false);
});
it.each(["expired", "past", "unoffered"])("a %s invitation/slot cannot be booked", async (mode) => {
  if (mode === "expired")
    row.self_schedule_expires_at = new Date(Date.now() - 86400_000).toISOString();
  if (mode === "past") {
    slot = new Date(Date.now() - 86400_000).toISOString();
    row.slots = [slot];
    row.offered_slots = [slot];
  }
  if (mode === "unoffered") slot = new Date(Date.now() + 3 * 86400_000).toISOString();
  await expect(call(confirmSelfSchedule, { token, slot })).rejects.toThrow();
  expect((await confirmSelfScheduledSlot({ token, slot })).ok).toBe(false);
  expect(queries.some((q) => q.payload)).toBe(false);
});
