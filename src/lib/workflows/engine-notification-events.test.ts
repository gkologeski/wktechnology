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
vi.mock("./engine/authorization.server", () => ({
  authorizeWorkflowStep: state.authorize,
  sanitizeWorkflowSnapshot: (value: unknown) => value,
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
