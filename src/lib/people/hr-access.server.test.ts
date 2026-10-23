import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ active: vi.fn(), permission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: mocks.active,
  assertAnyPermission: mocks.permission,
}));
import { assertHrCreate, assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import { createHrOnboardingPlan } from "./onboarding-plan.server";
const client = { rpc: mocks.rpc } as unknown as SupabaseClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue("active-workspace");
  mocks.permission.mockResolvedValue(undefined);
});
it.each(["techpeople.people", "techhire.candidates", "techpeople.onboarding_templates"] as const)(
  "create uses only creation keys for %s",
  async (resource) => {
    expect(await assertHrCreate(client, "actor", resource)).toBe("active-workspace");
    expect(mocks.permission).toHaveBeenCalledWith(client, "actor", "active-workspace", [
      resource + ".create.workspace",
      resource + ".create.own",
    ]);
  },
);
it.each([false, null, "true"])("record access fails closed for %s", async (data) => {
  mocks.rpc.mockResolvedValue({ data, error: null });
  await expect(assertHrRecordAccess(client, "people", "update", "row")).rejects.toThrow(
    "sem permissão",
  );
});
it("record authorization delegates scope and actor to the authenticated database", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  await assertHrRecordAccess(client, "candidates", "delete", "candidate");
  expect(mocks.rpc).toHaveBeenCalledWith("hr_record_access", {
    _resource: "candidates",
    _action: "delete",
    _id: "candidate",
  });
});
it("an authorization service error never grants access", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: { message: "Database unavailable" } });
  await expect(assertHrRecordAccess(client, "people", "view", "row")).rejects.toThrow(
    "Database unavailable",
  );
});
it("creates plan and tasks through one authenticated RPC, without accepting a workspace payload", async () => {
  mocks.rpc.mockResolvedValue({ data: { id: "plan", existed: false, task_count: 2 }, error: null });
  expect(await createHrOnboardingPlan(client, { person_id: "person", kind: "onboarding" })).toEqual(
    { id: "plan", existed: false, task_count: 2 },
  );
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith("hr_create_onboarding_plan", {
    _person: "person",
    _kind: "onboarding",
    _template: null,
    _status: "in_progress",
    _started: null,
    _target: null,
    _notes: null,
    _automatic: false,
  });
});
it("propagates atomic creation failure rather than claiming a saved plan", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "Invalid template" } });
  await expect(
    createHrOnboardingPlan(client, { person_id: "person", kind: "offboarding" }),
  ).rejects.toThrow("Invalid template");
});
it.each([null, {}, { id: "plan", existed: true }])(
  "rejects unconfirmed creation result",
  async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(
      createHrOnboardingPlan(client, { person_id: "person", kind: "onboarding" }),
    ).rejects.toThrow("confirmar");
  },
);

// Child actions must not accidentally authorize against people.update.
it("child creation is checked against its parent and resource, never update", async () => {
  const { assertHrChildMutation } = await import("@/lib/access-control/hr-records.server");
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  await assertHrChildMutation(client, "documents", null, "person");
  expect(mocks.rpc).toHaveBeenCalledWith("hr_record_access", {
    _resource: "person_documents",
    _action: "create",
    _id: "person",
  });
});
it("child edition is checked against the actual row", async () => {
  const { assertHrChildMutation } = await import("@/lib/access-control/hr-records.server");
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  await assertHrChildMutation(client, "goals", "goal", "another-person");
  expect(mocks.rpc).toHaveBeenCalledWith("hr_record_access", {
    _resource: "goals",
    _action: "update",
    _id: "goal",
  });
});
