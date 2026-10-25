import { describe, expect, it, vi } from "vitest";
import { authorizeWorkflowStep, sanitizeWorkflowSnapshot } from "./authorization.server";
import { runActions } from "../engine-actions.server";
import type { RunCtx } from "./run-context";

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
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "sales_workflow_record") {
      writes.push(args.p_payload);
      return { data: { id: "lead-1" }, error: null };
    }
    return { data: allow, error: null };
  });
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
