import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunCtx } from "@/lib/workflows/engine/run-context";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: rpc }));
import { dispatchWorkflowSlack } from "./slack-dispatch.server";
const W = "11111111-1111-4111-8111-111111111111";
const client = {} as SupabaseClient;
const ctx: RunCtx = {
  workspaceId: W,
  workflowId: W,
  runId: W,
  workflowVersion: 1,
  notificationStepKey: "root/0",
  ownerId: W,
  entity: "deals",
  entityId: W,
  before: null,
  after: { title: "PRIVATE", email: "private@example.com" },
  vars: { secret: "PRIVATE" },
};
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ result: "queued", deliveryId: W });
});
it("Slack dispatch queues only canonical execution identifiers without private content", async () => {
  expect(
    await dispatchWorkflowSlack(client, { type: "send_slack", text: "{{secret}}" }, ctx),
  ).toEqual({ result: "queued", deliveryId: W });
  expect(rpc).toHaveBeenCalledWith(client, "notification_workflow_slack_dispatch", {
    p_workspace: W,
    p_workflow: W,
    p_run: W,
    p_step_path: "root/0",
    p_version: 1,
  });
  expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/PRIVATE|private@example|secret/);
});
it.each(["workflowId", "runId", "workflowVersion", "notificationStepKey"] as const)(
  "Slack dispatch rejects missing %s before IO",
  async (key) => {
    await expect(
      dispatchWorkflowSlack(
        client,
        { type: "send_slack", text: "old" },
        { ...ctx, [key]: undefined },
      ),
    ).rejects.toThrow("origem verificável");
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("Slack dispatch blocks old channel overrides instead of posting to the wrong channel", async () => {
  await expect(
    dispatchWorkflowSlack(client, { type: "send_slack", text: "old", channel: "#secret" }, ctx),
  ).rejects.toThrow("canal fixo");
  expect(rpc).not.toHaveBeenCalled();
});
it("Slack dispatch propagates database source denial without pretending acceptance", async () => {
  rpc.mockRejectedValue(Error("source denied"));
  await expect(
    dispatchWorkflowSlack(client, { type: "send_slack", text: "old" }, ctx),
  ).rejects.toThrow("source denied");
});
it("Slack dispatch preserves suppression and deduplication as distinct queue outcomes", async () => {
  rpc.mockResolvedValue({ result: "suppressed", reason: "disabled" });
  expect(await dispatchWorkflowSlack(client, { type: "send_slack", text: "old" }, ctx)).toEqual({
    result: "suppressed",
    reason: "disabled",
  });
  rpc.mockResolvedValue({ result: "duplicate" });
  expect(await dispatchWorkflowSlack(client, { type: "send_slack", text: "old" }, ctx)).toEqual({
    result: "duplicate",
  });
});
