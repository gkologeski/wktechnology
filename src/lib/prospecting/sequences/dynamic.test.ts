import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOM_FIELD_PREFIX } from "@/lib/whatsapp/campaign-audience";
import { newDefinition, newStep } from "./draft";
import {
  dynamicCandidates,
  setSequenceSubscription,
  scanSequenceSubscription,
} from "./dynamic.server";
const mocks = vi.hoisted(() => ({ preflight: vi.fn() }));
vi.mock("./releases.server", () => ({ preflightSequenceDefinition: mocks.preflight }));
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  U = "10000000-0000-4000-8000-000000000002",
  ID = "50000000-0000-4000-8000-000000000001";
const data = {
  workspaceId: W,
  versionId: ID,
  enabled: true,
  consentEvidence: "Future audience authorized",
};
function fixture(failure?: string, foreign = false) {
  const definition = newDefinition();
  definition.audience.entry = "dynamic";
  definition.steps = [
    {
      ...newStep("call"),
      type: "call",
      mode: "human",
      assigneeId: U,
      scriptId: null,
      notes: "No call",
      attempts: 1,
    },
    newStep("end"),
  ];
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "sales_access_context"
        ? { workspace: foreign ? ID : W, actor: U, read_only: false }
        : name === "prospecting_sequence_subscription_set"
          ? ID
          : name === "prospecting_sequence_subscription_candidates"
            ? {
                matchedCount: 1,
                policyClock: null,
                sources: {
                  ["contact:" + ID]: { email: null, phones: ["+5548991104003", null, null] },
                },
              }
            : name === "prospecting_sequence_subscription_commit"
              ? { started: 1, matched: 1 }
              : true,
    error: failure && name === "sales_area_authorize" ? { message: failure } : null,
  }));
  const from = vi.fn(() => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: { definition }, error: null }),
    };
    return q;
  });
  return { definition, rpc, from, db: { rpc, from } as unknown as SupabaseClient };
}
beforeEach(() =>
  mocks.preflight.mockReset().mockResolvedValue({ configurationValid: true, issues: [] }),
);
it("dynamic activation uses current caller and frozen version preflight", async () => {
  const f = fixture();
  await expect(setSequenceSubscription(f.db, data)).resolves.toBe(ID);
  expect(mocks.preflight).toHaveBeenCalledOnce();
  expect(f.rpc).toHaveBeenCalledWith("prospecting_sequence_subscription_set", {
    p_workspace: W,
    p_version: ID,
    p_enabled: true,
    p_consent: data.consentEvidence,
  });
});
it("dynamic activation rejects missing permission before reads", async () => {
  const f = fixture("missing permission");
  await expect(setSequenceSubscription(f.db, data)).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("dynamic activation preserves explicit deny", async () => {
  const f = fixture("explicit deny");
  await expect(setSequenceSubscription(f.db, data)).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("dynamic activation refuses foreign workspace", async () => {
  const f = fixture(undefined, true);
  await expect(setSequenceSubscription(f.db, data)).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("dynamic activation refuses inactive membership", async () => {
  const f = fixture("inactive member");
  await expect(setSequenceSubscription(f.db, data)).rejects.toThrow();
  expect(f.from).not.toHaveBeenCalled();
});
it("pausing future entry does not preflight providers or start/cancel existing runs", async () => {
  const f = fixture();
  await setSequenceSubscription(f.db, { ...data, enabled: false, consentEvidence: "" });
  expect(f.from).not.toHaveBeenCalled();
  expect(mocks.preflight).not.toHaveBeenCalled();
  expect(
    f.rpc.mock.calls.some(
      ([n]) => n === "prospecting_sequence_start" || n === "prospecting_sequence_control",
    ),
  ).toBe(false);
});
it("dynamic worker compiles protected candidates and commits counts without exposing addresses", async () => {
  const f = fixture();
  const result = await scanSequenceSubscription(f.db, {
    id: ID,
    workspace_id: W,
    version_id: ID,
    lease_token: U,
  });
  expect(result).toEqual({ started: 1, matched: 1 });
  expect(JSON.stringify(result)).not.toContain("5548");
  const commit = f.rpc.mock.calls.find(([n]) => n === "prospecting_sequence_subscription_commit");
  expect(commit).toBeTruthy();
});
it("dynamic worker reports failure rather than inventing an empty successful audience", async () => {
  const f = fixture();
  f.from.mockImplementation(() => {
    throw new Error("secret contact or token");
  });
  const result = await scanSequenceSubscription(f.db, {
    id: ID,
    workspace_id: W,
    version_id: ID,
    lease_token: U,
  });
  expect(result).toMatchObject({ error: "scan_unavailable" });
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(f.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_subscription_commit")).toBe(
    false,
  );
});
it("protected masked addresses are never replaced from raw records", () => {
  const f = fixture();
  const candidates = dynamicCandidates(
    { ["contact:" + ID]: { email: null, phones: [null, null, null] } },
    f.definition,
  );
  expect(candidates[0].channels.call).toBe(false);
  expect(candidates[0].phones).toEqual([]);
  expect(candidates[0].email).toBeNull();
});

it("dynamic filters normalize empty groups exactly like WhatsApp", async () => {
  const f = fixture();
  f.definition.audience.groups = [{ logic: "and", filters: [] }];
  await scanSequenceSubscription(f.db, { id: ID, workspace_id: W, version_id: ID, lease_token: U });
  expect(f.rpc).toHaveBeenCalledWith(
    "prospecting_sequence_subscription_candidates",
    expect.objectContaining({ p_groups: [] }),
  );
  expect(f.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_subscription_catalog")).toBe(
    false,
  );
});
it("dynamic worker rejects an unregistered custom field before evaluating the audience", async () => {
  const f = fixture();
  f.definition.audience.groups = [
    {
      logic: "and",
      filters: [
        { entity: "contacts", column: CUSTOM_FIELD_PREFIX + "missing", op: "eq", value: "private" },
      ],
    },
  ];
  const original = f.rpc.getMockImplementation()!;
  f.rpc.mockImplementation(async (name) =>
    name === "prospecting_sequence_subscription_catalog"
      ? ({
          data: { columns: { leads: [], contacts: [], companies: [], deals: [] }, custom: [] },
          error: null,
        } as never)
      : original(name),
  );
  const result = await scanSequenceSubscription(f.db, {
    id: ID,
    workspace_id: W,
    version_id: ID,
    lease_token: U,
  });
  expect(result).toMatchObject({ error: "scan_unavailable" });
  expect(f.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_subscription_candidates")).toBe(
    false,
  );
});
