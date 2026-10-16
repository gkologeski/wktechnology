import { describe, expect, it } from "vitest";
import {
  buildBrPhoneVariants,
  chooseInboxIdentity,
  normalizeInboxPhone,
} from "@/lib/inbox/identity-resolution.server";

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

  it("gera variantes com/sem 9º dígito e DDI para celular", () => {
    const v = buildBrPhoneVariants("5511987654321");
    for (const x of ["5511987654321", "551187654321", "11987654321", "1187654321"]) {
      expect(v).toContain(x);
    }
    const v2 = buildBrPhoneVariants("(11) 8765-4321");
    expect(v2).toContain("5511987654321");
  });

  it("não adiciona 9 em telefone fixo", () => {
    const v = buildBrPhoneVariants("551133334444");
    expect(v).toContain("1133334444");
    expect(v).not.toContain("11933334444");
  });

  it("mantém números internacionais como busca exata", () => {
    expect(buildBrPhoneVariants("+44 20 7946 0958")).toEqual(["442079460958"]);
  });
});

import {
  buildBrPhoneVariants as variantsE164,
  normalizeInboxPhone as normPhone,
  parseRecipientSource,
} from "@/lib/inbox/identity-resolution.server";

describe("associação por telefone após disparo", () => {
  it("encontra com e sem o 9º dígito", () => {
    const v = variantsE164("+552194025475");
    expect(v).toContain("5521994025475");
    expect(v).toContain("21994025475");
    expect(v).toContain("2194025475");
  });
  it("aceita formatos sujos e código de operadora", () => {
    expect(variantsE164("+55-51-99301-6927")).toContain("5551993016927");
    expect(variantsE164("(51) 9301-6927")).toContain("5551993016927");
    expect(variantsE164("0 15 51 99301-6927")).toContain("5551993016927");
  });
  it("ignora valores lixo", () => {
    expect(normPhone("--")).toBeNull();
    expect(normPhone("0")).toBeNull();
  });
  it("lê a origem do destinatário", () => {
    const id = "02da043e-c44f-4c40-9a6e-13722ce0e1cd";
    expect(parseRecipientSource(`company:${id}`)).toEqual({ kind: "company", id });
    expect(parseRecipientSource("manual")).toBeNull();
  });
});
