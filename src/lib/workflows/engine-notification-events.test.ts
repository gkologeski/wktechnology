import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowTrigger } from "./types";
import { workflowNotificationEventTrigger } from "./notification-events";

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  hydrate: vi.fn(),
  items: vi.fn(),
  actions: vi.fn(),
}));
vi.mock("./engine/authorization.server", async () => ({
  ...(await vi.importActual<typeof import("./engine/authorization.server")>(
    "./engine/authorization.server",
  )),
  authorizeWorkflowStep: state.authorize,
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
vi.mock("./hydrate-associations.server", () => ({ hydrateTriggerAssociations: state.hydrate }));
vi.mock("./line-items.server", () => ({ hydrateDealLineItems: state.items }));
vi.mock("./engine-actions.server", () => ({ runActions: state.actions }));
import { processEvent, tickWorkflows, type EventRow } from "./engine-runtime.server";

const W = "11111111-1111-4111-8111-111111111111";
const namedEvent = (): EventRow => ({
  id: "event",
  workspace_id: W,
  owner_id: "record-owner",
  entity: "deals",
  entity_id: "deal",
  event_type: "updated",
  before: { workspace_id: W },
  after: { workspace_id: W },
  notification_event_key: "crm.deal.won",
});
function workflow(
  id = "named",
  trigger: WorkflowTrigger = workflowNotificationEventTrigger("crm.deal.won"),
) {
  return {
    id,
    workspace_id: W,
    owner_id: "workflow-admin",
    execution_user_id: "executor",
    entity: "deals",
    enabled: true,
    status: "published",
    published_version: 3,
    trigger,
    actions: [{ type: "send_notification", title: "Atualização" }],
  };
}
type Row = Record<string, unknown>;
function database(workflows: Row[], events: EventRow[] = []) {
  const runs: Row[] = [],
    resumes: Row[] = [],
    eventUpdates: Row[] = [];
  const reads: { table: string; filters: Record<string, unknown>; columns: string }[] = [];
  const from = vi.fn((table: string) => {
    const read = { table, filters: {} as Record<string, unknown>, columns: "" };
    reads.push(read);
    let operation = "select",
      inserted: Row | null = null;
    const matches = (row: Row) =>
      Object.entries(read.filters).every(([key, value]) =>
        Array.isArray(value) ? value.includes(row[key]) : row[key] === value,
      );
    const result = () => ({
      data:
        operation === "insert"
          ? inserted
          : table === "workflows"
            ? workflows.filter(matches)
            : table === "workflow_events"
              ? events.filter((event) => matches(event as unknown as Row))
              : runs.filter(matches),
      error: null,
    });
    const q = {
      select: (columns: string) => {
        read.columns = columns;
        return q;
      },
      eq: (key: string, value: unknown) => {
        read.filters[key] = value;
        return q;
      },
      in: (key: string, value: unknown[]) => {
        read.filters[key] = value;
        return q;
      },
      is: () => q,
      lte: () => q,
      order: () => q,
      limit: () => q,
      insert: (row: Row) => {
        operation = "insert";
        inserted = { id: `run-${runs.length}`, ...row };
        if (table === "workflow_runs") runs.push(inserted);
        else if (table === "workflow_events") resumes.push(row);
        else throw Error("Unexpected insert");
        return q;
      },
      update: (row: Row) => {
        operation = "update";
        if (table === "workflow_events") eventUpdates.push(row);
        return q;
      },
      single: async () => result(),
      maybeSingle: async () => {
        const value = result();
        return {
          data: Array.isArray(value.data) ? (value.data[0] ?? null) : value.data,
          error: null,
        };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return q;
  });
  return { client: { from } as never, runs, resumes, reads, eventUpdates };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.authorize.mockResolvedValue(undefined);
  state.rpc.mockResolvedValue(true);
  state.hydrate.mockImplementation(async (_db, _entity, after) => after);
  state.items.mockImplementation(async (_db, _entity, after) => after);
  state.actions.mockResolvedValue({ log: [], hadError: false });
});

describe("named business workflow routing on the existing queue", () => {
  it.each([
    { field: "planned_cost", op: "eq", value: 75000 },
    { field: "planned_cost", op: "changed_to" },
  ] as const)(
    "projects cannot branch on protected source cost before action execution: $op",
    async (filter) => {
      const trigger = {
        ...workflowNotificationEventTrigger("projects.project.started"),
        filters: [filter],
      };
      const db = database([{ ...workflow("project", trigger), entity: "projects" }]);
      await processEvent(db.client, {
        ...namedEvent(),
        entity: "projects",
        notification_event_key: "projects.project.started",
        after: { workspace_id: W, planned_cost: 75000 },
        before: { workspace_id: W, planned_cost: 70000 },
      });
      expect(state.actions).not.toHaveBeenCalled();
      expect(db.runs).toHaveLength(0);
    },
  );

  it("keeps project costs out of execution and newly persisted delay snapshots without rewriting the input event", async () => {
    state.actions.mockResolvedValue({
      log: [],
      hadError: false,
      suspendedAt: { runAtIso: "2026-12-20T12:00:00Z", resumeCursor: 1 },
    });
    const db = database([
      {
        ...workflow("project", workflowNotificationEventTrigger("projects.project.started")),
        entity: "projects",
      },
    ]);
    const event: EventRow = {
      ...namedEvent(),
      entity: "projects",
      notification_event_key: "projects.project.started",
      after: {
        workspace_id: W,
        name: "Delivery",
        planned_cost: 75000,
        metadata: { planned_cost: "display label" },
      },
      before: { workspace_id: W, name: "Delivery", planned_cost: 70000 },
    };
    await processEvent(db.client, event);
    const context = state.actions.mock.calls[0][2];
    expect(context.after).not.toHaveProperty("planned_cost");
    expect(context.before).not.toHaveProperty("planned_cost");
    expect(db.resumes[0].after).toEqual({
      workspace_id: W,
      name: "Delivery",
      metadata: { planned_cost: "display label" },
    });
    expect(db.resumes[0].before).toEqual({ workspace_id: W, name: "Delivery" });
    expect(event.after?.planned_cost).toBe(75000);
  });
  it.each([
    { key: "projects.project.started", entity: "projects" },
    { key: "projects.project.overdue", entity: "projects" },
    { key: "projects.task.overdue", entity: "project_tasks" },
    { key: "projects.milestone.due", entity: "project_milestones" },
    { key: "ats.application.received", entity: "ats_applications" },
    { key: "ats.interview.scheduled", entity: "ats_interviews" },
    { key: "ats.offer.accepted", entity: "ats_offers" },
    { key: "people.employment.started", entity: "people" },
    { key: "people.document.expiring", entity: "people_documents" },
    { key: "people.approval.pending", entity: "hiring_preparation_requests" },
  ] as const)(
    "routes $key only to its proved source subscription in the same workspace",
    async ({ key, entity }) => {
      const trigger = workflowNotificationEventTrigger(key);
      const db = database([
        {
          ...workflow("project-named", trigger),
          entity,
          ...(key === "people.approval.pending"
            ? {
                actions: [
                  {
                    type: "send_notification",
                    title: "Revisão disponível",
                    recipients: [{ kind: "pending_approvers" }],
                  },
                ],
              }
            : {}),
        },
        { ...workflow("generic", { event: "updated", reenroll: { enabled: true } }), entity },
        { ...workflow("foreign-workspace", trigger), entity, workspace_id: "foreign-workspace" },
      ]);
      await processEvent(db.client, {
        ...namedEvent(),
        entity,
        entity_id: "project-source",
        notification_event_key: key,
      });
      expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
        db.client,
        "notification_business_event_check",
        {
          p_event: "event",
          p_workflow: "project-named",
          p_version: 3,
        },
      );
      expect(state.actions).toHaveBeenCalledOnce();
      expect(db.runs).toEqual([
        expect.objectContaining({
          workflow_id: "project-named",
          workspace_id: W,
          entity,
          entity_id: "project-source",
        }),
      ]);
      expect(state.authorize).toHaveBeenCalledOnce();
      expect(db.reads.find(({ table }) => table === "workflows")?.filters).toMatchObject({
        workspace_id: W,
        entity,
      });
    },
  );

  it("keeps named HR execution and delay domains minimal without rewriting the original source event", async () => {
    state.actions.mockResolvedValue({
      log: [],
      hadError: false,
      suspendedAt: { runAtIso: "2026-12-20T12:00:00Z", resumeCursor: 1, state: { sent: true } },
    });
    const db = database([
      {
        ...workflow("employment", workflowNotificationEventTrigger("people.employment.started")),
        entity: "people",
      },
    ]);
    const event: EventRow = {
      ...namedEvent(),
      entity: "people",
      notification_event_key: "people.employment.started",
      after: {
        id: "person",
        workspace_id: W,
        status: "active",
        full_name: "Private identity",
        email: "private@example.test",
        monthly_cost: 9000,
        personal_doc: { number: "private" },
      },
      before: { id: "person", workspace_id: W, status: "bench", bank_account: "private" },
    };
    await processEvent(db.client, event);
    const context = state.actions.mock.calls[0][2];
    expect(context.after).toEqual({ id: "person", workspace_id: W, status: "active" });
    expect(context.before).toEqual({ id: "person", workspace_id: W, status: "bench" });
    expect(db.resumes[0].after).toEqual({
      id: "person",
      workspace_id: W,
      status: "active",
      __wf_state: { sent: true },
    });
    expect(db.resumes[0].before).toEqual({ id: "person", workspace_id: W, status: "bench" });
    expect(event.after?.monthly_cost).toBe(9000);
  });

  it("refuses a saved approval workflow with an arbitrary nested recipient before any run or transport", async () => {
    const wf = {
      ...workflow("approval", workflowNotificationEventTrigger("people.approval.pending")),
      entity: "hiring_preparation_requests",
      actions: [
        {
          type: "parallel",
          join: "all",
          branches: [
            {
              actions: [
                {
                  type: "send_notification",
                  title: "Revisão",
                  recipients: [{ kind: "pending_approvers" }],
                },
              ],
            },
            {
              actions: [
                {
                  type: "send_notification",
                  title: "Revisão",
                  recipients: [{ kind: "workflow_owner" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const db = database([wf]);
    await processEvent(db.client, {
      ...namedEvent(),
      entity: "hiring_preparation_requests",
      notification_event_key: "people.approval.pending",
    });
    expect(db.runs).toEqual([]);
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.actions).not.toHaveBeenCalled();
    expect(db.eventUpdates).toEqual([{ processed_at: expect.any(String) }]);
  });

  it("does not promote an unproven generic document row into any workflow execution", async () => {
    const db = database([
      {
        ...workflow("document", { event: "updated", reenroll: { enabled: true } }),
        entity: "people_documents",
      },
    ]);
    await processEvent(db.client, {
      ...namedEvent(),
      entity: "people_documents",
      notification_event_key: undefined,
    });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.authorize).not.toHaveBeenCalled();
    expect(state.actions).not.toHaveBeenCalled();
    expect(db.runs).toEqual([]);
  });

  it("runs an explicitly subscribed administrator workflow across record owners after proving the actual occurrence", async () => {
    const db = database([
      workflow(),
      workflow("generic", { event: "updated", reenroll: { enabled: true } }),
      workflow("other-named", workflowNotificationEventTrigger("crm.deal.lost")),
    ]);
    await processEvent(db.client, namedEvent());
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      db.client,
      "notification_business_event_check",
      { p_event: "event", p_workflow: "named", p_version: 3 },
    );
    expect(state.actions).toHaveBeenCalledOnce();
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]).toMatchObject({
      workflow_id: "named",
      owner_id: "workflow-admin",
      event_id: "event",
      workspace_id: W,
    });
    expect(state.authorize).toHaveBeenCalledOnce();
    expect(db.reads.find(({ table }) => table === "workflows")?.filters).not.toHaveProperty(
      "owner_id",
    );
  });

  it("preserves owner filtering for generic workflows and does not enroll named subscribers from a generic row", async () => {
    const generic = { event: "updated", reenroll: { enabled: true } } as WorkflowTrigger;
    const db = database([
      workflow(),
      workflow("foreign-owner-generic", generic),
      { ...workflow("own-generic", generic), owner_id: "record-owner" },
    ]);
    await processEvent(db.client, { ...namedEvent(), notification_event_key: null });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].workflow_id).toBe("own-generic");
    expect(db.reads.find(({ table }) => table === "workflows")?.filters.owner_id).toBe(
      "record-owner",
    );
  });

  it.each([false, null, "true"])(
    "never trusts the public event key without a true private proof: %s",
    async (proof) => {
      state.rpc.mockResolvedValue(proof);
      const db = database([workflow()]);
      await processEvent(db.client, namedEvent());
      expect(db.runs).toHaveLength(0);
      expect(state.authorize).not.toHaveBeenCalled();
      expect(state.hydrate).not.toHaveBeenCalled();
      expect(state.actions).not.toHaveBeenCalled();
    },
  );

  it("retains the current executor/source permission gate after a genuine private proof", async () => {
    state.authorize.mockRejectedValue(Error("Executor inactive or denied"));
    const db = database([workflow()]);
    await processEvent(db.client, namedEvent());
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]).toMatchObject({ status: "error", error: "Executor inactive or denied" });
    expect(state.hydrate).not.toHaveBeenCalled();
    expect(state.actions).not.toHaveBeenCalled();
  });

  it("keeps the occurrence pending after a private-proof RPC outage", async () => {
    state.rpc.mockRejectedValue(Error("Proof unavailable"));
    const db = database([workflow()]);
    await expect(processEvent(db.client, namedEvent())).rejects.toThrow("Proof unavailable");
    expect(db.eventUpdates).toHaveLength(0);
    expect(db.runs).toHaveLength(0);
    expect(state.actions).not.toHaveBeenCalled();
  });

  it("proves a named delayed resume before hydration and retains its exact cursor", async () => {
    const db = database([workflow()]);
    await processEvent(db.client, {
      ...namedEvent(),
      id: "resume-event",
      resume_workflow_id: "named",
      resume_cursor: 2,
      workflow_version: 3,
      notification_parent_event_id: "event",
    });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      db.client,
      "notification_business_event_check",
      { p_event: "resume-event", p_workflow: "named", p_version: 3 },
    );
    expect(state.actions).toHaveBeenCalledWith(
      db.client,
      expect.any(Array),
      expect.objectContaining({ workflowId: "named", workflowVersion: 3 }),
      2,
    );
  });

  it("rejects an unproven named resume without changing it into a generic workflow run", async () => {
    state.rpc.mockResolvedValue(false);
    const db = database([workflow()]);
    await processEvent(db.client, {
      ...namedEvent(),
      resume_workflow_id: "named",
      resume_cursor: 2,
      workflow_version: 3,
    });
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]).toMatchObject({
      status: "error",
      owner_id: "workflow-admin",
      error: "Ocorrência de negócio ou origem indisponível; retomada bloqueada.",
    });
    expect(db.eventUpdates).toEqual([{ processed_at: expect.any(String) }]);
    expect(state.actions).not.toHaveBeenCalled();
  });

  it("keeps a named resume pending when its proof could not be checked during an outage", async () => {
    state.rpc.mockRejectedValue(Error("Proof unavailable"));
    const db = database([workflow()]);
    await expect(
      processEvent(db.client, {
        ...namedEvent(),
        resume_workflow_id: "named",
        resume_cursor: 2,
        workflow_version: 3,
      }),
    ).rejects.toThrow("Proof unavailable");
    expect(db.runs).toHaveLength(0);
    expect(db.eventUpdates).toHaveLength(0);
    expect(state.actions).not.toHaveBeenCalled();
  });

  it("finishes a milestone continuation neutrally when the database invalidates its deadline or parent project", async () => {
    state.rpc.mockResolvedValue(false);
    const db = database([
      {
        ...workflow("milestone", workflowNotificationEventTrigger("projects.milestone.due")),
        entity: "project_milestones",
      },
    ]);
    await processEvent(db.client, {
      ...namedEvent(),
      entity: "project_milestones",
      entity_id: "milestone-source",
      notification_event_key: "projects.milestone.due",
      resume_workflow_id: "milestone",
      resume_cursor: 1,
      workflow_version: 3,
    });
    expect(state.rpc).toHaveBeenCalledOnce();
    expect(db.runs).toEqual([
      expect.objectContaining({ status: "error", entity: "project_milestones" }),
    ]);
    expect(db.eventUpdates).toEqual([{ processed_at: expect.any(String) }]);
    expect(state.hydrate).not.toHaveBeenCalled();
    expect(state.actions).not.toHaveBeenCalled();
  });

  it("copies the real parent event and canonical key into a delayed named continuation", async () => {
    state.actions.mockResolvedValue({
      log: [],
      hadError: false,
      suspendedAt: { runAtIso: "2026-12-20T12:00:00Z", resumeCursor: 2 },
    });
    const db = database([workflow()]);
    await processEvent(db.client, namedEvent());
    expect(db.resumes).toHaveLength(1);
    expect(db.resumes[0]).toMatchObject({
      notification_event_key: "crm.deal.won",
      notification_parent_event_id: "event",
      resume_workflow_id: "named",
      workflow_version: 3,
      resume_cursor: 2,
    });
  });

  it("selects provenance columns during scoped consumption without starting a global due scan", async () => {
    const db = database([workflow(), workflow("not-allowed")], [namedEvent()]);
    expect(
      await tickWorkflows(db.client, 20, {
        workspaceId: W,
        eventIds: ["event"],
        workflowIds: ["named"],
      }),
    ).toMatchObject({ processed: 1 });
    expect(db.reads[0].columns).toContain("notification_event_key");
    expect(db.reads[0].columns).toContain("notification_parent_event_id");
    expect(db.runs).toHaveLength(1);
    expect(
      state.rpc.mock.calls.every(([, name]) => name === "notification_business_event_check"),
    ).toBe(true);
  });
});
