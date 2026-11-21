import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), area: vi.fn(), gateway: vi.fn() }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
vi.mock("@/lib/access-control/sales-core.server", () => ({ assertSalesArea: state.area }));
vi.mock("./whatsapp-inbound-gateway.server", () => ({
  refreshWorkflowWhatsAppGateway: state.gateway,
}));
import {
  loadWorkflowWhatsAppSources,
  recordWorkflowWhatsAppReceived,
} from "./whatsapp-inbound.server";

const W = "aaaaaaaa-1111-4111-8111-111111111111";
const B = "bbbbbbbb-1111-4111-8111-111111111111";
const M = "cccccccc-1111-4111-8111-111111111111";
const H = "dddddddd-1111-4111-8111-111111111111";
const client = {} as Parameters<typeof loadWorkflowWhatsAppSources>[0];
const metadata = () => ({
  workspace_id: W,
  sources: [
    {
      id: `cloud:${B}`,
      label: "Conta de teste",
      numbers: [{ id: "1234567890", label: "Número comercial", phone: "+554830121055" }],
    },
  ],
});
beforeEach(() => {
  state.rpc.mockReset();
  state.area.mockReset();
  state.gateway.mockReset().mockResolvedValue(null);
});

it("WhatsApp source metadata requires both real area gates and binds the active workspace", async () => {
  state.rpc.mockResolvedValue(metadata());
  await expect(loadWorkflowWhatsAppSources(client, W)).resolves.toEqual({
    ...metadata(),
    issues: [],
  });
  expect(state.area.mock.calls).toEqual([
    [client, "system.workflows", "view"],
    [client, "techsales.inbox.whatsapp", "view"],
  ]);
  expect(state.rpc).toHaveBeenCalledWith(client, "notification_whatsapp_sources", {
    p_workspace: W,
  });
});
it("WhatsApp source metadata refuses missing workflow permission before privileged metadata", async () => {
  state.area.mockRejectedValueOnce(new Error("Sem chave"));
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("Sem chave");
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.gateway).not.toHaveBeenCalled();
});
it("WhatsApp source metadata propagates explicit channel denial without returning an empty list", async () => {
  state.area.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Deny WhatsApp"));
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("Deny WhatsApp");
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.gateway).not.toHaveBeenCalled();
});
it("keeps confirmed Cloud metadata and reports an unavailable or unbound Lovable source without broadening it", async () => {
  state.rpc.mockResolvedValue(metadata());
  for (const issue of ["lovable_unavailable", "lovable_unmapped"]) {
    state.gateway.mockResolvedValue(issue);
    await expect(loadWorkflowWhatsAppSources(client, W)).resolves.toEqual({
      ...metadata(),
      issues: [issue],
    });
  }
});
it("does not claim usable sources when the private gateway binding cannot be refreshed safely", async () => {
  state.gateway.mockRejectedValue(new Error("Binding storage failed"));
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("Binding storage failed");
  expect(state.rpc).not.toHaveBeenCalled();
});
it("WhatsApp source metadata refuses a foreign workspace even from a successful RPC", async () => {
  state.rpc.mockResolvedValue({ ...metadata(), workspace_id: B });
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("workspace ativo");
});
it("WhatsApp source metadata propagates inactive membership refusal", async () => {
  state.rpc.mockRejectedValue(new Error("Membro inativo"));
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("Membro inativo");
});
it("WhatsApp source metadata rejects accidental secrets, duplicate source IDs and malformed results", async () => {
  state.rpc.mockResolvedValue({ ...metadata(), credentials: "must-never-cross" });
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow();
  const duplicate = metadata();
  duplicate.sources.push(duplicate.sources[0]);
  state.rpc.mockResolvedValue(duplicate);
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow("nova consulta");
  state.rpc.mockResolvedValue(null);
  await expect(loadWorkflowWhatsAppSources(client, W)).rejects.toThrow();
});
it("WhatsApp inbound producer passes only durable IDs and accepts idempotent suppression", async () => {
  state.rpc.mockResolvedValueOnce(M).mockResolvedValueOnce(null);
  await expect(recordWorkflowWhatsAppReceived(client, M, H)).resolves.toBe(M);
  await expect(recordWorkflowWhatsAppReceived(client, M, H)).resolves.toBeNull();
  expect(state.rpc).toHaveBeenCalledWith(client, "notification_whatsapp_received", {
    p_message: M,
    p_webhook: H,
  });
});
it("WhatsApp inbound producer does not hide storage errors or accept an invented producer result", async () => {
  state.rpc.mockRejectedValueOnce(new Error("storage failure"));
  await expect(recordWorkflowWhatsAppReceived(client, M, H)).rejects.toThrow("storage failure");
  state.rpc.mockResolvedValue({ accepted: true });
  await expect(recordWorkflowWhatsAppReceived(client, M, H)).rejects.toThrow();
});
