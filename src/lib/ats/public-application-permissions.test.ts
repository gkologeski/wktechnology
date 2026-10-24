import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), audit: vi.fn(), email: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/phone/phone-boundary", () => ({
  humanPhone: () => null,
  workspacePhoneCountry: async () => "BR",
}));
vi.mock("./audit.server", () => ({ recordAtsEvent: mocks.audit }));
vi.mock("./email-engine.server", () => ({ enqueueApplicationConfirmation: mocks.email }));
import { listPublicJobs, submitPublicApplication } from "./public.functions";
type Result = { data: unknown; error: unknown };
const queues: Record<string, Result[]> = {};
const queries: Array<{
  table: string;
  filters: Array<[string, unknown]>;
  payload?: Record<string, unknown>;
  options?: unknown;
  action?: string;
}> = [];
function seed(table: string, ...values: unknown[]) {
  queues[table] = values.map((data) => ({ data, error: null }));
}
function client(table: string) {
  const record: (typeof queries)[number] = { table, filters: [] };
  queries.push(record);
  const finish = () => Promise.resolve(queues[table]?.shift() ?? { data: null, error: null });
  const query = {
    select: () => query,
    order: () => query,
    limit: () => query,
    eq: (key: string, value: unknown) => {
      record.filters.push([key, value]);
      return query;
    },
    insert: (payload: Record<string, unknown>) => {
      record.action = "insert";
      record.payload = payload;
      return query;
    },
    upsert: (payload: Record<string, unknown>, options: unknown) => {
      record.action = "upsert";
      record.payload = payload;
      record.options = options;
      return query;
    },
    maybeSingle: finish,
    single: finish,
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      finish().then(resolve, reject),
  };
  return query;
}
const call = (fn: unknown, data: unknown) => (fn as (arg: unknown) => Promise<unknown>)({ data });
const input = {
  host: "careers.example.test",
  job_id: "job",
  full_name: "Test Applicant",
  email: "test@example.test",
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(queues)) delete queues[key];
  queries.length = 0;
  mocks.from.mockImplementation(client);
  seed("module_branding", { workspace_id: "workspace" });
  seed("workspace_modules", { workspace_id: "workspace" });
  seed("workspaces", { created_by: "creator" });
  seed("ats_jobs", {
    id: "job",
    owner_id: "other-recruiter",
    workspace_id: "workspace",
    status: "published",
    pipeline_id: "pipeline",
    title: "Job",
  });
  seed("ats_pipelines", { stages: [{ value: "custom_intake", label: "Intake", type: "open" }] });
  seed("ats_candidates", { id: "candidate" });
});
it("a repeated public application does not reset status, hiring details or audit history", async () => {
  seed("ats_applications", null, { id: "existing-hired-application" });
  expect(await call(submitPublicApplication, input)).toEqual({ ok: true });
  const write = queries.find((q) => q.table === "ats_applications" && q.action);
  expect(write?.options).toEqual({ onConflict: "job_id,candidate_id", ignoreDuplicates: true });
  expect(queries.some((q) => q.table === "ats_application_events")).toBe(false);
  expect(queries.find((q) => q.table === "ats_candidates")?.filters).toContainEqual([
    "workspace_id",
    "workspace",
  ]);
  expect(queries.filter((q) => q.table === "ats_applications").at(-1)?.filters).toContainEqual([
    "workspace_id",
    "workspace",
  ]);
});
it("public candidate and candidature writes use the job workspace and configured initial stage", async () => {
  seed("ats_candidates", null, { id: "new-candidate" });
  seed("ats_applications", { id: "new-application" });
  await call(submitPublicApplication, input);
  expect(queries.find((q) => q.table === "ats_candidates" && q.action)?.payload).toMatchObject({
    workspace_id: "workspace",
    owner_id: "creator",
  });
  expect(queries.find((q) => q.table === "ats_applications" && q.action)?.payload).toMatchObject({
    workspace_id: "workspace",
    stage_value: "custom_intake",
    candidate_id: "new-candidate",
  });
  expect(
    queries.find((q) => q.table === "ats_application_events" && q.action)?.payload,
  ).toMatchObject({ workspace_id: "workspace" });
});
it("a published job in another workspace cannot receive an application through this portal", async () => {
  seed("ats_jobs", {
    id: "job",
    owner_id: "creator",
    workspace_id: "other-workspace",
    status: "published",
  });
  await expect(call(submitPublicApplication, input)).rejects.toThrow("Vaga indisponível");
  expect(queries.some((q) => q.action)).toBe(false);
});
it("published job listing and branding share one workspace even when jobs have different creators", async () => {
  seed("module_branding", { workspace_id: "workspace" }, { product_name: "Portal" });
  seed("ats_jobs", [{ id: "other-creator-job" }]);
  expect(await call(listPublicJobs, { host: input.host })).toEqual({
    jobs: [{ id: "other-creator-job" }],
    branding: { product_name: "Portal" },
  });
  const query = queries.find((q) => q.table === "ats_jobs");
  expect(query?.filters).toContainEqual(["workspace_id", "workspace"]);
  expect(query?.filters.some(([key]) => key === "owner_id")).toBe(false);
  expect(queries.filter((q) => q.table === "module_branding").at(-1)?.filters).toContainEqual([
    "workspace_id",
    "workspace",
  ]);
});
it("a matched but disabled career workspace never falls through to another tenant", async () => {
  seed("workspace_modules", null);
  expect(await call(listPublicJobs, { host: input.host })).toEqual({ jobs: [], branding: null });
  expect(queries.some((q) => q.table === "ats_jobs")).toBe(false);
});
