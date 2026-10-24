import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { complianceRpc, consentSchema, createRequestSchema } from "./compliance.server";
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
beforeEach(() => vi.clearAllMocks());
it("propagates database authorization failure without returning an empty success", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "Denied by scope" } });
  await expect(
    complianceRpc(client, "ats_compliance_export", { _candidate: "candidate" }),
  ).rejects.toThrow("Denied by scope");
});
it("rejects missing confirmation", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(complianceRpc(client, "ats_compliance_write", {})).rejects.toThrow("não confirmada");
});
it("preserves the authenticated client and exact request binding", async () => {
  const snapshot = { candidate: { id: "candidate" }, scope: { description: "caller permissions" } };
  rpc.mockResolvedValue({ data: snapshot, error: null });
  await expect(
    complianceRpc(client, "ats_compliance_export", {
      _candidate: "candidate",
      _request: "request",
    }),
  ).resolves.toEqual(snapshot);
  expect(rpc).toHaveBeenCalledWith("ats_compliance_export", {
    _candidate: "candidate",
    _request: "request",
  });
  expect(rpc.mock.instances[0]).toBe(client);
});
it("rejects malformed identifiers, request type and empty consent purpose", () => {
  expect(
    createRequestSchema.safeParse({ candidate_id: "invalid", request_type: "unknown" }).success,
  ).toBe(false);
  expect(
    consentSchema.safeParse({
      candidate_id: "95100000-0000-4000-8000-000000000002",
      purpose: " ",
      granted: true,
    }).success,
  ).toBe(false);
});
it("requires a boolean consent decision and an explicit timezone", () => {
  const candidate_id = "95100000-0000-4000-8000-000000000002";
  expect(
    consentSchema.safeParse({ candidate_id, purpose: "Recruitment", granted: "false" }).success,
  ).toBe(false);
  expect(
    consentSchema.safeParse({
      candidate_id,
      purpose: "Recruitment",
      granted: true,
      expires_at: "2027-01-01T09:00:00",
    }).success,
  ).toBe(false);
  expect(
    consentSchema.parse({
      candidate_id,
      purpose: "Recruitment",
      granted: false,
      expires_at: "2027-01-01T09:00:00-03:00",
    }).granted,
  ).toBe(false);
});
