import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDrafts, saveDraft } from "./drafts.server";
import { newDefinition, SEQUENCE_RESOURCE } from "./draft";
const input = () => ({
  id: crypto.randomUUID(),
  workspaceId: crypto.randomUUID(),
  expectedRevision: 0,
  name: "Abertura",
  definition: newDefinition(),
});
function client(failure?: string, on?: string) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) =>
    failure && (!on || name === on)
      ? { data: null, error: { message: failure } }
      : {
          data:
            name === "prospecting_sequence_draft_save"
              ? { id: args.p_id, revision: 1 }
              : name === "prospecting_sequence_draft_list"
                ? []
                : true,
          error: null,
        },
  );
  return { rpc, value: { rpc } as unknown as SupabaseClient };
}
it("sequence draft allows an authorized active caller", async () => {
  const c = client(),
    data = input();
  await expect(saveDraft(c.value, data)).resolves.toMatchObject({ id: data.id, revision: 1 });
  expect(c.rpc).toHaveBeenNthCalledWith(1, "sales_area_authorize", {
    r: SEQUENCE_RESOURCE,
    a: "create",
    t: null,
    i: null,
  });
  expect(c.rpc).toHaveBeenLastCalledWith("prospecting_sequence_draft_save", {
    p_id: data.id,
    p_workspace: data.workspaceId,
    p_expected_revision: 0,
    p_name: data.name,
    p_definition: data.definition,
  });
});
it("sequence draft refuses missing permission before mutation", async () => {
  const c = client("missing permission");
  await expect(saveDraft(c.value, input())).rejects.toThrow("missing permission");
  expect(c.rpc).toHaveBeenCalledTimes(1);
});
it("sequence draft refuses explicit deny before mutation", async () => {
  const c = client("explicit deny");
  await expect(saveDraft(c.value, input())).rejects.toThrow("explicit deny");
  expect(c.rpc).toHaveBeenCalledTimes(1);
});
it("sequence draft propagates foreign workspace refusal from database", async () => {
  const c = client("foreign workspace", "prospecting_sequence_draft_save");
  await expect(saveDraft(c.value, input())).rejects.toThrow("foreign workspace");
  expect(c.rpc).toHaveBeenCalledTimes(3);
});
it("sequence draft refuses inactive membership before mutation", async () => {
  const c = client("inactive member");
  await expect(saveDraft(c.value, input())).rejects.toThrow("inactive member");
  expect(c.rpc).toHaveBeenCalledTimes(1);
});
it("sequence draft rechecks update independently from create", async () => {
  const c = client(),
    d = { ...input(), expectedRevision: 4 };
  await saveDraft(c.value, d);
  expect(c.rpc).toHaveBeenNthCalledWith(1, "sales_area_authorize", {
    r: SEQUENCE_RESOURCE,
    a: "update",
    t: null,
    i: null,
  });
});
it("sequence draft surfaces revision conflict without retrying overwrite", async () => {
  const c = client("revision conflict", "prospecting_sequence_draft_save");
  await expect(saveDraft(c.value, { ...input(), expectedRevision: 1 })).rejects.toThrow(
    "revision conflict",
  );
  expect(c.rpc.mock.calls.filter((x) => x[0] === "prospecting_sequence_draft_save")).toHaveLength(
    1,
  );
});
it("sequence draft list requires view and uses requested workspace", async () => {
  const c = client(),
    w = crypto.randomUUID();
  await expect(listDrafts(c.value, w)).resolves.toEqual([]);
  expect(c.rpc).toHaveBeenLastCalledWith("prospecting_sequence_draft_list", { p_workspace: w });
});
