import { describe, expect, it } from "vitest";
import { phoneEntityName, phoneEntityRoute } from "./phone-review";

describe("phoneEntityName", () => {
  it("usa nome e sobrenome de contato/lead", () => {
    expect(phoneEntityName({ first_name: "Paulo", last_name: "Fontes", email: "p@x.com" })).toBe(
      "Paulo Fontes",
    );
  });
  it("usa o nome da empresa", () => {
    expect(phoneEntityName({ name: "WK Technology" })).toBe("WK Technology");
  });
  it("cai para o e-mail quando não há nome", () => {
    expect(phoneEntityName({ first_name: " ", last_name: null, email: "a@b.com" })).toBe("a@b.com");
  });
  it("retorna nulo sem nome nem e-mail", () => {
    expect(phoneEntityName({ full_name: "" })).toBeNull();
  });
});

describe("phoneEntityRoute", () => {
  it("abre a ficha de contato, lead, empresa, pessoa e candidato", () => {
    expect(phoneEntityRoute("contacts")).toBe("/contacts/$id");
    expect(phoneEntityRoute("leads")).toBe("/leads/$id");
    expect(phoneEntityRoute("companies")).toBe("/companies/$id");
    expect(phoneEntityRoute("people")).toBe("/people/$id");
    expect(phoneEntityRoute("ats_candidates")).toBe("/candidates/$id");
  });
  it("não cria link para tabelas sem ficha", () => {
    expect(phoneEntityRoute("profiles")).toBeNull();
    expect(phoneEntityRoute("bookings")).toBeNull();
  });
});
