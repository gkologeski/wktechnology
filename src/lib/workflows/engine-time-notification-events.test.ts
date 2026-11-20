import { beforeEach, describe, expect, it, vi } from "vitest";
import { workflowNotificationEventTrigger } from "./notification-events";

const state = vi.hoisted(() => ({ rpc: vi.fn(), tick: vi.fn() }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
vi.mock("./engine-runtime.server", () => ({ tickWorkflows: state.tick }));
import { tickTimeTriggers } from "./engine-time-triggers.server";

type Row = Record<string, unknown>;
function database(workflows: Row[] = [], records: Row[] = [], catalogueError = false) {
  const events: Row[] = [],
    cursors: Row[] = [],
    tables: string[] = [];
  const reads: { table: string; filters: Record<string, unknown>; limit?: number }[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    const read = {
      table,
      filters: {} as Record<string, unknown>,
      limit: undefined as number | undefined,
    };
    reads.push(read);
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => {
        read.filters[key] = value;
        return q;
      },
      lte: () => q,
      limit: (value: number) => {
        read.limit = value;
        return q;
      },
      maybeSingle: async () => ({ data: null, error: null }),
      insert: async (row: Row) => {
        events.push(row);
        return { error: null };
      },
      upsert: async (row: Row) => {
        cursors.push(row);
        return { error: null };
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: (table === "workflows" ? workflows : records).filter((row) =>
            Object.entries(read.filters).every(([key, value]) => row[key] === value),
          ),
          error:
            catalogueError && table === "workflows"
              ? { message: "Workflow catalogue unavailable" }
              : null,
        }).then(resolve),
    };
    return q;
  });
  return { client: { from } as never, events, cursors, reads, tables };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ enqueued: 0 });
  state.tick.mockImplementation(async (_db, limit) => ({ processed: limit }));
});

describe("business deadline production through the existing time tick", () => {
  it("calls the service producer once and consumes the same queue without a second scheduler", async () => {
    state.rpc.mockResolvedValue({ enqueued: 2 });
    const db = database();
    expect(await tickTimeTriggers(db.client)).toEqual({ enqueued: 2, processed: 2, workflows: [] });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(db.client, "notification_business_due_tick", {
      p_limit: 100,
    });
    expect(state.tick).toHaveBeenCalledExactlyOnceWith(db.client, 2);
    expect(db.events).toHaveLength(0);
    expect(db.cursors).toHaveLength(0);
  });

  it("keeps legacy timers owner/workspace scoped and never scans named contract or project rows in TypeScript", async () => {
    const timer = { kind: "time_since_field", amount: 1, unit: "days" };
    const base = {
      workspace_id: "workspace",
      owner_id: "owner",
      enabled: true,
      status: "published",
    };
    const db = database(
      [
        {
          ...base,
          id: "legacy",
          entity: "deals",
          trigger: { event: "updated", time_based: timer },
        },
        {
          ...base,
          id: "business",
          entity: "contracts",
          trigger: workflowNotificationEventTrigger("contracts.contract.expiring"),
        },
        {
          ...base,
          id: "invalid-mixed",
          entity: "contracts",
          trigger: {
            ...workflowNotificationEventTrigger("contracts.contract.expiring"),
            time_based: timer,
          },
        },
        ...(
          [
            { key: "projects.project.overdue", entity: "projects" },
            { key: "projects.task.overdue", entity: "project_tasks" },
            { key: "projects.milestone.due", entity: "project_milestones" },
          ] as const
        ).map(({ key, entity }) => ({
          ...base,
          id: key,
          entity,
          trigger: workflowNotificationEventTrigger(key),
        })),
        {
          ...base,
          id: "invalid-mixed-milestone",
          entity: "project_milestones",
          trigger: {
            ...workflowNotificationEventTrigger("projects.milestone.due"),
            time_based: timer,
          },
        },
      ],
      [
        {
          id: "own-deal",
          workspace_id: "workspace",
          owner_id: "owner",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "foreign-deal",
          workspace_id: "foreign",
          owner_id: "owner",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    );
    expect(await tickTimeTriggers(db.client, 250)).toMatchObject({ enqueued: 1 });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(db.client, "notification_business_due_tick", {
      p_limit: 200,
    });
    expect(db.tables).not.toContain("contracts");
    expect(db.tables).not.toContain("projects");
    expect(db.tables).not.toContain("project_tasks");
    expect(db.tables).not.toContain("project_milestones");
    expect(db.reads.find(({ table }) => table === "deals")).toMatchObject({
      filters: { owner_id: "owner", workspace_id: "workspace" },
      limit: 250,
    });
    expect(db.events).toEqual([
      expect.objectContaining({
        workspace_id: "workspace",
        entity_id: "own-deal",
        entity: "deals",
      }),
    ]);
    expect(db.events[0]).not.toHaveProperty("notification_event_key");
    expect(db.cursors).toHaveLength(1);
  });

  it("does not hide a producer failure as a successful empty deadline scan", async () => {
    state.rpc.mockRejectedValue(Error("Deadline source unavailable"));
    const db = database();
    await expect(tickTimeTriggers(db.client)).rejects.toThrow("Deadline source unavailable");
    expect(db.tables).toEqual([]);
    expect(state.tick).not.toHaveBeenCalled();
  });

  it.each([{}, { enqueued: -1 }, { enqueued: "2" }])(
    "rejects malformed producer accounting: %j",
    async (result) => {
      state.rpc.mockResolvedValue(result);
      const db = database();
      await expect(tickTimeTriggers(db.client)).rejects.toThrow();
      expect(db.tables).toEqual([]);
      expect(state.tick).not.toHaveBeenCalled();
    },
  );

  it("keeps the already-enqueued business occurrences durable when the legacy catalogue fails", async () => {
    state.rpc.mockResolvedValue({ enqueued: 2 });
    const db = database([], [], true);
    await expect(tickTimeTriggers(db.client)).rejects.toThrow("Workflow catalogue unavailable");
    expect(state.tick).not.toHaveBeenCalled();
    expect(db.events).toHaveLength(0);
  });

  it("does not run queue processing when neither producer enqueues an occurrence", async () => {
    const db = database();
    expect(await tickTimeTriggers(db.client)).toEqual({ enqueued: 0, processed: 0, workflows: [] });
    expect(state.tick).not.toHaveBeenCalled();
  });

  it("keeps document deadlines in SQL and never scans a malformed legacy timer on a read-only HR source", async () => {
    const base = {
      workspace_id: "workspace",
      owner_id: "owner",
      enabled: true,
      status: "published",
    };
    const db = database([
      {
        ...base,
        id: "document",
        entity: "people_documents",
        trigger: workflowNotificationEventTrigger("people.document.expiring"),
      },
      ...["people_documents", "ats_offers", "hiring_preparation_requests"].map((entity) => ({
        ...base,
        id: entity,
        entity,
        trigger: {
          event: "updated",
          time_based: { kind: "time_since_field", amount: 1, unit: "days" },
        },
      })),
    ]);
    expect(await tickTimeTriggers(db.client)).toMatchObject({ enqueued: 0 });
    expect(db.tables).toEqual(["workflows"]);
    expect(db.events).toEqual([]);
    expect(state.rpc).toHaveBeenCalledOnce();
  });

  it("projects canonical HR private fields before legacy temporal filters or queue writes", async () => {
    const db = database(
      [
        {
          id: "people-timer",
          workspace_id: "workspace",
          owner_id: "owner",
          enabled: true,
          status: "published",
          entity: "people",
          trigger: {
            event: "updated",
            time_based: { kind: "time_since_field", amount: 1, unit: "days" },
          },
        },
      ],
      [
        {
          id: "person",
          workspace_id: "workspace",
          owner_id: "owner",
          updated_at: "2026-01-01T00:00:00Z",
          full_name: "Public alias",
          email: "person@example.test",
          monthly_cost: 9000,
          personal_doc: { number: "private" },
        },
      ],
    );
    await tickTimeTriggers(db.client);
    expect(db.events).toHaveLength(1);
    expect(db.events[0].after).toMatchObject({
      full_name: "Public alias",
      email: "person@example.test",
    });
    expect(db.events[0].after).not.toHaveProperty("monthly_cost");
    expect(db.events[0].after).not.toHaveProperty("personal_doc");
  });
});
