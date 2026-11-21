import { describe, expect, it, vi } from "vitest";
import { authorizeWorkflowStep, sanitizeWorkflowSnapshot } from "./authorization.server";
import { runActions } from "../engine-actions.server";
import type { RunCtx } from "./run-context";
import type { WorkflowAction } from "../types";

const ctx = (): RunCtx => ({
  entity: "leads",
  entityId: "lead-1",
  ownerId: "actor-1",
  workspaceId: "ws-1",
  workflowId: "wf-1",
  runId: "run-1",
  after: { id: "lead-1", owner_id: "actor-1" },
  before: null,
});
function client(allow: boolean) {
  const writes: unknown[] = [];
  const rpc = vi.fn(
    async (
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: null }> => {
      if (name === "sales_workflow_record") {
        writes.push(args.p_payload);
        return { data: { id: "lead-1" }, error: null };
      }
      return { data: allow, error: null };
    },
  );
  const from = vi.fn(() => ({
    update: (row: unknown) => {
      writes.push(row);
      return { eq: async () => ({ error: null }) };
    },
  }));
  return { db: { rpc, from } as never, rpc, from, writes };
}
describe("workflow authorization boundary", () => {
  it("removes credential fields from nested snapshots without changing business data", () => {
    const input = {
      name: "Cliente",
      public_token: "secret",
      company: { name: "WK", portal_token: "secret" },
      items: [{ name: "Serviço", access_token: "secret" }],
      custom_fields: { refresh_token: "secret", ordinary: "keep" },
    };
    const safe = sanitizeWorkflowSnapshot(input);
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(safe).toEqual({
      name: "Cliente",
      company: { name: "WK" },
      items: [{ name: "Serviço" }],
      custom_fields: { ordinary: "keep" },
    });
    expect(input.public_token).toBe("secret");
  });
  it("redacts project costs only at the typed source and association boundaries", () => {
    const task = {
      title: "Synthetic task",
      project_id: "project-1",
      project: {
        id: "project-1",
        name: "Delivery",
        planned_cost: 75000,
        planned_hours: 20,
        metadata: { planned_cost: "customer-provided label" },
      },
    };
    expect(sanitizeWorkflowSnapshot(task, "project_tasks")).toEqual({
      title: "Synthetic task",
      project_id: "project-1",
      project: {
        id: "project-1",
        name: "Delivery",
        planned_hours: 20,
        metadata: { planned_cost: "customer-provided label" },
      },
    });
    expect(sanitizeWorkflowSnapshot({ planned_cost: 12, amount: 13 }, "financial_entries")).toEqual(
      { planned_cost: 12, amount: 13 },
    );
    expect(task.project.planned_cost).toBe(75000);
  });
  it("preserves legacy public HR tokens while removing canonical private values in before and after", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "people";
    source.after = {
      full_name: "Synthetic person",
      email: "person@example.test",
      status: "active",
      monthly_cost: 8000,
      personal_doc: { cpf: "private" },
      bank_account: "private",
    };
    source.before = { full_name: "Previous name", monthly_cost: 7000 };
    const result = await runActions(
      c.db,
      [
        {
          type: "branch_if",
          filters: [{ field: "monthly_cost", op: "eq", value: 8000 }],
          then: [{ type: "set_field", field: "role_title", value: "Private branch" }],
          else: [],
        },
      ],
      source,
    );
    expect(result.hadError).toBe(false);
    expect(c.writes).toEqual([]);
    expect(source.after).toEqual({
      full_name: "Synthetic person",
      email: "person@example.test",
      status: "active",
    });
    expect(source.before).toEqual({ full_name: "Previous name" });
    expect(
      sanitizeWorkflowSnapshot(
        { monthly_cost: 20, notes: "Ordinary finance note" },
        "financial_entries",
      ),
    ).toEqual({ monthly_cost: 20, notes: "Ordinary finance note" });
  });

  it.each([
    "people_documents",
    "ats_offers",
    "hiring_preparation_requests",
    "hiring_fiscal_documents",
  ] as const)(
    "binds read-only source %s to an explicit worker view requirement",
    async (entity) => {
      const c = client(true),
        source = { ...ctx(), entity };
      await authorizeWorkflowStep(c.db, source);
      expect(c.rpc).toHaveBeenCalledWith(
        "sales_worker_authorize",
        expect.objectContaining({
          p_refs: expect.arrayContaining([
            expect.objectContaining({ record_table: entity, id: source.entityId }),
          ]),
        }),
      );
    },
  );

  it.each([
    { type: "set_field", field: "status", value: "signed" },
    { type: "increment_field", field: "revision", amount: 1 },
    { type: "assign_to", user_id: "another-user" },
    {
      type: "copy_field_from_association",
      association: "candidate",
      source_field: "id",
      target_field: "candidate_id",
    },
  ])("denies read-only source mutations before any worker call or write: $type", async (action) => {
    const c = client(true),
      source = ctx();
    source.entity = "ats_offers";
    source.after = { status: "sent", revision: 1 };
    const result = await runActions(c.db, [action as WorkflowAction], source);
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/somente leitura/);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
  });

  it.each([
    { type: "increment_field", field: "monthly_cost", amount: 1 },
    { type: "set_field", field: "bank_account", value: "changed" },
    { type: "format_data", source_field: "personal_doc.number", op: "trim", target_var: "doc" },
    { type: "update_record", table: "people", target_id: "person", values: { cost_hour: 1 } },
  ])("denies projected-away HR fields before generic action effects: $type", async (action) => {
    const c = client(true),
      source = ctx();
    source.entity = "people";
    source.after = { monthly_cost: 9000 };
    const result = await runActions(c.db, [action as WorkflowAction], source);
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/operação canônica autorizada/);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
  });

  it("blocks a nested direct approval transport before any earlier effect in that branch", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "hiring_preparation_requests";
    const result = await runActions(
      c.db,
      [
        {
          type: "branch_if",
          filters: [],
          then: [
            {
              type: "format_data",
              op: "template_string",
              template: "value",
              target_var: "prepared",
            },
            { type: "send_slack", text: "Private approval" },
          ],
          else: [],
        },
      ],
      source,
    );
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/somente envia/);
    expect(source.vars).toBeUndefined();
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
  });
  it("sanitizes both source snapshots before a real control branch can expose project cost", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "projects";
    source.after = { name: "Delivery", planned_cost: 75000, planned_hours: 20 };
    source.before = { name: "Delivery", planned_cost: 70000, planned_hours: 20 };
    const result = await runActions(
      c.db,
      [
        {
          type: "branch_if",
          filters: [{ field: "planned_cost", op: "eq", value: 75000 }],
          then: [{ type: "set_field", field: "description", value: "Confidential branch" }],
          else: [],
        },
      ],
      source,
    );
    expect(result.hadError).toBe(false);
    expect(c.writes).toEqual([]);
    expect(source.after).toEqual({ name: "Delivery", planned_hours: 20 });
    expect(source.before).toEqual({ name: "Delivery", planned_hours: 20 });
  });
  it("blocks a privileged direct association copy of project cost before its source query", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "project_tasks";
    source.after = { project_id: "project-1", title: "Task" };
    const result = await runActions(
      c.db,
      [
        {
          type: "copy_field_from_association",
          association: "project",
          source_field: "planned_cost",
          target_field: "description",
        },
      ],
      source,
    );
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/operação financeira canônica/);
    expect(c.from).not.toHaveBeenCalled();
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { type: "increment_field", field: "planned_cost", amount: 1 },
    { type: "set_field", field: "planned_cost", value: 1 },
    { type: "format_data", source_field: "planned_cost", op: "number_round", target_var: "cost" },
    {
      type: "copy_field_from_association",
      association: "company",
      source_field: "name",
      target_field: "planned_cost",
    },
    {
      type: "update_record",
      table: "projects",
      target_id: "project-1",
      values: { planned_cost: 1 },
    },
    { type: "create_record", table: "projects", values: { name: "Project", planned_cost: 1 } },
    {
      type: "create_record",
      table: "projects",
      values: { name: "Project" },
      extra_fields: { planned_cost: 1 },
    },
  ])("blocks projected-away project cost before generic action effects: $type", async (action) => {
    const c = client(true),
      source = ctx();
    source.entity = "projects";
    source.after = { name: "Project", planned_cost: 75000 };
    const result = await runActions(c.db, [action as WorkflowAction], source);
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/operação financeira canônica/);
    expect(c.from).not.toHaveBeenCalled();
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
  });
  it("checks an explicit project update destination even when the workflow source is a different module", async () => {
    const c = client(true);
    const result = await runActions(
      c.db,
      [
        {
          type: "update_record",
          table: "projects",
          target_id: "project-1",
          values: { planned_cost: 1 },
        },
      ],
      ctx(),
    );
    expect(result.hadError).toBe(true);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
  });
  it("does not classify a same-named financial-entry value as protected project cost", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "financial_entries";
    source.after = { planned_cost: 12 };
    const result = await runActions(
      c.db,
      [{ type: "increment_field", field: "planned_cost", amount: 1 }],
      source,
    );
    expect(result.hadError).toBe(false);
    expect(c.writes).toEqual([{ planned_cost: 13 }]);
  });
  it("stops before a write when the worker's current permission is denied", async () => {
    const c = client(false);
    const result = await runActions(
      c.db,
      [{ type: "set_field", field: "notes", value: "atualizado" }],
      ctx(),
    );
    expect(result.hadError).toBe(true);
    expect(c.from).not.toHaveBeenCalled();
    expect(result.log[0].ok).toBe(false);
  });
  it("continues an authorized write and checks the precise record action", async () => {
    const c = client(true);
    const result = await runActions(
      c.db,
      [{ type: "set_field", field: "notes", value: "atualizado" }],
      ctx(),
    );
    expect(result.hadError).toBe(false);
    expect(c.writes).toEqual([{ notes: "atualizado" }]);
    expect(c.rpc).toHaveBeenCalledWith(
      "sales_worker_authorize",
      expect.objectContaining({
        p_source: "workflows",
        p_id: "wf-1",
        p_refs: expect.arrayContaining([{ table: "leads", id: "lead-1", action: "update" }]),
      }),
    );
  });
  it("does not treat assigned_to as an ordinary editable field", async () => {
    const c = client(true);
    await authorizeWorkflowStep(c.db, ctx(), {
      type: "set_field",
      field: "assigned_to",
      value: "other-user",
    });
    expect(c.rpc).toHaveBeenCalledWith(
      "sales_worker_authorize",
      expect.objectContaining({
        p_refs: expect.arrayContaining([
          { table: "leads", id: "lead-1", action: "assign" },
          { resource: "techsales.leads", action: "assign", subject_id: "other-user" },
        ]),
      }),
    );
  });
  it("checks cross-module source records under the workflow owner's actual RLS", async () => {
    const c = client(true),
      source = ctx();
    source.entity = "projects";
    await authorizeWorkflowStep(c.db, source);
    expect(c.rpc).toHaveBeenCalledWith(
      "sales_worker_authorize",
      expect.objectContaining({ p_refs: [{ record_table: "projects", id: "lead-1" }] }),
    );
  });
  it("blocks generic credential copies before querying a provider or database", async () => {
    const c = client(true);
    const result = await runActions(
      c.db,
      [
        {
          type: "copy_field_from_association",
          association: "company",
          source_field: "public_token",
          target_field: "notes",
        },
      ],
      ctx(),
    );
    expect(result.hadError).toBe(true);
    expect(c.from).not.toHaveBeenCalled();
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("requires a real workflow source even for control branches", async () => {
    const c = client(true);
    const source = ctx();
    delete source.workflowId;
    const result = await runActions(
      c.db,
      [
        {
          type: "branch_if",
          filters: [],
          then: [{ type: "set_field", field: "notes", value: "x" }],
          else: [],
        },
      ],
      source,
    );
    expect(result.hadError).toBe(true);
    expect(c.from).not.toHaveBeenCalled();
    expect(result.log[0].error).toMatch(/origem/);
  });
});

describe("current recruitment authorization in hiring workers", () => {
  it("checks current application before any hiring side effect", async () => {
    const c = client(true);
    c.rpc.mockImplementation(async (name) => ({
      data:
        name === "hiring_workflow_recruitment_check"
          ? { ready: false, reason: "Assinatura revogada", hunting: false }
          : true,
      error: null,
    }));
    await expect(
      authorizeWorkflowStep(c.db, { ...ctx(), entity: "ats_applications", entityId: "app-1" }, {
        type: "create_person_from_candidate",
      } as never),
    ).rejects.toThrow("Assinatura revogada");
    expect(c.writes).toEqual([]);
    expect(c.rpc).toHaveBeenCalledWith("hiring_workflow_recruitment_check", {
      p_ws: "ws-1",
      p_application: "app-1",
    });
  });
  it("does not provision an internal employee for Hunting", async () => {
    const c = client(true);
    c.rpc.mockImplementation(async (name) => ({
      data:
        name === "hiring_workflow_recruitment_check"
          ? { ready: true, reason: null, hunting: true }
          : true,
      error: null,
    }));
    await expect(
      authorizeWorkflowStep(c.db, { ...ctx(), entity: "ats_applications", entityId: "app-1" }, {
        type: "create_person_from_candidate",
      } as never),
    ).rejects.toThrow("Hunting");
    expect(c.writes).toEqual([]);
  });
});

describe("named financial notices before real action handlers", () => {
  it("denies incrementing a minimized amount before a worker call or write, while generic financial workflows retain their value", async () => {
    const c = client(true);
    const source: RunCtx = {
      ...ctx(),
      entity: "financial_entries",
      notificationEventKey: "finance.payable.due",
      after: {
        id: "entry",
        amount: 4000,
        paid_amount: 0,
        direction: "payable",
        due_date: "2026-11-20",
      },
    };
    const result = await runActions(
      c.db,
      [{ type: "increment_field", field: "amount", amount: 10 }],
      source,
    );
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/operação financeira canônica/);
    expect(source.after).not.toHaveProperty("amount");
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
    const generic = client(true);
    const ordinary = await runActions(
      generic.db,
      [{ type: "increment_field", field: "amount", amount: 10 }],
      { ...ctx(), entity: "financial_entries", after: { amount: 4000 } },
    );
    expect(ordinary.hadError).toBe(false);
    expect(generic.writes).toEqual([{ amount: 4010 }]);
  });

  it("validates all nested finance configuration before an earlier effect or a missing is_empty branch", async () => {
    const c = client(true);
    const result = await runActions(
      c.db,
      [
        { type: "webhook", url: "https://example.invalid" },
        { type: "branch_if", filters: [{ field: "amount", op: "is_empty" }], then: [], else: [] },
      ],
      {
        ...ctx(),
        entity: "financial_entries",
        notificationEventKey: "finance.receivable.overdue",
        after: { direction: "receivable", due_date: "2026-11-19" },
      },
    );
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/Campo indisponível/);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
  });
});

it.each([
  { type: "create_payable_schedule", amount: "10" },
  { type: "create_receivable_invoice", amount: "10" },
  { type: "cancel_payable_schedules" },
])(
  "blocks $type through the real dispatcher before any financial handler or earlier effect",
  async (action) => {
    const c = client(true);
    const result = await runActions(
      c.db,
      [
        { type: "webhook", url: "https://example.invalid" },
        { type: "branch_if", filters: [], then: [action as WorkflowAction], else: [] },
      ],
      {
        ...ctx(),
        entity: "financial_entries",
        notificationEventKey: "finance.receivable.due",
        after: { id: "entry", direction: "receivable", due_date: "2026-11-20" },
      },
    );
    expect(result.hadError).toBe(true);
    expect(result.log[0].error).toMatch(/operação financeira canônica/);
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
    expect(c.writes).toEqual([]);
    const generic = client(true);
    await expect(
      authorizeWorkflowStep(
        generic.db,
        { ...ctx(), entity: "financial_entries" },
        action as WorkflowAction,
      ),
    ).resolves.toBeUndefined();
    expect(generic.rpc).toHaveBeenCalled();
  },
);

it("rejects unsupported nested follow-up scheduling before any earlier Workflow effect", async () => {
  const c = client(true);
  const result = await runActions(
    c.db,
    [
      { type: "webhook", url: "https://example.invalid" },
      {
        type: "branch_if",
        filters: [],
        then: [
          {
            type: "send_notification",
            title: "Pending",
            delivery: {
              channels: ["inapp"],
              fallback: "none",
              followup: { reminder: { interval_hours: 24, max_occurrences: 2 } },
            },
          },
        ],
        else: [],
      },
    ],
    { ...ctx(), entity: "deals", notificationEventKey: "crm.deal.won" },
  );
  expect(result.hadError).toBe(true);
  expect(result.log[0].error).toMatch(/não permite/);
  expect(c.rpc).not.toHaveBeenCalled();
  expect(c.from).not.toHaveBeenCalled();
  expect(c.writes).toEqual([]);
});
it("never permits a delayed pending-approval escalation to a different recipient", async () => {
  const c = client(true);
  const result = await runActions(
    c.db,
    [
      {
        type: "send_notification",
        title: "Pending",
        recipients: [{ kind: "pending_approvers" }],
        delivery: {
          channels: ["inapp"],
          fallback: "none",
          followup: { escalation: { after_hours: 24, recipient: { kind: "workflow_owner" } } },
        },
      },
    ],
    {
      ...ctx(),
      entity: "hiring_preparation_requests",
      notificationEventKey: "people.approval.pending",
    },
  );
  expect(result.hadError).toBe(true);
  expect(result.log[0].error).toMatch(/sem escalonamento/);
  expect(c.rpc).not.toHaveBeenCalled();
  expect(c.from).not.toHaveBeenCalled();
});
