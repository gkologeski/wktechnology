import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  permission: vi.fn(),
  workspace: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const c = { middleware: () => c, inputValidator: () => c, handler: (f: unknown) => f };
    return c;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/hr-records.server", () => ({ assertHrRecordAccess: mocks.record }));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: mocks.workspace,
  assertAnyPermission: mocks.permission,
}));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: mocks.workspace }));
import { saveScorecard, deleteScorecard } from "./scorecards.functions";
import { saveInterviewKit, deleteInterviewKit } from "./interview-kits.functions";
import {
  upsertPool,
  deletePool,
  upsertAvailability,
  deleteAvailability,
  findCommonSlots,
  assignFromPool,
} from "./scheduling.functions";
const call = (fn: unknown, data: unknown) =>
  (fn as (args: unknown) => Promise<unknown>)({
    context: { userId: "actor", supabase: { from: mocks.from, rpc: mocks.rpc } },
    data,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue("ws");
  mocks.record.mockRejectedValue(new Error("record denied"));
  mocks.permission.mockRejectedValue(new Error("key denied"));
});
for (const [label, fn, data] of [
  ["scorecard update", saveScorecard, { id: "id" }],
  ["scorecard delete", deleteScorecard, { id: "id" }],
  ["kit update", saveInterviewKit, { id: "id" }],
  ["kit delete", deleteInterviewKit, { id: "id" }],
  ["pool update", upsertPool, { id: "id" }],
  ["pool delete", deletePool, { id: "id" }],
  ["availability update", upsertAvailability, { id: "id" }],
  ["availability delete", deleteAvailability, { id: "id" }],
] as const)
  it(label + " denies before any data query", async () => {
    await expect(call(fn, data)).rejects.toThrow("record denied");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
it("denies new scorecard, kit and pool without create before any mutation", async () => {
  for (const fn of [saveScorecard, saveInterviewKit, upsertPool])
    await expect(call(fn, {})).rejects.toThrow("key denied");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("fails closed on busy metadata failure instead of inventing slots", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "agenda denied" } });
  await expect(
    call(findCommonSlots, { interviewer_ids: ["user"], from: "x", to: "y" }),
  ).rejects.toThrow("agenda denied");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("only returns a pool choice after the transactional RPC succeeds", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "pool denied" } });
  await expect(call(assignFromPool, { pool_id: "pool" })).rejects.toThrow("pool denied");
  mocks.rpc.mockResolvedValue({ data: "member", error: null });
  expect(await call(assignFromPool, { pool_id: "pool" })).toEqual({ interviewer_id: "member" });
  expect(mocks.from).not.toHaveBeenCalled();
});
