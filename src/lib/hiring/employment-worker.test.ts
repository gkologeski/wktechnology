import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/lib/workflows/engine-shared.server", () => ({ renderTokens: (v: unknown) => v }));
vi.mock("@/lib/contracts/contract-create.server", () => ({ createContractShared: vi.fn() }));
import { handleHiringAction } from "@/lib/workflows/engine/actions-hiring.server";
import type { RunCtx } from "@/lib/workflows/engine/run-context";
const ctx = (): RunCtx => ({
  entity: "ats_applications",
  entityId: "application",
  workspaceId: "workspace",
  ownerId: "actor",
  workflowId: "workflow",
  after: { candidate_id: "candidate", job_id: "job" },
  before: null,
  vars: {},
});
it("governed worker uses the transactional source and never falls through to legacy writes", async () => {
  const from = vi.fn();
  const rpc = vi.fn().mockResolvedValue({
    data: { handled: true, id: "person", person_id: "person", engagement_id: "engagement" },
    error: null,
  });
  const c = ctx();
  const result = await handleHiringAction(
    { rpc, from } as unknown as SupabaseClient,
    { type: "create_person_from_candidate" },
    c,
    "now",
  );
  expect(result?.ok).toBe(true);
  expect(c.vars?.contratacao).toEqual({ person_id: "person" });
  expect(from).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith(
    "hiring_workflow_employment",
    expect.objectContaining({ w: "workspace", p_application: "application", p_actor: "actor" }),
  );
});
it("governed worker stops before any side effect when current employment authority is denied", async () => {
  const from = vi.fn();
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: null, error: { message: "Sem permissão de admissão" } });
  await expect(
    handleHiringAction(
      { rpc, from } as unknown as SupabaseClient,
      { type: "create_person_from_candidate" },
      ctx(),
      "now",
    ),
  ).rejects.toThrow("Sem permissão");
  expect(from).not.toHaveBeenCalled();
});

it.each(["create_payable_schedule", "create_receivable_invoice"] as const)(
  "governed finance worker blocks %s before a legacy obligation",
  async (type) => {
    const from = vi.fn(),
      rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "FINANCE_MONTHLY_FLOW: use provisão e medição" },
      });
    await expect(
      handleHiringAction(
        { rpc, from } as unknown as SupabaseClient,
        { type, amount: "100" },
        ctx(),
        "now",
      ),
    ).rejects.toThrow("FINANCE_MONTHLY_FLOW");
    expect(rpc).toHaveBeenCalledWith(
      "hiring_workflow_finance_guard",
      expect.objectContaining({ w: "workspace", p_application: "application", p_actor: "actor" }),
    );
    expect(from).not.toHaveBeenCalled();
  },
);
