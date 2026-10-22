import { describe, expect, it } from "vitest";
import {
  countryFromRecordField,
  humanPhone,
  isPhoneValidationError,
  phoneErrorBody,
  sourcePhone,
  sourcePhoneExtension,
  workflowPhone,
  zHumanPhone,
} from "./phone-boundary";
import { maskPhone } from "./e164";
import { summarizePhoneRun } from "./phone-review";
import { buildBrPhoneVariants } from "@/lib/inbox/identity-resolution.server";
import { pickWhatsAppNumber, toWhatsAppE164 } from "./whatsapp-e164";
import { neutralizeCsvFormula } from "@/lib/security/escape";
import { validateAnswers, type FormSchema } from "@/lib/surveys/form-schema";

describe("humanPhone (digitado agora / API)", () => {
  it("usa o país do workspace só para número sem +DDI", () => {
    expect(humanPhone("(11) 3333-4444", { field: "phone", country: "BR" })).toBe("+551133334444");
    expect(humanPhone("+1 202 555 0143", { field: "phone", country: "BR" })).toBe("+12025550143");
  });
  it("vazio vira null; obrigatório vazio é erro", () => {
    expect(humanPhone("", { field: "phone", country: "BR" })).toBeNull();
    expect(() => humanPhone("", { field: "phone", country: "BR", required: true })).toThrow();
  });
  it("inválido gera erro 422 sem ecoar o número", () => {
    try {
      humanPhone("(51) 9301-6927", { field: "phone", country: "BR" });
      throw new Error("deveria falhar");
    } catch (e) {
      expect(isPhoneValidationError(e)).toBe(true);
      if (!isPhoneValidationError(e)) return;
      expect(e.status).toBe(422);
      const body = phoneErrorBody(e);
      expect(body.error).toBe("invalid_phone");
      expect(JSON.stringify(body)).not.toContain("9301");
    }
  });
  it("esquema zod de perfil devolve E.164", () => {
    expect(zHumanPhone({ required: true }).parse("+55 (11) 99999-8888")).toBe("+5511999998888");
    expect(zHumanPhone({ required: true }).safeParse("123").success).toBe(false);
  });
});

describe("sourcePhone (integrações/importação)", () => {
  it("normaliza quando há +DDI e não inventa país sem evidência", () => {
    expect(sourcePhone("+55-11-3333-4444")).toBe("+551133334444");
    expect(sourcePhone("(11) 3333-4444")).toBe("(11) 3333-4444");
    expect(sourcePhone("(11) 3333-4444", "BR")).toBe("+551133334444");
  });
  it("placeholder vira null; valor não lido é mantido (sem apagar)", () => {
    expect(sourcePhone("--")).toBeNull();
    expect(sourcePhone("0")).toBeNull();
    expect(sourcePhone("11 3333-4444 / 11 99999-8888", "BR")).toBe("11 3333-4444 / 11 99999-8888");
  });
  it("ramal é separado", () => {
    expect(sourcePhoneExtension("(11) 3333-4444 ramal 21", "BR")).toBe("21");
  });
  it("país do próprio registro (nome PT/EN ou ISO)", () => {
    expect(countryFromRecordField("Brasil")).toBe("BR");
    expect(countryFromRecordField("Brazil")).toBe("BR");
    expect(countryFromRecordField("Estados Unidos")).toBe("US");
    expect(countryFromRecordField("pt")).toBe("PT");
    expect(countryFromRecordField("Atlântida")).toBeNull();
  });
});

describe("workflowPhone", () => {
  it("token copiado sem inventar país; texto fixo valida", () => {
    expect(workflowPhone("{{contact.phone}}", "(11) 3333-4444", "BR")).toBe("(11) 3333-4444");
    expect(workflowPhone("{{contact.phone}}", "+551133334444", "BR")).toBe("+551133334444");
    expect(workflowPhone("(11) 3333-4444", "(11) 3333-4444", "BR")).toBe("+551133334444");
    expect(() => workflowPhone("123", "123", "BR")).toThrow();
  });
});

describe("compatibilidade de canais e identidade", () => {
  it("Inbox reconhece o mesmo número antes e depois da padronização", () => {
    const after = buildBrPhoneVariants("+5511999998888");
    expect(after).toContain("11999998888"); // dígitos do formato antigo
    expect(after).toContain("5511999998888"); // dígitos do E.164
  });
  it("política de WhatsApp continua: fixo e estrangeiro válidos não viram WhatsApp", () => {
    expect(toWhatsAppE164("+551133334444")).toBeNull();
    expect(toWhatsAppE164("+12025550143")).toBeNull();
    expect(pickWhatsAppNumber([null, "+5511999998888", "+551133334444"]).e164).toBe(
      "+5511999998888",
    );
  });
  it("exportação mantém o + do E.164 e segue neutralizando fórmulas", () => {
    expect(neutralizeCsvFormula("+5511999998888")).toBe("+5511999998888");
    expect(neutralizeCsvFormula("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(neutralizeCsvFormula("=1+1")).toBe("'=1+1");
  });
  it("pesquisas recusam telefone fora do E.164", () => {
    const schema = {
      version: 1,
      fields: [{ id: "p", type: "phone", label: "Telefone" }],
    } as unknown as FormSchema;
    expect(validateAnswers(schema, { p: "+5511999998888" })).toEqual({});
    expect(validateAnswers(schema, { p: "(11) 99999-8888" })).toHaveProperty("p");
  });
});

describe("relatório", () => {
  it("máscara não expõe o número inteiro", () => {
    expect(maskPhone("+5511999998888")).toBe("+55•••••••••88");
  });
  it("resumo soma padronizados, já no padrão e revisão", () => {
    const s = summarizePhoneRun(
      { "contacts.phone": { safe_explicit: 5, already_canonical: 2, invalid: 3, placeholder: 1 } },
      { "contacts.phone": 6 },
    );
    expect(s).toMatchObject({ total: 11, applied: 6, canonical: 2, pending: 3 });
  });
});
