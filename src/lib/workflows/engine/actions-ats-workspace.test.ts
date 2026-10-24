import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import type { RunCtx } from "./run-context";
vi.mock("../engine-shared.server", () => ({ renderTokens: (value: unknown) => value }));
import { handleAtsAction } from "./actions-ats.server";

it.each([true, false])(
  "workflow job creation uses the source workspace, with existing pipeline = %s",
  async (existing) => {
    const pipelineFilters: unknown[] = [];
    const inserted: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const from = vi.fn((table: string) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((key: string, value: unknown) => {
          pipelineFilters.push([table, key, value]);
          return query;
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: existing ? { id: "pipeline" } : null, error: null }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          inserted.push({ table, payload });
          return query;
        }),
        single: vi.fn().mockResolvedValue({
          data: { id: table === "ats_pipelines" ? "created-pipeline" : "job" },
          error: null,
        }),
      };
      return query;
    });
    const context: RunCtx = {
      ownerId: "creator-user",
      workspaceId: "source-workspace",
      entity: "deals",
      entityId: "deal",
      after: { company_id: "company" },
      before: null,
    };
    const result = await handleAtsAction(
      { from } as unknown as SupabaseClient,
      { type: "create_ats_job", title: "Vaga", headcount: 1 },
      context,
      "now",
    );
    expect(result?.ok).toBe(true);
    expect(pipelineFilters).toContainEqual(["ats_pipelines", "workspace_id", "source-workspace"]);
    expect(inserted.find((r) => r.table === "ats_jobs")?.payload).toMatchObject({
      owner_id: "creator-user",
      workspace_id: "source-workspace",
      deal_id: "deal",
    });
    if (!existing)
      expect(inserted.find((r) => r.table === "ats_pipelines")?.payload.workspace_id).toBe(
        "source-workspace",
      );
  },
);
it("a workflow without a source workspace cannot create a pipeline or a job", async () => {
  const from = vi.fn();
  const context = {
    workspaceId: "",
    ownerId: "creator",
    entity: "deals",
    entityId: "deal",
    after: {},
    before: null,
  } as RunCtx;
  await expect(
    handleAtsAction(
      { from } as unknown as SupabaseClient,
      { type: "create_ats_job", title: "Vaga" },
      context,
      "now",
    ),
  ).rejects.toThrow("Workspace do fluxo");
  expect(from).not.toHaveBeenCalled();
});
