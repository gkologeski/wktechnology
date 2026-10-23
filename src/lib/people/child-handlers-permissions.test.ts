import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  child: vi.fn(),
  record: vi.fn(),
  create: vi.fn(),
  active: vi.fn(),
  from: vi.fn(),
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
  assertHrChildMutation: mocks.child,
  assertHrRecordAccess: mocks.record,
  assertHrCreate: mocks.create,
}));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.active }));
import {
  upsertGoal,
  deleteGoal,
  upsertOneOnOne,
  deleteOneOnOne,
  upsertReview,
  deleteReview,
} from "./performance.functions";
import {
  upsertPsychAssessment,
  deletePsychAssessment,
  upsertIncident,
  deleteIncident,
} from "./wellbeing.functions";
import { upsertPeopleBenefit, deletePeopleBenefit } from "./benefits.functions";
import {
  upsertPersonDocument,
  deletePersonDocument,
  createDocumentUpload,
  getDocumentDownloadUrl,
} from "./documents.functions";
import { upsertAllocation, deleteAllocation } from "./allocations.functions";
const client = { from: mocks.from };
const call = (fn: unknown, data: unknown) =>
  (fn as (x: unknown) => Promise<unknown>)({
    data,
    context: { supabase: client, userId: "actor" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.mockResolvedValue("selected-workspace");
  mocks.child.mockRejectedValue(new Error("Child denied"));
  mocks.record.mockRejectedValue(new Error("Row denied"));
});
it.each([
  ["goals", upsertGoal],
  ["one_on_ones", upsertOneOnOne],
  ["reviews", upsertReview],
  ["assessments", upsertPsychAssessment],
  ["incidents", upsertIncident],
  ["benefits", upsertPeopleBenefit],
  ["documents", upsertPersonDocument],
  ["allocations", upsertAllocation],
])("%s editing requires its actual resource before writes", async (resource, fn) => {
  await expect(call(fn, { id: "row", person_id: "person" })).rejects.toThrow("Child denied");
  expect(mocks.child).toHaveBeenCalledWith(client, resource, "row", "person");
  expect(mocks.from).not.toHaveBeenCalled();
});
it.each([
  ["goals", deleteGoal],
  ["one_on_ones", deleteOneOnOne],
  ["reviews", deleteReview],
  ["assessments", deletePsychAssessment],
  ["incidents", deleteIncident],
  ["benefits", deletePeopleBenefit],
  ["documents", deletePersonDocument],
  ["allocations", deleteAllocation],
])("%s deletion requires delete, never update or parent edit", async (resource, fn) => {
  await expect(call(fn, { id: "row" })).rejects.toThrow("Row denied");
  expect(mocks.record).toHaveBeenCalledWith(client, resource, "delete", "row");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("document upload authorization occurs before elevated signing", async () => {
  await expect(
    call(createDocumentUpload, { person_id: "person", file_name: "test.pdf" }),
  ).rejects.toThrow("Row denied");
  expect(mocks.record).toHaveBeenCalledWith(client, "person_documents", "create", "person");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("document download checks the document row, not membership alone", async () => {
  await expect(call(getDocumentDownloadUrl, { id: "document" })).rejects.toThrow("Row denied");
  expect(mocks.record).toHaveBeenCalledWith(client, "documents", "view", "document");
  expect(mocks.from).not.toHaveBeenCalled();
});

it("replacing an existing document file requires update rather than create", async () => {
  await expect(
    call(createDocumentUpload, {
      person_id: "person",
      document_id: "document",
      file_name: "test.pdf",
    }),
  ).rejects.toThrow("Row denied");
  expect(mocks.record).toHaveBeenCalledWith(client, "documents", "update", "document");
  expect(mocks.from).not.toHaveBeenCalled();
});
