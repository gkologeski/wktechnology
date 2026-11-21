import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof parse) => {
        parse = fn;
        return builder;
      },
      handler: (fn: (input: unknown) => unknown) => (input: { data: unknown }) =>
        fn({ ...input, data: parse(input.data) }),
    };
    return builder;
  },
}));
vi.mock("@/lib/access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
vi.mock("@/lib/access-control/enforce.server", () => ({ assertAnyPermission: mocks.permission }));
import {
  getNotificationApplicationTarget,
  getNotificationInterviewTarget,
  getNotificationDocumentTarget,
} from "./hr-targets.functions";

const W = "aaaaaaaa-1111-4111-8111-111111111111",
  P = "bbbbbbbb-1111-4111-8111-111111111111",
  N = "cccccccc-1111-4111-8111-111111111111",
  U = "dddddddd-1111-4111-8111-111111111111",
  OTHER = "eeeeeeee-1111-4111-8111-111111111111";
const readers = [
  {
    label: "application",
    fn: getNotificationApplicationTarget,
    table: "ats_applications",
    parent: "jobs",
    child: "applications",
    foreign: "job_id",
  },
  {
    label: "interview",
    fn: getNotificationInterviewTarget,
    table: "ats_interviews",
    parent: "jobs",
    child: "interviews",
    foreign: "job_id",
  },
  {
    label: "document",
    fn: getNotificationDocumentTarget,
    table: "people_documents",
    parent: "people",
    child: "documents",
    foreign: "person_id",
  },
] as const;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue(undefined);
});
function fixture(
  reader: (typeof readers)[number],
  {
    grant = true,
    deny = false,
    active = true,
    parentAllowed = true,
    rowWorkspace = W,
    rowParent = P,
    error = null as { message: string } | null,
  } = {},
) {
  const filters: Record<string, unknown> = {};
  let columns: string[] = [];
  const raw: Record<string, unknown> = {
    id: N,
    workspace_id: rowWorkspace,
    [reader.foreign]: rowParent,
    candidate_id: U,
    application_id: N,
    stage_value: "applied",
    status: "scheduled",
    applied_at: "2026-11-20T12:00:00Z",
    scheduled_at: "2026-12-15T12:00:00Z",
    kind: "video",
    duration_min: 45,
    doc_type: "Documento fictício",
    expires_at: "2026-12-15",
    salary_amount: "PRIVATE_SALARY_CANARY",
    notes: "PRIVATE_NOTE_CANARY",
    file_url: "PRIVATE_FILE_CANARY",
    meet_url: "PRIVATE_MEETING_CANARY",
    self_schedule_token: "PRIVATE_TOKEN_CANARY",
    cv_url: "PRIVATE_CV_CANARY",
  };
  const query = {
    select: vi.fn((selected: string) => {
      columns = selected.split(",").map((value) => value.trim());
      return query;
    }),
    eq: vi.fn((key: string, value: unknown) => {
      filters[key] = value;
      return query;
    }),
    maybeSingle: vi.fn(async () => ({
      data:
        !error &&
        filters.id === N &&
        filters.workspace_id === rowWorkspace &&
        filters[reader.foreign] === rowParent
          ? Object.fromEntries(columns.map((column) => [column, raw[column]]))
          : null,
      error,
    })),
  };
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(async (_name: string, args: { _resource: string }) => ({
      data: args._resource === reader.parent ? parentAllowed : grant && !deny,
      error: null,
    })),
  };
  const invoke = (data: unknown = { workspaceId: W, parentId: P, id: N }) =>
    (reader.fn as unknown as (args: unknown) => Promise<unknown>)({
      data,
      context: { userId: U, activeWorkspaceId: active ? W : undefined, supabase: client },
    });
  return { invoke, client, query };
}
it.each(readers)(
  "reads the exact authorized $label through the user client and explicit workspace/parent/ID",
  async (reader) => {
    const f = fixture(reader);
    await expect(f.invoke()).resolves.toMatchObject({ id: N, [reader.foreign]: P });
    expect(f.client.from).toHaveBeenCalledExactlyOnceWith(reader.table);
    expect(f.query.eq.mock.calls).toEqual([
      ["workspace_id", W],
      [reader.foreign, P],
      ["id", N],
    ]);
    expect(f.client.rpc).toHaveBeenCalledWith("hr_record_access", {
      _resource: reader.child,
      _action: "view",
      _id: N,
    });
  },
);
for (const reader of readers) {
  it(`${reader.label}: refuses a denied parent before reading the child or querying`, async () => {
    const f = fixture(reader, { parentAllowed: false });
    await expect(f.invoke()).rejects.toThrow("sem permissão");
    expect(f.client.from).not.toHaveBeenCalled();
    expect(f.client.rpc).toHaveBeenCalledTimes(1);
  });
  it(`${reader.label}: propagates canonical child access refusal before querying`, async () => {
    const f = fixture(reader, { grant: false });
    await expect(f.invoke()).rejects.toThrow("sem permissão");
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it(`${reader.label}: propagates an explicit canonical denial without querying`, async () => {
    const f = fixture(reader, { grant: true, deny: true });
    await expect(f.invoke()).rejects.toThrow("sem permissão");
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it(`${reader.label}: rejects a requested workspace different from the authenticated active context`, async () => {
    const f = fixture(reader);
    await expect(f.invoke({ workspaceId: OTHER, parentId: P, id: N })).rejects.toThrow();
    expect(f.client.from).not.toHaveBeenCalled();
    expect(f.client.rpc).not.toHaveBeenCalled();
  });
  it(`${reader.label}: rejects a missing active context without exposing a cached record`, async () => {
    const f = fixture(reader, { active: false });
    await expect(f.invoke()).rejects.toThrow();
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it(`${reader.label}: never returns a child from another workspace or parent`, async () => {
    for (const scope of [{ rowWorkspace: OTHER }, { rowParent: OTHER }]) {
      const f = fixture(reader, scope);
      await expect(f.invoke()).resolves.toBeNull();
    }
  });
  it(`${reader.label}: returns no salary, notes, CV, file URL, meeting URL or public token`, async () => {
    const f = fixture(reader);
    const result = JSON.stringify(await f.invoke());
    expect(result).not.toMatch(/PRIVATE_|salary|notes|cv_url|file_url|meet_url|token/);
  });
  it(`${reader.label}: propagates lookup failure instead of returning another record`, async () => {
    const f = fixture(reader, { error: { message: "Consulta indisponível" } });
    await expect(f.invoke()).rejects.toThrow("Consulta indisponível");
    expect(f.client.from).toHaveBeenCalledTimes(1);
  });
  it(`${reader.label}: rejects malformed IDs and client-supplied identity before querying`, async () => {
    const f = fixture(reader);
    for (const data of [
      { workspaceId: W, parentId: P, id: "invalid" },
      { workspaceId: W, parentId: P, id: N, userId: OTHER },
    ])
      await expect(async () => f.invoke(data)).rejects.toThrow();
    expect(f.client.from).not.toHaveBeenCalled();
  });
}
it("keeps the existing workspace-level interview view gate in addition to actual parent/child access", async () => {
  const reader = readers[1],
    f = fixture(reader);
  mocks.permission.mockRejectedValueOnce(new Error("Sem permissão de entrevistas"));
  await expect(f.invoke()).rejects.toThrow("Sem permissão de entrevistas");
  expect(mocks.permission).toHaveBeenCalledWith(f.client, U, W, [
    "techhire.interviews.view.workspace",
  ]);
  expect(f.client.from).not.toHaveBeenCalled();
});
