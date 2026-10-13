import { describe, expect, it } from "vitest";
import { buildDeliveryMeta, providerStatusLabel } from "./delivery-meta";

describe("buildDeliveryMeta", () => {
  it("grava execução, fluxo, canal e status do provedor", () => {
    const m = buildDeliveryMeta(
      { workflowId: "wf1", runId: "run1" },
      { channel: "whatsapp", provider: "meta", provider_status: "accepted", provider_id: "wamid.1" },
    );
    expect(m).toEqual({
      channel: "whatsapp",
      workflow_id: "wf1",
      run_id: "run1",
      provider: "meta",
      provider_status: "accepted",
      provider_id: "wamid.1",
      agent_id: null,
      agent_version_id: null,
    });
  });
  it("e-mail só na fila interna não finge provedor", () => {
    const m = buildDeliveryMeta({}, { channel: "email", provider_status: "queued_local" });
    expect(m.provider).toBeNull();
    expect(providerStatusLabel(m.provider_status)).toBe("Na fila interna (não enviada)");
  });
});
