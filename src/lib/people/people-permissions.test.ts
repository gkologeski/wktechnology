import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  record: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  personRead: vi.fn(),
  candidateRead: vi.fn(),
  single: vi.fn(),
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
  assertHrCreate: mocks.create,
  assertHrRecordAccess: mocks.record,
}));
vi.mock("@/lib/access-control/enforce.server", () => ({
  getActiveWorkspaceId: async () => "active-workspace",
}));
vi.mock("@/lib/people/onboarding.functions", () => ({
  runAutoStart: vi.fn().mockResolvedValue({ status: "skipped_no_template" }),
}));
vi.mock("@/lib/phone/phone-boundary", () => ({
  workspacePhoneCountry: async () => "BR",
  humanPhoneForRow: async () => null,
  sourcePhone: (s: string) => s,
}));
import { archivePerson, promoteCandidateToPerson, upsertPerson } from "./people.functions";
const client = { from: mocks.from };
function call(fn: unknown, data: object) {
  return (fn as (args: object) => Promise<unknown>)({
    data,
    context: { supabase: client, userId: "actor" },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue("active-workspace");
  mocks.record.mockResolvedValue(undefined);
  mocks.personRead.mockResolvedValue({ data: null, error: null });
  mocks.single.mockResolvedValue({ data: { id: "new-person" }, error: null });
  mocks.candidateRead.mockResolvedValue({
    data: {
      owner_id: "candidate-author",
      full_name: "Candidate",
      email: null,
      phone: null,
      location: null,
      photo_url: null,
      current_position: "Engineer",
    },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      insert: (value: unknown) => {
        mocks.insert(table, value);
        return chain;
      },
      update: (value: unknown) => {
        mocks.update(table, value);
        return chain;
      },
      maybeSingle: table === "ats_candidates" ? mocks.candidateRead : mocks.personRead,
      single: mocks.single,
    };
    return chain;
  });
});
it("denies create before any person write when creation permission is absent", async () => {
  mocks.create.mockRejectedValue(new Error("Create denied"));
  await expect(call(upsertPerson, { full_name: "Person" })).rejects.toThrow("Create denied");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("uses record update authorization and reports zero affected rows as failure", async () => {
  await expect(
    call(upsertPerson, { id: "person", full_name: "Person", status: "active" }),
  ).rejects.toThrow("sem permissão para editar");
  expect(mocks.record).toHaveBeenCalledWith(client, "people", "update", "person");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("sets explicit tenant and actual actor as responsible on new person", async () => {
  await call(upsertPerson, { full_name: "Person", status: "active" });
  expect(mocks.insert).toHaveBeenCalledWith(
    "people",
    expect.objectContaining({
      workspace_id: "active-workspace",
      owner_id: "active-workspace",
      assigned_to: "actor",
      created_by: "actor",
    }),
  );
});
it("archive requires update and cannot succeed on a denied RLS update", async () => {
  await expect(call(archivePerson, { id: "person", archived: true })).rejects.toThrow(
    "sem permissão para arquivar",
  );
  expect(mocks.record).toHaveBeenCalledWith(client, "people", "update", "person");
});
it("promotion requires person creation before reading or writing candidate data", async () => {
  mocks.create.mockRejectedValue(new Error("Create denied"));
  await expect(call(promoteCandidateToPerson, { candidate_id: "candidate" })).rejects.toThrow(
    "Create denied",
  );
  expect(mocks.from).not.toHaveBeenCalled();
});
it("promotion requires candidate read access and does not adopt the candidate author's UUID as tenant", async () => {
  await call(promoteCandidateToPerson, { candidate_id: "candidate", employment_type: "pj" });
  expect(mocks.record).toHaveBeenCalledWith(client, "candidates", "view", "candidate");
  expect(mocks.insert).toHaveBeenCalledWith(
    "people",
    expect.objectContaining({
      candidate_id: "candidate",
      workspace_id: "active-workspace",
      owner_id: "active-workspace",
      assigned_to: "actor",
    }),
  );
});
