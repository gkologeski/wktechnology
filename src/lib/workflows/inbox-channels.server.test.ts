import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ area: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/access-control/sales-core.server", () => ({ assertSalesArea: state.area }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
import { loadWorkflowInboxSources } from "./inbox-channels.server";

const W = "a1000000-0000-4000-8000-000000000001";
const B = "a1000000-0000-4000-8000-000000000002";
const A = "a2000000-0000-4000-8000-000000000001";
const client = {} as Parameters<typeof loadWorkflowInboxSources>[0];
beforeEach(() => {
  state.area.mockReset().mockResolvedValue(undefined);
  state.rpc.mockReset().mockResolvedValue({
    workspace_id: W,
    channel: "email",
    sources: [{ id: A, label: "Conta autorizada" }],
  });
});
it("returns only validated metadata after both workflow and selected channel authorization", async () => {
  await expect(loadWorkflowInboxSources(client, W, "email")).resolves.toEqual({
    workspace_id: W,
    channel: "email",
    sources: [{ id: A, label: "Conta autorizada" }],
  });
  expect(state.area.mock.calls).toEqual([
    [client, "system.workflows", "view"],
    [client, "techsales.inbox.email", "view"],
  ]);
  expect(state.rpc).toHaveBeenCalledWith(client, "workflow_inbox_sources", {
    p_workspace: W,
    p_channel: "email",
  });
});
it.each(["Sem chave", "Negação explícita", "Membro inativo"])(
  "does not query metadata when workflow authorization rejects: %s",
  async (reason) => {
    state.area.mockRejectedValueOnce(new Error(reason));
    await expect(loadWorkflowInboxSources(client, W, "email")).rejects.toThrow(reason);
    expect(state.rpc).not.toHaveBeenCalled();
  },
);
it("does not query metadata when selected channel access is denied", async () => {
  state.area.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Canal negado"));
  await expect(loadWorkflowInboxSources(client, W, "email")).rejects.toThrow("Canal negado");
  expect(state.rpc).not.toHaveBeenCalled();
});
it.each([
  { workspace_id: B, channel: "email", sources: [] },
  { workspace_id: W, channel: "linkedin", sources: [] },
])("rejects a response for another workspace or channel", async (response) => {
  state.rpc.mockResolvedValue(response);
  await expect(loadWorkflowInboxSources(client, W, "email")).rejects.toThrow("Origem fora");
});
it.each([
  { workspace_id: W, channel: "email", sources: [{ id: A, label: "Conta", token: "synthetic" }] },
  { workspace_id: W, channel: "email", sources: [], credentials: "synthetic" },
  { workspace_id: W, channel: "email", sources: [{ id: "not-an-id", label: "Conta" }] },
])("rejects malformed metadata or unexpected private fields", async (response) => {
  state.rpc.mockResolvedValue(response);
  await expect(loadWorkflowInboxSources(client, W, "email")).rejects.toThrow();
});
it("propagates RPC failure instead of treating it as an empty unrestricted selection", async () => {
  state.rpc.mockRejectedValue(new Error("Indisponível"));
  await expect(loadWorkflowInboxSources(client, W, "email")).rejects.toThrow("Indisponível");
});
