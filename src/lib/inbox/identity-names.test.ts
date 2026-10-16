import { describe, expect, it } from "vitest";
import { conversationDisplayName, personName } from "./identity-names";

const contacts = new Map([["c1", "Kiver Silva"]]);
const leads = new Map([["l1", "Lead Teste"]]);

describe("nome exibido na Inbox", () => {
  it("prioriza contato", () => {
    expect(
      conversationDisplayName(
        { contact_id: "c1", lead_id: "l1", contact_phone: "+55" },
        contacts,
        leads,
      ),
    ).toBe("Kiver Silva");
  });
  it("usa lead sem contato", () => {
    expect(conversationDisplayName({ lead_id: "l1", contact_phone: "+55" }, contacts, leads)).toBe(
      "Lead Teste",
    );
  });
  it("cai para o telefone", () => {
    expect(conversationDisplayName({ contact_phone: "+554430553838" }, contacts, leads)).toBe(
      "+554430553838",
    );
  });
  it("monta nome ou e-mail", () => {
    expect(personName({ id: "x", first_name: "Ana", last_name: null })).toBe("Ana");
    expect(personName({ id: "x", email: "a@b.com" })).toBe("a@b.com");
  });
});
