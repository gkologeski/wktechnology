import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/whatsapp/campaign-audience.server", () => ({ loadAudienceRows: mocks.load }));
import { prepareSequenceEnrollment } from "./enrollment.server";
import { newDefinition, newStep } from "./draft";
const W = crypto.randomUUID(),
  U = crypto.randomUUID(),
  V = crypto.randomUUID();
const input = () => ({
  workspaceId: W,
  versionId: V,
  requestId: crypto.randomUUID(),
  consentEvidence: "Autorização registrada pelo responsável.",
});
function fixture(failure?: string) {
  const rpc = vi.fn(async (name: string) => ({
    data: name === "sales_access_context" ? { workspace: W, actor: U, read_only: false } : true,
    error: failure ? { message: failure } : null,
  }));
  const definition = newDefinition();
  definition.steps = [
    {
      ...newStep("email"),
      accountId: U,
      subject: "Olá",
      body: "Podemos conversar?",
      thread: "new",
    } as never,
    newStep("end"),
  ];
  const q: any = {};
  for (const method of ["select", "eq"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: V, workspace_id: W, owner_id: U, definition }, error: null });
  const from = vi.fn(() => q),
    serviceRpc = vi
      .fn()
      .mockResolvedValue({ data: { id: "cohort", held: 1, blocked: 0 }, error: null });
  return {
    client: { rpc, from } as unknown as SupabaseClient,
    writer: { rpc: serviceRpc } as unknown as SupabaseClient,
    rpc,
    from,
    serviceRpc,
    definition,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ rows: [], truncated: false });
});
it("enrollment allows an authorized actor and resolves the frozen audience with caller RLS", async () => {
  const f = fixture(),
    data = input();
  await expect(prepareSequenceEnrollment(f.client, data, f.writer)).resolves.toMatchObject({
    id: "cohort",
  });
  expect(mocks.load).toHaveBeenCalledWith(
    f.client,
    W,
    { type: "filter", base: "contacts", groups: [], groups_logic: "or" },
    U,
  );
  expect(f.serviceRpc).toHaveBeenCalledWith("prospecting_sequence_cohort_prepare", {
    p_workspace: W,
    p_actor: U,
    p_version: V,
    p_request: data.requestId,
    p_consent: data.consentEvidence,
    p_candidates: [],
  });
  expect(f.rpc).toHaveBeenNthCalledWith(1, "sales_area_authorize", {
    r: "system.automation.sequences",
    a: "assign",
    t: null,
    i: null,
  });
});
it("enrollment rejects missing permission before source reads or privileged write", async () => {
  const f = fixture("missing permission");
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "missing permission",
  );
  expect(f.from).not.toHaveBeenCalled();
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
it("enrollment rejects explicit deny before privileged write", async () => {
  const f = fixture("explicit deny");
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "explicit deny",
  );
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
it("enrollment rejects foreign workspace before fetching recipients", async () => {
  const f = fixture();
  await expect(
    prepareSequenceEnrollment(f.client, { ...input(), workspaceId: crypto.randomUUID() }, f.writer),
  ).rejects.toThrow("Workspace indisponível");
  expect(mocks.load).not.toHaveBeenCalled();
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
it("enrollment rejects inactive membership before privileged write", async () => {
  const f = fixture("inactive member");
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "inactive member",
  );
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
it("enrollment refuses truncated audience instead of persisting a partial cohort", async () => {
  const f = fixture();
  mocks.load.mockResolvedValue({ rows: [], truncated: true });
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "nenhum lote parcial",
  );
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
it("enrollment fails closed on audience and exclusion source errors", async () => {
  const f = fixture();
  mocks.load.mockRejectedValueOnce(new Error("CRM read failed"));
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "CRM read failed",
  );
  expect(f.serviceRpc).not.toHaveBeenCalled();
  mocks.load.mockResolvedValue({ rows: [], truncated: false });
  f.serviceRpc.mockResolvedValue({ data: null, error: { message: "exclusion source failed" } });
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "exclusion source failed",
  );
});
it("enrollment rejects an incomplete version created outside the UI", async () => {
  const f = fixture();
  f.definition.steps = newDefinition().steps;
  await expect(prepareSequenceEnrollment(f.client, input(), f.writer)).rejects.toThrow(
    "Versão incompleta",
  );
  expect(mocks.load).not.toHaveBeenCalled();
  expect(f.serviceRpc).not.toHaveBeenCalled();
});
