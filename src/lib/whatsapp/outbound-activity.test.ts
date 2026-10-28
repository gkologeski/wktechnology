import { describe, expect, it } from "vitest";
import { buildOutboundWhatsAppActivity } from "./outbound-activity";

const base = {
  workspaceId: "184b9435-0a9b-4334-9e89-8854dc883f5d",
  userId: "1c237fbe-079e-4eb9-a3e6-c08d85e79688",
  contactId: "228102c8-d51e-4b69-87f5-c812bfdb262b",
  conversationId: "185aba04-4a92-49b0-b25d-f787be91b0b0",
  wamid: "wamid.X",
  body: "Olá",
  preview: "Olá",
};

describe("buildOutboundWhatsAppActivity", () => {
  it("usa quem enviou como autor, nunca o workspace", () => {
    const row = buildOutboundWhatsAppActivity(base);
    expect(row.owner_id).toBe(base.userId);
    expect(row.owner_id).not.toBe(base.workspaceId);
  });

  it("usa quem enviou como responsável, nunca o workspace", () => {
    const row = buildOutboundWhatsAppActivity(base);
    expect(row.assigned_to).toBe(base.userId);
    expect(row.assigned_to).not.toBe(base.workspaceId);
  });

  it("mantém o workspace como isolamento do registro", () => {
    expect(buildOutboundWhatsAppActivity(base).workspace_id).toBe(base.workspaceId);
  });
});
