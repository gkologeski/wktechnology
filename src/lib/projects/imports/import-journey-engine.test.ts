import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyRow } from "./import-journey-status.server";
const W = "aaaaaaaa-0000-4000-8000-000000000001",
  U = "10000000-0000-4000-8000-000000000001",
  JOB = "20000000-0000-4000-8000-000000000001",
  PREVIEW = "30000000-0000-4000-8000-000000000001",
  APPLY = "40000000-0000-4000-8000-000000000001";
const f = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  patches: [] as Array<Record<string, unknown>>,
  job: {} as Record<string, unknown>,
  failCheckpoint: false,
  created: 0,
  groups: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: async () => "aaaaaaaa-0000-4000-8000-000000000001",
}));
const clock = vi.hoisted(() => ({
  advance: vi.fn(),
  resume: vi.fn(),
  confirm: vi.fn(),
  start: vi.fn(),
}));
const jibble = vi.hoisted(() => ({
  advance: vi.fn(),
  resume: vi.fn(),
  confirm: vi.fn(),
  start: vi.fn(),
}));
const click = vi.hoisted(() => ({
  apply: vi.fn(),
  start: vi.fn(),
  collect: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("@/lib/integrations/clockify/clockify-service.server", () => ({
  advanceClockifyRun: clock.advance,
  setClockifyRunState: clock.resume,
  confirmClockifyPreview: clock.confirm,
  startClockifyRun: clock.start,
}));
vi.mock("@/lib/integrations/jibble/jibble-service.server", () => ({
  advanceJibbleRun: jibble.advance,
  setJibbleRunState: jibble.resume,
  confirmJibblePreview: jibble.confirm,
  startJibbleRun: jibble.start,
}));
vi.mock("@/lib/integrations/clickup/clickup-import.server", () => ({
  runStep: click.apply,
  startCollect: click.start,
  collectStep: click.collect,
  finishCollect: click.finish,
}));
vi.mock("./import-journey-status.server", () => ({
  getCounts: async () => ({ received: 5, ready: 3, pending: 2, unclassified: 0 }),
  getJourneyStatus: async () => ({
    workspaceId: W,
    runs: [],
    sources: [],
    summary: { received: 5, ready: 3, pending: 2, unclassified: 0 },
    legacyPending: false,
  }),
  loadJourneySources: async () => [],
}));
const adminRpc = vi.hoisted(() =>
  vi.fn(async (_name: string, args: Record<string, unknown>) => {
    if (f.failCheckpoint) {
      f.failCheckpoint = false;
      throw new Error("Response interrupted");
    }
    f.patches.push(args.p_patch as Record<string, unknown>);
    return { data: true, error: null };
  }),
);
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: adminRpc } }));
import { advanceJourney } from "./import-journey-engine.server";

function client(): SupabaseClient {
  return {
    rpc: vi.fn(async (name: string) => ({
      data:
        name === "project_import_journey_claim"
          ? structuredClone(f.job)
          : name === "project_import_ready_step"
            ? { done: true }
            : name === "project_import_entity_counts"
              ? []
              : true,
      error: null,
    })),
    from: vi.fn((table: string) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push((r) => r[k] === v);
          return q;
        },
        neq: (k: string, v: unknown) => {
          filters.push((r) => r[k] !== v);
          return q;
        },
        in: (k: string, vs: unknown[]) => {
          filters.push((r) => vs.includes(r[k]));
          return q;
        },
        order: () => q,
        limit: () => q,
        range: async () => ({
          data: table === "clickup_import_groups" ? f.groups : [],
          error: null,
        }),
        maybeSingle: async () => ({
          data: f.rows.find((r) => filters.every((fn) => fn(r))) ?? null,
          error: null,
        }),
      };
      return q;
    }),
  } as unknown as SupabaseClient;
}
function ctx() {
  return { client: client(), workspaceId: W, userId: U };
}
function row(
  provider: JourneyRow["provider"] = "clockify",
  stage: JourneyRow["stage"] = "collect",
) {
  return {
    id: JOB,
    workspace_id: W,
    provider,
    source_id: provider === "clickup" ? "11" : "source",
    source_name: "Origem",
    requested_by: U,
    stage,
    status: "running",
    native_run_id: PREVIEW,
    preview_run_id: null,
    coverage: { complete: true },
    error: null,
    created_at: "2026-11-26T00:00:00Z",
    finished_at: null,
    lease_token: U,
    backfill_done: true,
  } satisfies JourneyRow;
}
beforeEach(() => {
  vi.clearAllMocks();
  f.rows = [];
  f.patches = [];
  f.job = row();
  f.failCheckpoint = false;
  f.created = 0;
  f.groups = [];
  clock.start.mockImplementation(async () => {
    f.created++;
    f.rows.push({
      id: APPLY,
      workspace_id: W,
      kind: "import",
      status: "queued",
      preview_run_id: PREVIEW,
      source_workspace_id: "source",
    });
    return { runId: APPLY };
  });
  jibble.start.mockResolvedValue({ runId: APPLY });
});
it("reuses the existing Clockify application after a response was lost before checkpoint", async () => {
  f.rows = [
    {
      id: PREVIEW,
      workspace_id: W,
      kind: "dry_run",
      status: "completed",
      report: { coverage: { complete: true, gaps: [] } },
    },
  ];
  f.failCheckpoint = true;
  await expect(advanceJourney(ctx(), { provider: "clockify", runId: JOB })).rejects.toThrow(
    "Response interrupted",
  );
  await advanceJourney(ctx(), { provider: "clockify", runId: JOB, action: "resume" });
  expect(f.created).toBe(1);
  expect(clock.start).toHaveBeenCalledTimes(1);
  expect(f.patches.at(-1)).toMatchObject({
    stage: "apply",
    native_run_id: APPLY,
    preview_run_id: PREVIEW,
  });
});
it("reuses a completed Jibble application with the same preview instead of importing again", async () => {
  f.job = row("jibble");
  f.rows = [
    {
      id: PREVIEW,
      workspace_id: W,
      provider: "jibble",
      kind: "dry_run",
      status: "completed",
      report: { coverage: { complete: true, gaps: [] } },
    },
    {
      id: APPLY,
      workspace_id: W,
      provider: "jibble",
      kind: "import",
      preview_run_id: PREVIEW,
      status: "completed",
    },
  ];
  await advanceJourney(ctx(), { provider: "jibble", runId: JOB });
  expect(jibble.start).not.toHaveBeenCalled();
  expect(f.patches.at(-1)).toMatchObject({ native_run_id: APPLY, stage: "apply" });
});
it("does not adopt an active Jibble rollback or a different provider run", async () => {
  f.job = { ...row("jibble"), native_run_id: null };
  f.rows = [
    { id: PREVIEW, workspace_id: W, provider: "jibble", kind: "rollback", status: "queued" },
    { id: APPLY, workspace_id: W, provider: "different", kind: "dry_run", status: "queued" },
  ];
  jibble.start.mockRejectedValueOnce(new Error("Há um desfazer em andamento."));
  await advanceJourney(ctx(), { provider: "jibble", runId: JOB });
  expect(jibble.advance).not.toHaveBeenCalled();
  expect(f.patches.at(-1)).toMatchObject({
    status: "paused",
    error: "Há um desfazer em andamento.",
  });
});
it("does not adopt ClickUp collection for different confirmed source teams", async () => {
  f.job = { ...row("clickup"), native_run_id: null };
  f.rows = [{ id: PREVIEW, workspace_id: W, status: "collecting", source_team_ids: ["22"] }];
  await advanceJourney(ctx(), { provider: "clickup", runId: JOB });
  expect(click.start).not.toHaveBeenCalled();
  expect(click.collect).not.toHaveBeenCalled();
  expect(f.patches.at(-1)).toMatchObject({
    status: "paused",
    error: expect.stringContaining("outras organizações"),
  });
});
it("a discarded ClickUp native run pauses instead of polling forever", async () => {
  f.job = row("clickup", "apply");
  f.rows = [{ id: PREVIEW, workspace_id: W, status: "discarded" }];
  await advanceJourney(ctx(), { provider: "clickup", runId: JOB });
  expect(click.apply).not.toHaveBeenCalled();
  expect(f.patches.at(-1)).toMatchObject({
    status: "paused",
    error: expect.stringContaining("encerrada"),
  });
});
it("finishes reference classification before declaring the time import complete", async () => {
  f.job = row("clockify", "apply");
  f.rows = [{ id: PREVIEW, workspace_id: W, kind: "import", status: "completed" }];
  await advanceJourney(ctx(), { provider: "clockify", runId: JOB });
  expect(f.patches.at(-1)).toMatchObject({
    stage: "done",
    status: "complete",
    counts: { received: 5, ready: 3, pending: 2, unclassified: 0 },
  });
});

it("reconciles a ClickUp run already applied in another tab before classifying references", async () => {
  f.job = row("clickup", "collect");
  f.rows = [
    {
      id: PREVIEW,
      workspace_id: W,
      status: "applied",
      source_team_ids: ["11"],
      collect_coverage: { complete: true, gaps: [] },
    },
  ];
  const context = ctx();
  await advanceJourney(context, { provider: "clickup", runId: JOB });
  expect(click.collect).not.toHaveBeenCalled();
  expect(click.apply).not.toHaveBeenCalled();
  expect(context.client.rpc).not.toHaveBeenCalledWith(
    "project_import_ready_step",
    expect.anything(),
  );
  expect(f.patches.at(-1)).toMatchObject({ stage: "apply", preview_run_id: PREVIEW });
});

it("restarts a legacy ClickUp preview after its originals were adopted, without deleting staging", async () => {
  f.job = { ...row("clickup"), native_run_id: null };
  f.rows = [{ id: PREVIEW, workspace_id: W, status: "collecting", source_team_ids: [] }];
  click.start.mockResolvedValueOnce({ runId: APPLY });
  await advanceJourney(ctx(), { provider: "clickup", runId: JOB });
  expect(click.start).toHaveBeenCalledTimes(1);
  expect(f.patches.at(-1)).toMatchObject({ stage: "collect", native_run_id: APPLY });
});
it("finishes a scoped legacy ClickUp application before starting full collection", async () => {
  f.job = row("clickup");
  f.rows = [{ id: PREVIEW, workspace_id: W, status: "applying", source_team_ids: [] }];
  f.groups = [{ team_id: "11" }];
  click.apply.mockImplementationOnce(async () => {
    f.rows[0].status = "applied";
  });
  await advanceJourney(ctx(), { provider: "clickup", runId: JOB });
  expect(click.apply).toHaveBeenCalledTimes(1);
  expect(f.patches.at(-1)).toMatchObject({ stage: "collect", native_run_id: null });
});
it("refuses a legacy ClickUp application outside the explicitly selected organizations", async () => {
  f.job = row("clickup");
  f.rows = [{ id: PREVIEW, workspace_id: W, status: "applying", source_team_ids: [] }];
  f.groups = [{ team_id: "22" }];
  await advanceJourney(ctx(), { provider: "clickup", runId: JOB });
  expect(click.apply).not.toHaveBeenCalled();
  expect(f.patches.at(-1)).toMatchObject({
    status: "paused",
    error: expect.stringContaining("não confirmada"),
  });
});
