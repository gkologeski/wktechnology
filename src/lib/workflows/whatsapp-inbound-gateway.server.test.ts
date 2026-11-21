import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ configured: vi.fn(), phone: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/whatsapp/gateway-channel.server", () => ({
  gatewayConfigured: state.configured,
  getConnectedPhone: state.phone,
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
import { refreshWorkflowWhatsAppGateway } from "./whatsapp-inbound-gateway.server";
const client = {} as NonNullable<Parameters<typeof refreshWorkflowWhatsAppGateway>[0]>;
beforeEach(() => {
  state.configured.mockReset().mockReturnValue(true);
  state.phone.mockReset().mockResolvedValue({
    id: "123456789012",
    display_phone_number: "+55 (48) 6137-0317",
    verified_name: "Fixture",
  });
  state.rpc.mockReset().mockResolvedValue(true);
});
it("attests only gateway-confirmed business identifiers without a caller-supplied workspace or credentials", async () => {
  expect(await refreshWorkflowWhatsAppGateway(client)).toBeNull();
  expect(state.phone).toHaveBeenCalledExactlyOnceWith();
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    client,
    "notification_whatsapp_gateway_observe",
    {
      p_phone: "123456789012",
      p_display: "+554861370317",
    },
  );
});
it("invalidates the previous gateway binding when the gateway is unconfigured", async () => {
  state.configured.mockReturnValue(false);
  state.rpc.mockResolvedValue(false);
  expect(await refreshWorkflowWhatsAppGateway(client)).toBe("lovable_unavailable");
  expect(state.phone).not.toHaveBeenCalled();
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    client,
    "notification_whatsapp_gateway_observe",
    {
      p_phone: null,
      p_display: null,
    },
  );
});
it("invalidates a failed or malformed provider response without returning provider errors", async () => {
  for (const response of [
    null,
    { id: "wrong", display_phone_number: "+554861370317" },
    { id: "123456789012", display_phone_number: "not a phone" },
    { id: "123456789012", display_phone_number: "+1234567890123456" },
    { id: "123456789012", display_phone_number: "+000000000" },
  ]) {
    state.phone.mockResolvedValue(response);
    state.rpc.mockClear().mockResolvedValue(false);
    expect(await refreshWorkflowWhatsAppGateway(client)).toBe("lovable_unavailable");
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      client,
      "notification_whatsapp_gateway_observe",
      {
        p_phone: null,
        p_display: null,
      },
    );
  }
  state.phone.mockRejectedValue(new Error("Private provider error must not be exposed"));
  expect(await refreshWorkflowWhatsAppGateway(client)).toBe("lovable_unavailable");
});
it("reports an unmapped or ambiguous gateway without inventing an account", async () => {
  state.rpc.mockResolvedValue(false);
  expect(await refreshWorkflowWhatsAppGateway(client)).toBe("lovable_unmapped");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("propagates binding storage failure instead of pretending that an unsafe binding was cleared", async () => {
  state.phone.mockRejectedValue(new Error("Provider unavailable"));
  state.rpc.mockRejectedValue(new Error("Private storage failed"));
  await expect(refreshWorkflowWhatsAppGateway(client)).rejects.toThrow("Private storage failed");
});
it("rejects malformed binding acknowledgements instead of treating them as confirmation", async () => {
  state.rpc.mockResolvedValue({ accepted: true });
  await expect(refreshWorkflowWhatsAppGateway(client)).rejects.toThrow();
});
