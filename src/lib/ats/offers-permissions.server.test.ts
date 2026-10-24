import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  event: vi.fn(),
  workspace: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const c = { middleware: () => c, inputValidator: () => c, handler: (f: unknown) => f };
    return c;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./audit.server", () => ({ recordAtsEvent: mocks.event }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.workspace }));
import {
  listOffers,
  reviewOffer,
  sendOffer,
  cancelOffer,
  createOffer,
  getOffer,
  getOfferLink,
  updateOffer,
} from "./offers.functions";
const call = (fn: unknown, data: unknown = {}) =>
  (fn as (args: unknown) => Promise<unknown>)({
    context: { userId: "actor", supabase: { rpc: mocks.rpc, from: mocks.from } },
    data,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue("workspace");
  mocks.event.mockResolvedValue({});
});
it("list returns only the database projection, never a raw salary or token SELECT", async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: "offer", salary_amount: null, body: null, can_view_terms: false }],
    error: null,
  });
  expect(await call(listOffers)).toEqual([
    { id: "offer", salary_amount: null, body: null, can_view_terms: false },
  ]);
  expect(mocks.from).not.toHaveBeenCalled();
});
for (const fn of [reviewOffer, sendOffer, cancelOffer, getOfferLink])
  it("denied RPC never emits approval or mutates signing tables", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "action denied" } });
    await expect(call(fn, { id: "offer", revision: 2, action: "approve" })).rejects.toThrow(
      "action denied",
    );
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
it("sending an approved offer does not emit an approval event", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  await call(sendOffer, { id: "offer", revision: 2 });
  expect(mocks.rpc).toHaveBeenCalledWith("ats_offer_transition", {
    _id: "offer",
    _action: "send",
    _revision: 2,
  });
  expect(mocks.event).not.toHaveBeenCalled();
});
it("approval event is emitted only after transaction success and includes the version", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  await call(reviewOffer, { id: "offer", revision: 3, action: "approve" });
  expect(mocks.event).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      name: "ats.offer.approved",
      dedupeKey: "ats.offer.approved:offer:3",
      payload: { offerId: "offer", revision: 3 },
    }),
  );
});
it("missing offer is not reported as successful retrieval", async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  await expect(call(getOffer, { id: "missing" })).rejects.toThrow("Oferta indisponível");
});
it("creation binds author and active workspace instead of a caller supplied tenant", async () => {
  const insert = vi.fn().mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: "offer" }, error: null }) }),
  });
  mocks.from.mockReturnValue({ insert });
  expect(await call(createOffer, { candidate_id: "candidate", title: "Offer" })).toEqual({
    id: "offer",
    revision: 1,
  });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ owner_id: "actor", workspace_id: "workspace", status: "draft" }),
  );
});
it("RLS-filtered update is a failure, not false success", async () => {
  mocks.from.mockReturnValue({
    update: () => ({
      eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
    }),
  });
  await expect(call(updateOffer, { id: "missing", patch: { title: "Changed" } })).rejects.toThrow(
    "sem permissão para editar",
  );
});
