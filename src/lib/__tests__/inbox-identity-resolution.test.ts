import { describe, expect, it } from "vitest";
import { chooseInboxIdentity, normalizeInboxPhone } from "@/lib/inbox/identity-resolution.server";

describe("inbox identity resolution", () => {
  it("normaliza números formatados", () => {
    expect(normalizeInboxPhone("+55 (74) 99999-0000")).toBe("5574999990000");
  });

  it("prioriza um contato único mesmo quando existe lead", () => {
    expect(chooseInboxIdentity(["contact-1"], ["lead-1"])).toEqual({
      status: "matched",
      contactId: "contact-1",
      leadId: null,
      matchedCount: 1,
    });
  });

  it("não escolhe automaticamente entre contatos duplicados", () => {
    expect(chooseInboxIdentity(["contact-1", "contact-2"], [])).toMatchObject({
      status: "ambiguous",
      contactId: null,
      leadId: null,
    });
  });

  it("usa lead apenas quando não há contato", () => {
    expect(chooseInboxIdentity([], ["lead-1"])).toMatchObject({
      status: "matched",
      contactId: null,
      leadId: "lead-1",
    });
  });
});
