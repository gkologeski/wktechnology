import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  create: vi.fn(),
  active: vi.fn(),
  permission: vi.fn(),
  has: vi.fn(),
  from: vi.fn(),
  admin: vi.fn(),
  ai: vi.fn(),
  emit: vi.fn(),
  account: vi.fn(),
  close: vi.fn(),
  post: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/hr-records.server", () => ({
  assertHrRecordAccess: mocks.record,
  assertHrCreate: mocks.create,
}));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: mocks.active,
  assertAnyPermission: mocks.permission,
  hasPermission: mocks.has,
}));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: mocks.active }));
vi.mock("@/lib/events.server", () => ({ emitEvent: mocks.emit }));
vi.mock("@/lib/ats/audit.server", () => ({ recordAtsEvent: mocks.emit }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.admin } }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({ aiChatFetch: mocks.ai }));
vi.mock("@/lib/unipile/client.server", () => ({ loadAccountCtx: mocks.account }));
vi.mock("@/lib/ats/adapters/linkedin/job-board", () => ({
  LinkedInJobBoardAdapter: { closeJob: mocks.close, postJob: mocks.post },
}));
import {
  listJobApplications,
  addApplication,
  moveApplication,
  listApplicationEvents,
  listJobInterviews,
  getAtsDefaultPipeline,
  getAtsJob,
  saveAtsJob,
  deleteAtsJob,
  createJobFromDeal,
  setAtsJobStatus,
  setAtsJobDepartment,
} from "./ats.functions";
import {
  getLinkedinJobConfig,
  updateLinkedinJobConfig,
  searchLinkedinDirectory,
} from "./linkedin-job-config.functions";
import {
  rankPipelineCandidates,
  suggestInterviewQuestions,
  draftOutreach,
} from "./job-copilot.functions";
import {
  publishJobToProvider,
  listJobPostings,
  unpublishJobFromProvider,
  syncPostingApplicantsNow,
} from "./job-postings.functions";
import { exportAtsCandidatesCsv, exportJobApplicationsCsv } from "./export.functions";
import {
  ensureDefaultAtsPipeline,
  savePipeline,
  deletePipeline,
  setDefaultPipeline,
} from "./pipelines.functions";
import {
  listInterviews,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  markInterviewStatus,
  createSelfScheduleLink as createInterviewLink,
} from "./interviews.functions";
import { createSelfScheduleLink as createLegacyInterviewLink } from "./self-schedule.functions";
import { submitScorecardResponse } from "./scorecards.functions";
import { generateInterviewNotes, getInterviewWithNotes } from "./notetaker.functions";
const client = { from: mocks.from };
const call = (fn: unknown, data: unknown) =>
  (fn as (args: unknown) => Promise<unknown>)({
    data,
    context: { supabase: client, userId: "actor" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue("workspace");
  mocks.record.mockRejectedValue(new Error("Record denied"));
  mocks.create.mockRejectedValue(new Error("Create denied"));
  mocks.permission.mockRejectedValue(new Error("Permission denied"));
});
it.each([
  ["view", getAtsJob, { id: "job" }],
  ["update", saveAtsJob, { id: "job", status: "draft" }],
  ["delete", deleteAtsJob, { id: "job" }],
  ["update", setAtsJobStatus, { id: "job", status: "draft" }],
  ["update", setAtsJobDepartment, { id: "job", department: "RH" }],
  ["view", getLinkedinJobConfig, { job_id: "job" }],
  ["update", updateLinkedinJobConfig, { job_id: "job" }],
  ["update", searchLinkedinDirectory, { job_id: "job", keywords: "Acme", type: "COMPANY" }],
  ["view", listJobPostings, { job_id: "job" }],
  ["update", publishJobToProvider, { job_id: "job", provider: "linkedin" }],
  ["view", rankPipelineCandidates, { job_id: "job" }],
  ["view", suggestInterviewQuestions, { job_id: "job" }],
  ["view", draftOutreach, { job_id: "job", candidate_id: "candidate" }],
  ["view", exportJobApplicationsCsv, { jobId: "job" }],
])(
  "%s job operation is authorized before reads, privileged writes, AI or provider requests",
  async (action, fn, data) => {
    await expect(call(fn, data)).rejects.toThrow("Record denied");
    expect(mocks.record).toHaveBeenCalledWith(client, "jobs", action, "job");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  },
);
it.each([
  [saveAtsJob, { status: "draft" }],
  [createJobFromDeal, { dealId: "deal" }],
])(
  "creation never accepts an update key or creates a pipeline before create authorization",
  async (fn, data) => {
    await expect(call(fn, data)).rejects.toThrow("Create denied");
    expect(mocks.create).toHaveBeenCalledWith(client, "actor", "techhire.jobs");
    expect(mocks.from).not.toHaveBeenCalled();
  },
);
it("publish requires its own key after the actual row permission", async () => {
  mocks.record.mockResolvedValue(undefined);
  await expect(call(publishJobToProvider, { job_id: "job", provider: "linkedin" })).rejects.toThrow(
    "Permission denied",
  );
  expect(mocks.permission).toHaveBeenCalledWith(client, "actor", "workspace", [
    "techhire.jobs.publish.workspace",
  ]);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
});
it.each([unpublishJobFromProvider, syncPostingApplicantsNow])(
  "posting actions resolve the actual parent job and stop before elevated operations",
  async (fn) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "posting",
          job_id: "actual-job",
          provider: "linkedin",
          status: "published",
          external_id: "external",
          is_mock: false,
        },
        error: null,
      }),
    };
    mocks.from.mockReturnValue(query);
    await expect(call(fn, { posting_id: "posting" })).rejects.toThrow("Record denied");
    expect(mocks.record).toHaveBeenCalledWith(client, "jobs", "update", "actual-job");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  },
);
it("zero updated rows never produces a fake saved result or an event", async () => {
  mocks.record.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => {
    if (table === "ats_pipelines")
      return {
        select: () => ({
          eq: () => ({ limit: async () => ({ data: [{ id: "pipeline" }], error: null }) }),
        }),
      };
    if (table === "ats_jobs")
      return {
        update: () => ({
          eq: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        }),
      };
    throw new Error("Unexpected table " + table);
  });
  await expect(
    call(saveAtsJob, { id: "job", title: "Title", status: "draft", pipeline_id: "pipeline" }),
  ).rejects.toThrow("sem permissão para editar");
  expect(mocks.emit).not.toHaveBeenCalled();
});
it("candidate export requires export permission before querying personal data", async () => {
  await expect(call(exportAtsCandidatesCsv, {})).rejects.toThrow("Permission denied");
  expect(mocks.permission).toHaveBeenCalledWith(client, "actor", "workspace", [
    "techhire.candidates.export.workspace",
  ]);
  expect(mocks.from).not.toHaveBeenCalled();
});

it("the copilot never falls back to an administrative read when the caller cannot read the row", async () => {
  mocks.record.mockResolvedValue(undefined);
  mocks.permission.mockResolvedValue(undefined);
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  });
  await expect(call(rankPipelineCandidates, { job_id: "job" })).rejects.toThrow(
    "sem permissão de consulta",
  );
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.ai).not.toHaveBeenCalled();
});
it("the LinkedIn editor updates through the authenticated client after the record check", async () => {
  mocks.record.mockResolvedValue(undefined);
  let editing = false;
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockImplementation(() => {
      editing = true;
      return query;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: editing ? { id: "job" } : { id: "job", owner_id: "other" },
      error: null,
    })),
  };
  mocks.from.mockReturnValue(query);
  expect(await call(updateLinkedinJobConfig, { job_id: "job" })).toEqual({ ok: true, id: "job" });
  expect(query.update).toHaveBeenCalled();
  expect(mocks.record).toHaveBeenCalledWith(client, "jobs", "update", "job");
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("a provider failure never reports a successful unpublication or updates provider state", async () => {
  mocks.record.mockResolvedValue(undefined);
  mocks.permission.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue({ ok: false, error: "Provider failed" });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "posting", job_id: "job", provider: "linkedin", external_id: "external" },
      error: null,
    }),
  };
  mocks.from.mockReturnValue(query);
  await expect(call(unpublishJobFromProvider, { posting_id: "posting" })).rejects.toThrow(
    "Provider failed",
  );
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("a read-only caller gets the first visible pipeline without a promotion side effect", async () => {
  mocks.has.mockResolvedValue(false);
  mocks.permission.mockResolvedValue(undefined);
  const first = { id: "pipeline", owner_id: "other", is_default: false };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn(),
    insert: vi.fn(),
    then: (resolve: (x: unknown) => unknown) =>
      Promise.resolve({ data: [first], error: null }).then(resolve),
  };
  mocks.from.mockReturnValue(query);
  expect(await call(ensureDefaultAtsPipeline, {})).toEqual(first);
  expect(query.update).not.toHaveBeenCalled();
  expect(query.insert).not.toHaveBeenCalled();
});
it("an empty pipeline list does not authorize a default INSERT", async () => {
  mocks.permission.mockResolvedValueOnce(undefined);
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn(),
    then: (resolve: (x: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  mocks.from.mockReturnValue(query);
  await expect(call(ensureDefaultAtsPipeline, {})).rejects.toThrow("Permission denied");
  expect(mocks.permission).toHaveBeenCalledWith(client, "actor", "workspace", [
    "techhire.pipelines.create.own",
    "techhire.pipelines.create.workspace",
  ]);
  expect(query.insert).not.toHaveBeenCalled();
});

it.each([
  ["update", savePipeline, { id: "pipeline", is_default: false, stages: [] }],
  ["delete", deletePipeline, { id: "pipeline" }],
  ["update", setDefaultPipeline, { id: "pipeline" }],
])("pipeline %s is checked before data access", async (action, fn, data) => {
  await expect(call(fn, data)).rejects.toThrow("Record denied");
  expect(mocks.record).toHaveBeenCalledWith(client, "pipelines", action, "pipeline");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("pipeline update does not authorize creation", async () => {
  await expect(call(savePipeline, { name: "New", is_default: false, stages: [] })).rejects.toThrow(
    "Create denied",
  );
  expect(mocks.create).toHaveBeenCalledWith(client, "actor", "techhire.pipelines");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("default changes require workspace update even when the actual pipeline can be edited", async () => {
  mocks.record.mockResolvedValue(undefined);
  await expect(call(setDefaultPipeline, { id: "pipeline" })).rejects.toThrow("Permission denied");
  expect(mocks.permission).toHaveBeenCalledWith(client, "actor", "workspace", [
    "techhire.pipelines.update.workspace",
  ]);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("a permitted pipeline creation pins the selected workspace", async () => {
  mocks.create.mockResolvedValue("selected-workspace");
  const query = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "new" }, error: null }),
  };
  mocks.from.mockReturnValue(query);
  expect(await call(savePipeline, { name: "New", is_default: false, stages: [] })).toEqual({
    id: "new",
  });
  expect(query.insert).toHaveBeenCalledWith(
    expect.objectContaining({ workspace_id: "selected-workspace", owner_id: "actor" }),
  );
});
it("pipeline update with zero affected rows does not report success", async () => {
  mocks.record.mockResolvedValue(undefined);
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { is_default: false }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mocks.from.mockReturnValue(query);
  await expect(
    call(savePipeline, { id: "pipeline", name: "Edited", is_default: false, stages: [] }),
  ).rejects.toThrow("permissão para editar");
});

it("job constructor cannot implicitly promote a pipeline using only create permission", async () => {
  mocks.permission.mockResolvedValue(undefined);
  mocks.has.mockResolvedValue(false);
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "created", stages: [] }, error: null }),
  };
  mocks.from.mockReturnValue(query);
  expect(await call(getAtsDefaultPipeline, {})).toEqual({ id: "created", stages: [] });
  expect(query.insert).toHaveBeenCalledWith(
    expect.objectContaining({ workspace_id: "workspace", is_default: false }),
  );
});

it.each([
  ["jobs", "view", "job", listJobApplications, { jobId: "job" }],
  [
    "jobs",
    "view",
    "job",
    addApplication,
    { jobId: "job", candidateId: "candidate", source: "manual" },
  ],
  [
    "applications",
    "update",
    "application",
    moveApplication,
    { applicationId: "application", toStage: "screening" },
  ],
  ["applications", "view", "application", listApplicationEvents, { application_id: "application" }],
])(
  "candidature %s/%s is checked before reads or writes",
  async (resource, action, id, fn, data) => {
    await expect(call(fn, data)).rejects.toThrow("Record denied");
    expect(mocks.record).toHaveBeenCalledWith(client, resource, action, id);
    expect(mocks.from).not.toHaveBeenCalled();
  },
);
it("a visible job does not authorize associating a candidate without aggregate create", async () => {
  mocks.record
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Candidate create denied"));
  await expect(
    call(addApplication, { jobId: "job", candidateId: "candidate", source: "manual" }),
  ).rejects.toThrow("Candidate create denied");
  expect(mocks.record).toHaveBeenLastCalledWith(
    client,
    "candidate_applications",
    "create",
    "candidate",
  );
  expect(mocks.from).not.toHaveBeenCalled();
});

it.each([
  ["applications", "view", "app", listInterviews, { application_id: "app" }],
  ["application_interviews", "create", "app", scheduleInterview, { application_id: "app" }],
  ["application_interviews", "create", "app", createInterviewLink, { application_id: "app" }],
  ["application_interviews", "create", "app", createLegacyInterviewLink, { application_id: "app" }],
  ["interviews", "update", "interview", rescheduleInterview, { id: "interview" }],
  ["interviews", "update", "interview", cancelInterview, { id: "interview" }],
  ["interviews", "update", "interview", markInterviewStatus, { id: "interview" }],
  ["application_scores", "create", "app", submitScorecardResponse, { application_id: "app" }],
  [
    "scorecard_responses",
    "update",
    "response",
    submitScorecardResponse,
    { id: "response", application_id: "app" },
  ],
  [
    "interview_scoring",
    "update",
    "interview",
    generateInterviewNotes,
    { interview_id: "interview", transcript: "Private transcript" },
  ],
  ["interviews", "view", "interview", getInterviewWithNotes, { interview_id: "interview" }],
  ["jobs", "view", "job", listJobInterviews, { jobId: "job" }],
])(
  "interview/evaluation %s %s checks the actual record before queries or AI",
  async (resource, action, id, fn, data) => {
    await expect(call(fn, data)).rejects.toThrow("Record denied");
    expect(mocks.record).toHaveBeenCalledWith(client, resource, action, id);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  },
);
it("a score response cannot be rebound using an editable response id", async () => {
  mocks.record.mockResolvedValue(undefined);
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { application_id: "actual-app", scorecard_id: "actual-template" },
      error: null,
    }),
    update: vi.fn(),
  };
  mocks.from.mockReturnValue(q);
  await expect(
    call(submitScorecardResponse, {
      id: "response",
      application_id: "forged-app",
      scorecard_id: "actual-template",
    }),
  ).rejects.toThrow("outra candidatura");
  expect(q.update).not.toHaveBeenCalled();
});
it("editing an evaluation preserves its original author/evaluator and returns the stored score", async () => {
  mocks.record.mockResolvedValue(undefined);
  const response = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { application_id: "app", scorecard_id: "template" },
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { id: "response", total_score: 4.25 }, error: null }),
  };
  const template = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { criteria: [{ key: "tech", weight: 1 }] }, error: null }),
  };
  mocks.from.mockImplementation((table) =>
    table === "ats_scorecard_responses" ? response : template,
  );
  expect(
    await call(submitScorecardResponse, {
      id: "response",
      application_id: "app",
      scorecard_id: "template",
      scores: { tech: 3 },
    }),
  ).toEqual({ id: "response", total_score: 4.25 });
  const payload = response.update.mock.calls[0][0];
  expect(payload).not.toHaveProperty("owner_id");
  expect(payload).not.toHaveProperty("evaluator_id");
  expect(payload).not.toHaveProperty("application_id");
  expect(payload).not.toHaveProperty("scorecard_id");
});
it("a reschedule with no affected row never reports success or appends history", async () => {
  mocks.record.mockResolvedValue(undefined);
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { application_id: "app", job_id: "job", candidate_id: "candidate" },
      error: null,
    }),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mocks.from.mockReturnValue(q);
  await expect(
    call(rescheduleInterview, { id: "interview", scheduled_at: "2030-01-01T12:00:00Z" }),
  ).rejects.toThrow("não foi atualizada");
  expect(mocks.from).not.toHaveBeenCalledWith("ats_application_events");
});

it("AI notes use the authorized workspace provider and never report a completed interview", async () => {
  mocks.record.mockResolvedValue(undefined);
  mocks.emit.mockResolvedValue(undefined);
  mocks.ai.mockResolvedValue(
    new Response(
      JSON.stringify({
        model: "workspace-custom-model",
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Notes",
                strengths: [],
                concerns: [],
                followups: [],
                recommendation: "neutral",
                score: 80,
              }),
            },
          },
        ],
      }),
    ),
  );
  let editing = false;
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockImplementation(() => {
      editing = true;
      return q;
    }),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: editing
        ? { id: "interview" }
        : { id: "interview", interview_kit_id: null, job_id: null, candidate_id: "candidate" },
      error: null,
    })),
  };
  mocks.from.mockReturnValue(q);
  const result = await call(generateInterviewNotes, {
    interview_id: "interview",
    transcript: "A technical interview transcript with more than forty characters for testing.",
  });
  expect(result).toMatchObject({ ok: true, model: "workspace-custom-model" });
  expect(mocks.ai).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      workspaceId: "workspace",
      userId: "actor",
      feature: "anotacoes_entrevista",
      triggerSource: "user",
    }),
  );
  expect(q.update).toHaveBeenCalledWith(
    expect.objectContaining({ ai_model: "workspace-custom-model" }),
  );
  expect(mocks.emit).toHaveBeenCalledWith(
    client,
    expect.objectContaining({ name: "ats.interview.notes_generated" }),
  );
  expect(mocks.emit).not.toHaveBeenCalledWith(
    client,
    expect.objectContaining({ name: "ats.interview.completed" }),
  );
});
