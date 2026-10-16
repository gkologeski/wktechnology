import { describe, expect, it } from "vitest";
import {
  classifyPhone,
  parsePhoneCandidates,
  pickWhatsAppNumber,
  toWhatsAppE164,
  validateWhatsAppInput,
} from "./whatsapp-e164";

describe("whatsapp-e164", () => {
  it("celular com e sem 55 vira E.164", () => {
    expect(toWhatsAppE164("(48) 99110-4003")).toBe("+5548991104003");
    expect(toWhatsAppE164("5548991104003")).toBe("+5548991104003");
    expect(toWhatsAppE164("+55-51-99301-6927")).toBe("+5551993016927");
  });
  it("celular antigo sem o 9º dígito ganha o 9", () => {
    expect(toWhatsAppE164("(51) 9301-6927")).toBe("+5551993016927");
  });
  it("fixo é recusado", () => {
    expect(classifyPhone("(11) 3333-4444").kind).toBe("landline");
    expect(toWhatsAppE164("+55 11 3333-4444")).toBeNull();
    expect(validateWhatsAppInput("1133334444").ok).toBe(false);
  });
  it("operadora e zeros à esquerda são ignorados", () => {
    expect(toWhatsAppE164("0 21 48 99110-4003")).toBe("+5548991104003");
    expect(toWhatsAppE164("048991104003")).toBe("+5548991104003");
  });
  it("valores lixo são inválidos", () => {
    expect(parsePhoneCandidates("--")).toEqual([]);
    expect(classifyPhone("0").kind).toBe("invalid");
  });
  it("separa vários números no mesmo campo", () => {
    expect(parsePhoneCandidates("(11) 3333-4444 / (11) 98888-7777")).toHaveLength(2);
    expect(pickWhatsAppNumber(["(11) 3333-4444 / (11) 98888-7777"])).toEqual({
      status: "ok",
      e164: "+5511988887777",
    });
  });
  it("prioridade WhatsApp → Celular → Telefone e só fixo vira landline", () => {
    expect(pickWhatsAppNumber(["+5548991104003", "11988887777", null]).e164).toBe("+5548991104003");
    expect(pickWhatsAppNumber([null, null, "11988887777"]).e164).toBe("+5511988887777");
    expect(pickWhatsAppNumber([null, "1133334444"]).status).toBe("landline");
    expect(pickWhatsAppNumber([null, ""]).status).toBe("empty");
  });
});
