import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { buildRawMime } from "./gmail.server";
const base = {
  from: "agent@example.com",
  to: ["client@example.com"],
  subject: "Atendimento",
  bodyText: "Olá",
};
describe("agent MIME boundary", () => {
  it("preserves deterministic delivery proof and reply chain, marks automated messages", () => {
    const mime = buildRawMime({
      ...base,
      messageId: "<job-1@example.com>",
      inReplyTo: "<inbound@example.org>",
      autoSubmitted: true,
    });
    expect(mime).toContain("Message-ID: <job-1@example.com>");
    expect(mime).toContain("In-Reply-To: <inbound@example.org>");
    expect(mime).toContain("Auto-Submitted: auto-generated");
  });
  it.each(["subject", "from", "fromName", "inReplyTo", "references", "messageId"])(
    "rejects header injection through %s",
    (field) => {
      expect(() => buildRawMime({ ...base, [field]: "bad\r\nBcc: other@example.org" })).toThrow();
    },
  );
  it("rejects recipient and attachment header injection", () => {
    expect(() =>
      buildRawMime({ ...base, to: ["client@example.com\nBcc: other@example.org"] }),
    ).toThrow();
    expect(() =>
      buildRawMime({
        ...base,
        attachments: [
          {
            filename: "file.pdf\r\nBcc: other@example.org",
            contentType: "application/pdf",
            data: Buffer.from("x"),
          },
        ],
      }),
    ).toThrow();
  });
  it("rejects malformed message identifiers", () => {
    expect(() => buildRawMime({ ...base, messageId: "not-a-message-id" })).toThrow();
  });
});
