import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sequenceInsights } from "./insights.server";
import { insightsSchema, sequenceReasonLabel } from "./insights";
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  V = "50000000-0000-4000-8000-000000000001";
const input = { workspaceId: W, versionId: V };
const report = {
  states: { active: 1 },
  counts: {
    emailAccepted: 1,
    whatsappAccepted: 0,
    callActivities: 0,
    taskActivities: 0,
    uncertainEffects: 0,
    projectionPending: 0,
  },
  responses: 0,
  meetings: 0,
  coverage: "current_scope",
  history: [],
};
function fixture(failure?: string, foreign = false) {
  const rpc = vi.fn(
    async (name: string): Promise<{ data: unknown; error: null | { message: string } }> => ({
      data:
        name === "sales_access_context"
          ? { actor: V, workspace: foreign ? V : W }
          : name === "prospecting_sequence_insights"
            ? structuredClone(report)
            : true,
      error: failure && name === "sales_area_authorize" ? { message: failure } : null,
    }),
  );
  return { rpc, client: { rpc } as unknown as SupabaseClient };
}
it("insights allows current authorized scope and validates the bounded payload", async () => {
  const f = fixture();
  expect(await sequenceInsights(f.client, input)).toEqual(report);
  expect(f.rpc).toHaveBeenLastCalledWith("prospecting_sequence_insights", {
    p_workspace: W,
    p_version: V,
  });
});
it("insights rejects missing permission before reading metrics", async () => {
  const f = fixture("missing_permission");
  await expect(sequenceInsights(f.client, input)).rejects.toThrow();
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("insights rejects explicit deny before reading metrics", async () => {
  const f = fixture("explicit_deny");
  await expect(sequenceInsights(f.client, input)).rejects.toThrow();
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("insights rejects inactive membership before reading metrics", async () => {
  const f = fixture("inactive_member");
  await expect(sequenceInsights(f.client, input)).rejects.toThrow();
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("insights refuses foreign workspace before reading metrics", async () => {
  const f = fixture(undefined, true);
  await expect(sequenceInsights(f.client, input)).rejects.toThrow();
  expect(f.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_insights")).toBe(false);
});
it("insights never turns an unavailable or malformed count into zero", async () => {
  const f = fixture(),
    original = f.rpc.getMockImplementation()!;
  f.rpc.mockImplementation(async (n) =>
    n === "prospecting_sequence_insights"
      ? { data: { ...report, counts: null }, error: null }
      : original(n),
  );
  await expect(sequenceInsights(f.client, input)).rejects.toThrow();
  expect(insightsSchema.safeParse({ ...report, receipt: { token: "hidden" } }).success).toBe(false);
  expect(insightsSchema.safeParse({ ...report, states: { active: -1 } }).success).toBe(false);
});
it("insights labels operational reasons and preserves custom end text", () => {
  expect(sequenceReasonLabel("provider_result_unknown")).toBe("Resultado do provedor a conferir");
  expect(sequenceReasonLabel("Encerrar por decisão comercial")).toBe(
    "Encerrar por decisão comercial",
  );
  expect(sequenceReasonLabel(null)).toBe("—");
});
