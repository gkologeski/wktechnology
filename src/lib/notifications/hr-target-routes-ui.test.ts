// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  P = "bbbbbbbb-1111-4111-8111-111111111111",
  N = "cccccccc-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  parent: true,
  docs: true,
  interviews: true,
  search: {} as Record<string, unknown>,
  application: vi.fn(),
  interview: vi.fn(),
  document: vi.fn(),
  person: vi.fn(),
  listDocs: vi.fn(),
  job: vi.fn(),
  mutation: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => state.search,
    useParams: () => ({ id: "bbbbbbbb-1111-4111-8111-111111111111" }),
    useNavigate: () => vi.fn(),
  }),
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: false,
    permissions: new Set(state.docs ? ["techpeople.documents.view.workspace"] : []),
    can: (key: string) =>
      state.view && (!key.startsWith("techhire.interviews") || state.interviews),
    canAny: (keys: string[]) =>
      state.view && keys.some((key) => !key.startsWith("techpeople.documents") || state.docs),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({
  useHrCapabilities: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    for: () => ({
      can_view: state.parent,
      can_update: false,
      can_delete: false,
      can_create_child: false,
    }),
  }),
}));
vi.mock("@/lib/notifications/hr-targets.functions", () => ({
  getNotificationApplicationTarget: (input: unknown) => state.application(input),
  getNotificationInterviewTarget: (input: unknown) => state.interview(input),
  getNotificationDocumentTarget: (input: unknown) => state.document(input),
}));
vi.mock("@/lib/ats/ats.functions", () => ({
  getAtsJob: () => state.job(),
  listJobApplications: async () => [],
  listAtsCandidates: async () => [],
  listJobEvents: async () => [],
  listJobInterviews: async () => [],
  moveApplication: state.mutation,
  addApplication: state.mutation,
  saveAtsJob: state.mutation,
}));
vi.mock("@/lib/ats/pipelines.functions", () => ({ listAtsPipelines: async () => [] }));
vi.mock("@/lib/ats/scorecards.functions", () => ({ listJobScorecardSummary: async () => ({}) }));
vi.mock("@/lib/ats/export.functions", () => ({ exportJobApplicationsCsv: state.mutation }));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({ data: [], nameFor: () => "Membro", initialsFor: () => "M" }),
}));
vi.mock("@/components/entity/assignee-filter", () => ({
  ASSIGNEE_ALL: "all",
  useAssigneeFilter: () => ({
    assignee: "all",
    setAssignee: vi.fn(),
    filterRows: (rows: unknown[]) => rows,
    isActive: false,
  }),
}));
vi.mock("@/components/record/record-layout", () => ({
  RecordLayout: ({ header, center }: { header: ReactNode; center: ReactNode }) =>
    createElement("main", null, header, center),
}));
vi.mock("@/components/ats/jobs/job-detail-header", () => ({
  JobDetailHeader: () => createElement("h1", null, "Vaga demonstrativa"),
}));
vi.mock("@/components/ats/jobs/job-properties-panel", () => ({ JobPropertiesPanel: () => null }));
vi.mock("@/components/ats/jobs/job-applications-table", () => ({
  JobApplicationsTable: () => null,
}));
vi.mock("@/components/ats/jobs/job-pipeline-board", () => ({ JobPipelineBoard: () => null }));
vi.mock("@/components/ats/jobs/job-eval-dialog", () => ({ JobEvalDialog: () => null }));
vi.mock("@/components/ats/jobs/hiring-outcome-dialog", () => ({ HiringOutcomeDialog: () => null }));
vi.mock("@/components/ats/schedule-interview-dialog", () => ({
  ScheduleInterviewDialog: () => null,
}));
vi.mock("@/components/ats/job-postings-panel", () => ({ JobPostingsPanel: () => null }));
vi.mock("@/components/ats/linkedin-job-config-panel", () => ({
  LinkedinJobConfigPanel: () => null,
}));
vi.mock("@/components/ats/job-copilot-panel", () => ({ JobCopilotPanel: () => null }));
vi.mock("@/components/hiring/hiring-demand-panel", () => ({ HiringDemandPanel: () => null }));
vi.mock("@/components/hiring/employment-panel", () => ({ EmploymentPanel: () => null }));
vi.mock("@/lib/people/people.functions", () => ({
  getPerson: () => state.person(),
  upsertPerson: state.mutation,
  PEOPLE_STATUSES: ["active"],
  PEOPLE_STATUS_LABELS: { active: "Ativa" },
  PEOPLE_EMPLOYMENT_TYPES: ["pj"],
  PEOPLE_EMPLOYMENT_LABELS: { pj: "PJ" },
}));
vi.mock("@/lib/people/person-cnpj-lookup.functions", () => ({
  lookupCnpjForPerson: vi.fn(),
}));
vi.mock("@/lib/people/documents.functions", () => ({
  listPersonDocuments: (input: unknown) => state.listDocs(input),
  listPersonTimeline: async () => [],
  deletePersonDocument: state.mutation,
  getDocumentDownloadUrl: state.download,
  upsertPersonDocument: state.mutation,
  createDocumentUpload: state.mutation,
}));
vi.mock("@/components/people/person-role-picker", () => ({ PersonRolePicker: () => null }));
vi.mock("@/components/people/goals-panel", () => ({ GoalsPanel: () => null }));
vi.mock("@/components/people/one-on-ones-panel", () => ({ OneOnOnesPanel: () => null }));
vi.mock("@/components/people/reviews-panel", () => ({ ReviewsPanel: () => null }));
vi.mock("@/components/people/psychosocial-panel", () => ({ PsychosocialPanel: () => null }));
vi.mock("@/components/people/incidents-panel", () => ({ IncidentsPanel: () => null }));
vi.mock("@/components/people/allocations-panel", () => ({ AllocationsPanel: () => null }));
vi.mock("@/components/people/timesheet-panel", () => ({ TimesheetPanel: () => null }));
vi.mock("@/components/people/onboarding-panel", () => ({ OnboardingPanel: () => null }));
vi.mock("@/components/people/offboarding-compliance-panel", () => ({
  OffboardingCompliancePanel: () => null,
}));
vi.mock("@/components/people/benefits-panel", () => ({ BenefitsPanel: () => null }));
vi.mock("@/components/files/file-center-picker", () => ({ FileCenterPickerDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "fixture",
  endAuditSession: () => {},
  touchAuditSession: () => {},
}));
import { Route as JobRoute } from "@/routes/_authenticated/(ats)/jobs.$id";
import { Route as PersonRoute } from "@/routes/_authenticated/people.$id";
type TestRoute = {
  options: {
    component: ComponentType;
    validateSearch: (input: Record<string, unknown>) => Record<string, unknown>;
  };
};
const jobPage = JobRoute as unknown as TestRoute,
  personPage = PersonRoute as unknown as TestRoute;
const doc = {
  id: N,
  person_id: P,
  doc_type: "Documento demonstrativo",
  doc_number: "PRIVATE_DOCUMENT_NUMBER",
  expires_at: "2026-12-15",
  issued_at: null,
  file_url: "PRIVATE_FILE_PATH",
  file_name: "demonstrativo.pdf",
  status: "valid",
  is_sensitive: true,
  notes: null,
};
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.assign(state, {
    userId: "user-a",
    workspaceId: W,
    view: true,
    parent: true,
    docs: true,
    interviews: true,
    search: {},
  });
  state.application.mockReset().mockResolvedValue({
    id: N,
    job_id: P,
    candidate_id: N,
    stage_value: "applied",
    status: "active",
    applied_at: "2026-11-20T12:00:00Z",
  });
  state.interview.mockReset().mockResolvedValue({
    id: N,
    job_id: P,
    status: "scheduled",
    scheduled_at: "2026-12-15T12:00:00Z",
    kind: "video",
    duration_min: 45,
  });
  state.document.mockReset().mockResolvedValue({
    id: N,
    person_id: P,
    doc_type: doc.doc_type,
    expires_at: doc.expires_at,
    status: "valid",
  });
  state.person.mockReset().mockResolvedValue({
    id: P,
    full_name: "Pessoa demonstrativa",
    status: "active",
    employment_type: "pj",
    can_view_sensitive: false,
    can_update_sensitive: false,
    tags: [],
  });
  state.listDocs.mockReset().mockResolvedValue([doc]);
  state.job.mockReset().mockResolvedValue({
    id: P,
    title: "Vaga demonstrativa",
    status: "published",
    pipeline_id: null,
  });
  state.mutation.mockReset();
  state.download.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(page: TestRoute) {
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(page.options.component)),
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
function direct(page: TestRoute, path: string) {
  state.search = page.options.validateSearch(
    Object.fromEntries(new URL(path, "https://local.invalid").searchParams),
  );
}
it("opens the exact application independently of the current pipeline list without moving or hiring", async () => {
  direct(jobPage, `/jobs/${P}?tab=pipeline&applicationId=${N}`);
  await render(jobPage);
  expect(state.application).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: W, parentId: P, id: N },
  });
  expect(host.querySelector('[aria-label="Candidatura do aviso"]')?.textContent).toContain(
    "Candidatura exata localizada",
  );
  expect(state.mutation).not.toHaveBeenCalled();
});
it("honors the interviews tab and looks up an interview beyond the loaded list without scheduling", async () => {
  direct(jobPage, `/jobs/${P}?tab=interviews&interviewId=${N}`);
  await render(jobPage);
  expect(host.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain(
    "Entrevistas",
  );
  expect(state.interview).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: W, parentId: P, id: N },
  });
  expect(host.querySelector('[aria-label="Entrevista do aviso"]')?.textContent).toContain(
    "Agendada",
  );
  expect(state.mutation).not.toHaveBeenCalled();
});
it("opens Documents and highlights the exact authorized document without opening or downloading the file", async () => {
  direct(personPage, `/people/${P}?tab=documents&documentId=${N}`);
  await render(personPage);
  expect(host.querySelector('[role="tab"][data-state="active"]')?.textContent).toBe("Documentos");
  expect(state.document).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: W, parentId: P, id: N },
  });
  expect(host.querySelector('[aria-label="Documento do aviso"]')?.textContent).toContain(
    "15/12/2026",
  );
  expect(host.querySelector('div[aria-current="true"].p-4')?.textContent).toContain(
    "Documento do aviso",
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(state.download).not.toHaveBeenCalled();
  expect(state.mutation).not.toHaveBeenCalled();
});
it("does not query a document without its own permission even when the person is readable", async () => {
  state.docs = false;
  direct(personPage, `/people/${P}?tab=documents&documentId=${N}`);
  await render(personPage);
  expect(state.document).not.toHaveBeenCalled();
  expect(state.listDocs).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain(doc.doc_type);
  expect(host.textContent).not.toContain(doc.doc_number);
  expect(host.textContent).toContain("não tem permissão para consultar a aba");
});
it("does not query an interview without the existing interview permission", async () => {
  state.interviews = false;
  direct(jobPage, `/jobs/${P}?tab=interviews&interviewId=${N}`);
  await render(jobPage);
  expect(state.interview).not.toHaveBeenCalled();
  expect(host.textContent).toContain("não tem permissão para visualizar entrevistas");
});
it.each([jobPage, personPage])(
  "does not mount target readers when the parent record or workspace is denied",
  async (page) => {
    state.parent = false;
    direct(
      page,
      `/${page === jobPage ? "jobs" : "people"}/${P}?tab=documents&documentId=${N}&applicationId=${N}`,
    );
    await render(page);
    expect(state.application).not.toHaveBeenCalled();
    expect(state.document).not.toHaveBeenCalled();
    state.parent = true;
    state.workspaceId = null;
    await render(page);
    expect(state.application).not.toHaveBeenCalled();
    expect(state.document).not.toHaveBeenCalled();
  },
);
it("does not display a cached document during a fresh lookup or after lookup failure", async () => {
  direct(personPage, `/people/${P}?tab=documents&documentId=${N}`);
  client.setQueryData(["hr-notification-target", "user-a", W, "document", P, N], doc);
  let reject!: (cause: Error) => void;
  state.document.mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  await render(personPage);
  expect(host.textContent).not.toContain(doc.doc_type);
  await act(async () => reject(new Error("Documento indisponível")));
  await render(personPage);
  expect(host.textContent).not.toContain(doc.doc_type);
  expect(host.textContent).not.toContain(doc.doc_number);
  expect(state.download).not.toHaveBeenCalled();
});
it("discards the old document when user/workspace changes and ignores the old pending response", async () => {
  direct(personPage, `/people/${P}?tab=documents&documentId=${N}`);
  let finish!: (value: unknown) => void;
  state.document.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render(personPage);
  state.userId = "user-b";
  state.workspaceId = "dddddddd-1111-4111-8111-111111111111";
  state.document.mockRejectedValue(new Error("Sem acesso"));
  await render(personPage);
  await act(async () => finish(doc));
  await render(personPage);
  expect(host.textContent).not.toContain(doc.doc_type);
  expect(host.textContent).not.toContain(doc.doc_number);
  expect(state.download).not.toHaveBeenCalled();
});
it("rejects malformed target IDs and unknown tabs", () => {
  expect(
    jobPage.options.validateSearch({
      tab: "unknown",
      applicationId: "invalid",
      interviewId: "invalid",
    }),
  ).toEqual({ tab: "pipeline", applicationId: undefined, interviewId: undefined });
  expect(personPage.options.validateSearch({ tab: "unknown", documentId: "invalid" })).toEqual({
    tab: "profile",
    documentId: undefined,
  });
});
