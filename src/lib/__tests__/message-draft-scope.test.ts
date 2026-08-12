import { describe, expect, it } from "vitest";
import { draftScopeKey, draftContext, normalizeRecipient } from "@/lib/message-drafts/scope";

describe("draftScopeKey", () => {
  it("prioriza thread em respostas de e-mail", () => {
    expect(draftScopeKey({ channel: "email", threadId: "t1", leadId: "l1" })).toBe(
      "email:reply:t1",
    );
  });

  it("usa a entidade quando é composição nova", () => {
    expect(draftScopeKey({ channel: "email", leadId: "l1" })).toBe("email:new:lead:l1");
    expect(draftScopeKey({ channel: "email", dealId: "d1", contactId: "c1" })).toBe(
      "email:new:deal:d1",
    );
  });

  it("cai para o destinatário normalizado", () => {
    expect(draftScopeKey({ channel: "email", to: " Joao@Empresa.com " })).toBe(
      "email:new:to:joao@empresa.com",
    );
    expect(draftScopeKey({ channel: "email" })).toBe("email:new:to:novo");
  });

  it("usa a conversa no WhatsApp", () => {
    expect(draftScopeKey({ channel: "whatsapp", conversationId: "w1" })).toBe("whatsapp:w1");
    expect(draftScopeKey({ channel: "whatsapp", to: "+55 11 99999-0000" })).toBe(
      "whatsapp:+551199999-0000",
    );
  });
});

describe("draftContext", () => {
  it("mantém apenas os ids presentes", () => {
    expect(draftContext({ channel: "email", leadId: "l1", contactId: "c1" })).toEqual({
      lead_id: "l1",
      contact_id: "c1",
    });
  });
});

describe("normalizeRecipient", () => {
  it("normaliza espaços e caixa", () => {
    expect(normalizeRecipient(" A B@x.com ")).toBe("ab@x.com");
    expect(normalizeRecipient(null)).toBe("");
  });
});
