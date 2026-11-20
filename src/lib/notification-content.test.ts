import { beforeEach, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({ rpc: vi.fn(), client: null as unknown as SupabaseClient }));
vi.mock("./access-control/work-core.server", () => ({ workRpc: state.rpc }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => state.client.from(table as never) },
}));
import {
  activityNotificationContent,
  workflowApprovalNotificationContent,
} from "./notification-center";
import { runControlAction } from "./workflows/engine/actions-control.server";
import { tickActivityReminders } from "./activity-reminders.server";
import type { RunCtx } from "./workflows/engine/run-context";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  A = "bbbbbbbb-1111-4111-8111-111111111111",
  ID = "cccccccc-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.restoreAllMocks();
  state.rpc.mockReset();
  state.rpc.mockResolvedValue(true);
});

it("activity payload is bound to the activity and real workspace with neutral text", () => {
  expect(activityNotificationContent(ID, W, true)).toEqual({
    workspace_id: W,
    entity: "activities",
    entity_id: ID,
    link: `/tasks/${ID}`,
    body: "Abra a atividade no TechERP para consultar os comentários disponíveis para você.",
  });
  expect(() => activityNotificationContent(ID, "default workspace")).toThrow();
});
it("approval notice does not contain the workflow snapshot and uses a verified route shape", () => {
  expect(workflowApprovalNotificationContent(W, "deals", ID)).toMatchObject({
    workspace_id: W,
    entity: "deals",
    entity_id: ID,
    link: `/deals/${ID}`,
    title: "Aprovação necessária no TechERP",
  });
  expect(workflowApprovalNotificationContent(W, "ats_interviews", ID).link).toBeNull();
});
it("milestone approval notice points to its project tab and exact milestone without a snapshot", () => {
  const notice = workflowApprovalNotificationContent(W, "project_milestones", ID, A);
  expect(notice).toMatchObject({
    workspace_id: W,
    entity: "project_milestones",
    entity_id: ID,
    link: `/projects/${A}?tab=milestones&milestoneId=${ID}`,
  });
  expect(Object.keys(notice)).not.toContain("project_id");
  expect(workflowApprovalNotificationContent(W, "project_tasks", ID).link).toBe(
    `/projects/tasks?taskId=${ID}`,
  );
});
it.each([undefined, null, "", "https://external.example/project", `${A}?tab=private`, {}])(
  "does not invent a milestone project link from invalid relation %s",
  (parent) => {
    expect(
      workflowApprovalNotificationContent(W, "project_milestones", ID, parent).link,
    ).toBeNull();
  },
);
it("approval execution keeps private note in its decision record and sends a neutral source notice", async () => {
  const writes: { table: string; row: Record<string, unknown> }[] = [];
  const db = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        writes.push({ table, row });
        return { select: () => ({ single: async () => ({ data: { id: ID }, error: null }) }) };
      },
    }),
  } as unknown as SupabaseClient;
  const ctx = {
    ownerId: A,
    workspaceId: W,
    workflowId: ID,
    workflowVersion: 1,
    runId: ID,
    entity: "deals",
    entityId: ID,
    after: { confidential: "salary fixture" },
    before: {},
    vars: {},
  } as RunCtx;
  const result = await runControlAction(
    db,
    { type: "approval_step", title: "Private {{confidential}}", note: "Confidential note" },
    ctx,
    { index: 0, stepPath: "0", annotate: (s) => s, runActions: vi.fn() },
  );
  expect(result.done?.waitingApproval?.approvalId).toBe(ID);
  expect(writes.find((x) => x.table === "workflow_approvals")?.row).toMatchObject({
    workspace_id: W,
    note: "Confidential note",
  });
  const notice = writes.find((x) => x.table === "notifications")!.row;
  expect(notice).toMatchObject({
    workspace_id: W,
    entity: "deals",
    entity_id: ID,
    link: `/deals/${ID}`,
  });
  expect(JSON.stringify(notice)).not.toMatch(/salary fixture|Confidential note|Private/);
  writes.length = 0;
  const milestoneResult = await runControlAction(
    db,
    { type: "approval_step", title: "Private {{confidential}}" },
    {
      ...ctx,
      entity: "project_milestones",
      after: { project_id: A, confidential: "salary fixture" },
    },
    { index: 0, stepPath: "0", annotate: (s) => s, runActions: vi.fn() },
  );
  expect(milestoneResult.done?.waitingApproval?.approvalId).toBe(ID);
  const milestoneNotice = writes.find((item) => item.table === "notifications")!.row;
  expect(milestoneNotice.link).toBe(`/projects/${A}?tab=milestones&milestoneId=${ID}`);
  expect(milestoneNotice.entity).toBe("project_milestones");
  expect(JSON.stringify(milestoneNotice)).not.toMatch(/salary fixture|Private/);
});
it("approval recipient denial prevents creation and its notice", async () => {
  state.rpc.mockResolvedValue(false);
  const from = vi.fn();
  const ctx = {
    ownerId: A,
    workspaceId: W,
    workflowId: ID,
    entity: "deals",
    entityId: ID,
    after: {},
    before: {},
  } as RunCtx;
  await expect(
    runControlAction(
      { from } as unknown as SupabaseClient,
      { type: "approval_step", title: "Review" },
      ctx,
      { index: 0, stepPath: "0", annotate: (s) => s, runActions: vi.fn() },
    ),
  ).rejects.toThrow("Aprovador inativo");
  expect(from).not.toHaveBeenCalled();
});
it("the actual reminder worker persists a neutral activity origin rather than its parent's private subject", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-20T12:00:00Z"));
  let payload: unknown;
  state.client = createClient("https://fixture.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method ?? "GET";
        const respond = (value: unknown) =>
          new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
        if (url.pathname.endsWith("/activities"))
          return respond(
            method === "GET"
              ? [
                  {
                    id: ID,
                    owner_id: A,
                    workspace_id: W,
                    type: "task",
                    subject: "Sensitive salary fixture",
                    due_date: "2026-11-20T12:01:00Z",
                    remind_before_minutes: 5,
                    related_deal_id: A,
                  },
                ]
              : [],
          );
        if (url.pathname.endsWith("/profiles"))
          return respond([
            {
              id: A,
              full_name: "Fixture member",
              notification_preferences: { task: { inapp: true, email: false } },
            },
          ]);
        expect(url.pathname).toBe("/rest/v1/notifications");
        expect(method).toBe("POST");
        payload = JSON.parse(String(init?.body));
        return respond([]);
      },
    },
  });
  expect(await tickActivityReminders()).toMatchObject({ notified: 1, emailed: 0 });
  expect(payload).toEqual([
    expect.objectContaining({
      workspace_id: W,
      entity: "activities",
      entity_id: ID,
      link: `/tasks/${ID}`,
    }),
  ]);
  expect(JSON.stringify(payload)).not.toContain("Sensitive salary");
});
