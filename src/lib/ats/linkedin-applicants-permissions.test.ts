import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), applicants: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/phone/phone-boundary", () => ({ sourcePhone: () => null }));
vi.mock("./adapters/linkedin/job-board", () => ({
  LinkedInJobBoardAdapter: { listApplicants: mocks.applicants },
}));
import { syncPostingApplicants } from "./linkedin-applicants-sync.server";
type Result = { data: unknown; error: unknown };
const queues: Record<string, Result[]> = {};
const queries: Array<{
  table: string;
  filters: Array<[string, unknown]>;
  payload?: Record<string, unknown>;
  action?: string;
}> = [];
function seed(table: string, ...data: unknown[]) {
  queues[table] = data.map((value) => ({ data: value, error: null }));
}
function client(table: string) {
  const record: (typeof queries)[number] = { table, filters: [] };
  queries.push(record);
  const finish = () => Promise.resolve(queues[table]?.shift() ?? { data: null, error: null });
  const q = {
    select: () => q,
    limit: () => q,
    eq: (k: string, v: unknown) => {
      record.filters.push([k, v]);
      return q;
    },
    ilike: (k: string, v: unknown) => {
      record.filters.push([k, v]);
      return q;
    },
    is: () => q,
    insert: (p: Record<string, unknown>) => {
      record.action = "insert";
      record.payload = p;
      return q;
    },
    update: (p: Record<string, unknown>) => {
      record.action = "update";
      record.payload = p;
      return q;
    },
    single: finish,
    maybeSingle: finish,
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      finish().then(resolve, reject),
  };
  return q;
}
const applicant = {
  providerApplicantId: "applicant",
  fullName: "Test",
  email: "test@example.test",
  linkedinUrl: "https://linkedin.com/in/test_user",
  phone: null,
  headline: null,
  location: null,
  resumeUrl: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  for (const key of Object.keys(queues)) delete queues[key];
  mocks.from.mockImplementation(client);
  seed(
    "ats_job_postings",
    {
      id: "posting",
      owner_id: "creator",
      job_id: "job",
      provider: "linkedin",
      status: "published",
      external_id: "external",
      is_mock: false,
      metadata: { applicants_sync_cursor: "retry-page" },
    },
    null,
  );
  seed("ats_jobs", { workspace_id: "workspace", pipeline_id: "pipeline" });
  seed("ats_pipelines", { stages: [{ value: "intake", label: "Intake", type: "open" }] });
  seed("ats_applications", null, null);
  mocks.applicants.mockResolvedValue({
    ok: true,
    data: { applicants: [applicant], nextCursor: null },
  });
});
it("provider errors report failure and preserve the cursor for retry", async () => {
  mocks.applicants.mockResolvedValue({ ok: false, error: "Provider unavailable" });
  const r = await syncPostingApplicants("posting");
  expect(r.ok).toBe(false);
  expect(r.error).toBe("Provider unavailable");
  const metadata = queries.find((q) => q.table === "ats_job_postings" && q.action)?.payload
    ?.metadata as Record<string, unknown>;
  expect(metadata.applicants_sync_cursor).toBe("retry-page");
  expect(queries.some((q) => q.table === "ats_candidates")).toBe(false);
});
it("ambiguous candidate matches never choose an arbitrary person or advance past a failed page", async () => {
  seed("ats_candidates", [{ id: "first" }, { id: "second" }]);
  const r = await syncPostingApplicants("posting");
  expect(r.ok).toBe(false);
  expect(r.error).toBe("ambiguous_candidate_linkedin_url");
  expect(r.createdApplications).toBe(0);
  const query = queries.find((q) => q.table === "ats_candidates");
  expect(query?.filters).toContainEqual(["workspace_id", "workspace"]);
  expect(query?.filters).toContainEqual(["linkedin_url", "https://linkedin.com/in/test\\_user"]);
  const metadata = queries.find((q) => q.table === "ats_job_postings" && q.action)?.payload
    ?.metadata as Record<string, unknown>;
  expect(metadata.applicants_sync_cursor).toBe("retry-page");
});
it("new candidate and candidature use the actual job tenant and pipeline", async () => {
  seed("ats_candidates", [], [], { id: "candidate" });
  const r = await syncPostingApplicants("posting");
  expect(r.ok).toBe(true);
  expect(r.createdApplications).toBe(1);
  expect(
    queries.find((q) => q.table === "ats_candidates" && q.action === "insert")?.payload,
  ).toMatchObject({ workspace_id: "workspace", owner_id: "creator" });
  expect(
    queries.find((q) => q.table === "ats_applications" && q.action === "insert")?.payload,
  ).toMatchObject({ workspace_id: "workspace", stage_value: "intake", candidate_id: "candidate" });
});
