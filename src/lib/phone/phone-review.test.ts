import { describe, expect, it } from "vitest";
import {
  phoneEntityName,
  phoneEntityRoute,
  phoneReviewDetail,
  summarizePhoneRun,
} from "./phone-review";

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

describe("summarizePhoneRun com correções posteriores", () => {
  it("tira da revisão o que foi apagado (até 4 dígitos) e soma o que foi padronizado depois", () => {
    const s = summarizePhoneRun(
      { "contacts.mobile_phone": { too_short: 10, invalid: 5, safe_explicit: 3 } },
      { "contacts.mobile_phone": 3 },
      { "contacts.mobile_phone": { blank_short: 9, safe_record_country: 2 } },
    );
    expect(s.rows[0]).toMatchObject({ blanked: 9, applied: 5, pending: 4 });
    expect(s.pending).toBe(4);
  });
});

describe("phoneReviewDetail", () => {
  it("celular antigo sem 9: candidato mascarado, sem o número inteiro", () => {
    const d = phoneReviewDetail("(51) 9301-6927");
    expect(d).toMatch(/sem o 9º dígito/);
    expect(d).not.toContain("93016927");
  });
  it("sem país: leitura como Brasil é só hipótese", () => {
    expect(phoneReviewDetail("11 3333-4444")).toMatch(/hipótese/);
  });
  it("valor válido não tem detalhe", () => {
    expect(phoneReviewDetail("+551133334444")).toBeNull();
  });
});
