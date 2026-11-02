import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { operateSequence, sequenceOperations } from "./operations.server";
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  U = "10000000-0000-4000-8000-000000000002",
  ID = "50000000-0000-4000-8000-000000000001";
function client(failure?: string, foreign = false, readOnly = false) {
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "sales_access_context"
        ? { workspace: foreign ? ID : W, actor: U, read_only: readOnly }
        : name === "prospecting_sequence_capabilities"
          ? {
              readOnly,
              owners: { [U]: { manage: !readOnly, assign: !readOnly, activity: !readOnly } },
            }
          : true,
    error: failure && name === "sales_area_authorize" ? { message: failure } : null,
  }));
  const from = vi.fn((table: string) => {
    const q: any = {};
    for (const name of ["select", "eq", "in", "order", "range", "limit"]) q[name] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: { id: ID, owner_id: U }, error: null }));
    q.then = (resolve: (x: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === "prospecting_sequence_runs"
            ? [
                {
                  id: ID,
                  owner_id: U,
                  state: "active",
                  cursor: 0,
                  cohort_person_id: ID,
                  next_run_at: new Date().toISOString(),
                },
              ]
            : [],
        count: 1,
        error: null,
      }).then(resolve);
    return q;
  });
  return { rpc, from, db: { rpc, from } as unknown as SupabaseClient };
}
it("operations allows authorized active caller through current SQL boundary", async () => {
  const f = client();
  await operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "pause" });
  expect(f.rpc).toHaveBeenCalledWith("prospecting_sequence_control", {
    p_workspace: W,
    p_run: ID,
    p_action: "pause",
  });
});
it("operations rejects missing_permission before mutation", async () => {
  const f = client("missing_permission");
  await expect(
    operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "pause" }),
  ).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("operations rejects explicit_deny before mutation", async () => {
  const f = client("explicit_deny");
  await expect(
    operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "pause" }),
  ).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("operations rejects inactive_member before mutation", async () => {
  const f = client("inactive_member");
  await expect(
    operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "pause" }),
  ).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("operations rejects foreign workspace before record read", async () => {
  const f = client(undefined, true);
  await expect(
    sequenceOperations(f.db, { workspaceId: W, versionId: ID, page: 0 }),
  ).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("operations rejects read only session before mutation", async () => {
  const f = client(undefined, false, true);
  await expect(
    operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "pause" }),
  ).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("operations projects only current capability decisions and no lease token", async () => {
  const f = client();
  const r = await sequenceOperations(f.db, { workspaceId: W, versionId: ID, page: 0 });
  expect(r.canStart).toBe(true);
  expect(r.rows[0].canManage).toBe(true);
  expect(JSON.stringify(r)).not.toContain("lease_token");
  expect(f.from).toHaveBeenCalledWith("prospecting_sequence_runs");
});
it("operations validates unsupported action before authorization", async () => {
  const f = client();
  await expect(
    operateSequence(f.db, { workspaceId: W, versionId: ID, id: ID, action: "send" as never }),
  ).rejects.toThrow();
  expect(f.rpc).not.toHaveBeenCalled();
});
