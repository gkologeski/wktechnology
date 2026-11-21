import { it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunCtx } from "@/lib/workflows/engine/run-context";
const state = vi.hoisted(() => ({ worker: vi.fn() }));
vi.mock("@/lib/access-control/sales-worker.server", () => ({ assertSalesWorker: state.worker }));
import { authorizeWorkflowStep } from "@/lib/workflows/engine/authorization.server";
import { SaveSchema } from "@/lib/workflows/schemas";
const U = "11111111-1111-4111-8111-111111111111",
  R = "22222222-2222-4222-8222-222222222222";
const ctx = {
  workspaceId: U,
  workflowId: U,
  workflowVersion: 1,
  runId: R,
  entity: "deals",
  entityId: R,
  ownerId: U,
  after: {},
  before: null,
  vars: {},
} as RunCtx;
const client = {} as SupabaseClient;
beforeEach(() => {
  state.worker.mockReset();
  state.worker.mockResolvedValue(undefined);
});
it("requires both read and create channel permissions for explicit notification transports", async () => {
  await authorizeWorkflowStep(client, ctx, {
    type: "send_notification",
    title: "Notice",
    delivery: { channels: ["whatsapp"], fallback: "email" },
  });
  expect(state.worker).toHaveBeenCalledWith(
    client,
    "workflows",
    U,
    expect.arrayContaining([
      { resource: "techsales.inbox.whatsapp", action: "view" },
      { resource: "techsales.inbox.whatsapp", action: "create" },
      { resource: "techsales.inbox.email", action: "view" },
      { resource: "techsales.inbox.email", action: "create" },
      { workflow_version: 1 },
      { table: "deals", id: R, action: "view" },
    ]),
  );
});
it("legacy inapp notification does not acquire unrelated external permissions", async () => {
  await authorizeWorkflowStep(client, ctx, { type: "send_notification", title: "Notice" });
  expect(JSON.stringify(state.worker.mock.calls)).not.toContain("inbox");
});
it("propagates channel deny before recipient dispatch", async () => {
  state.worker.mockRejectedValue(Error("transport denied"));
  await expect(
    authorizeWorkflowStep(client, ctx, {
      type: "send_notification",
      title: "Notice",
      delivery: { channels: ["email"], fallback: "none" },
    }),
  ).rejects.toThrow("transport denied");
});
it("workflow editor schema preserves old and explicit delivery actions", () => {
  const base = {
    name: "Rule",
    entity: "deals",
    enabled: false,
    trigger: { event: "created", filters: [] },
  };
  expect(
    SaveSchema.parse({ ...base, actions: [{ type: "send_notification", title: "Notice" }] })
      .actions[0],
  ).not.toHaveProperty("delivery");
  const delivery = { channels: ["whatsapp"], fallback: "email" };
  expect(
    SaveSchema.parse({
      ...base,
      actions: [{ type: "send_notification", title: "Notice", delivery }],
    }).actions[0],
  ).toHaveProperty("delivery", delivery);
});
