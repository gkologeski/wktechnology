import { describe, expect, it } from "vitest";
import {
  formatPhoneDisplay,
  isValidE164,
  normalizePhone,
  normalizePhoneField,
  splitPhoneCandidates,
  telHref,
} from "./e164";

const BR = { defaultCountry: "BR" };
const e164 = (raw: string, opts: { defaultCountry: string | null } = BR) => {
  const r = normalizePhone(raw, opts);
  return r.status === "valid" ? r.e164 : r.status === "invalid" ? `!${r.reason}` : "empty";
};

describe("normalizePhone — Brasil com país de contexto", () => {
  it("fixo BR vira E.164 sem inventar 9", () => {
    expect(e164("(11) 3333-4444")).toBe("+551133334444");
    const r = normalizePhone("(11) 3333-4444", BR);
    expect(r.status === "valid" && r.type).toBe("fixed_line");
  });
  it("celular BR em vários formatos (colado, máscara, +55, 55, 0 + operadora)", () => {
    for (const raw of [
      "(11) 99999-8888",
      "11999998888",
      "+55 (11) 99999-8888",
      "+55-11-99999-8888",
      "5511999998888",
      "055 11 99999-8888",
      "0 21 11 99999-8888",
    ]) {
      expect(e164(raw)).toBe("+5511999998888");
    }
  });
  it("celular antigo sem o 9 NÃO ganha o 9 (inválido no plano atual)", () => {
    expect(e164("(51) 9301-6927")).toBe("!invalid");
    expect(e164("+55 51 9301-6927")).toBe("!invalid");
  });
  it("DDD 55 é aceito quando só há uma leitura possível", () => {
    expect(e164("(55) 3222-1234")).toBe("+555532221234");
    expect(e164("+55 55 99999-8888")).toBe("+5555999998888");
  });
  it("número incompleto ou longo demais é recusado, sem truncar", () => {
    expect(e164("9999-8888")).toBe("!invalid");
    expect(e164("123")).toBe("!too_short");
    expect(e164("+5511999998888123456")).toBe("!too_long");
  });
});

describe("normalizePhone — internacionais", () => {
  it("+DDI explícito ignora o país de contexto", () => {
    expect(e164("+1 202 555 0143")).toBe("+12025550143");
    expect(e164("+351 21 123 4567")).toBe("+351211234567");
    expect(e164("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("Itália preserva o zero significativo", () => {
    expect(e164("+39 06 1234 5678")).toBe("+390612345678");
  });
  it("00 + DDI é tratado como internacional", () => {
    expect(e164("00 1 202 555 0143", { defaultCountry: null })).toBe("+12025550143");
    expect(e164("00351211234567", { defaultCountry: null })).toBe("+351211234567");
  });
  it("sem + e sem país de contexto: região desconhecida, nunca presume BR", () => {
    expect(e164("(11) 3333-4444", { defaultCountry: null })).toBe("!region_unknown");
    expect(e164("5511999998888", { defaultCountry: null })).toBe("!region_unknown");
  });
  it("país de contexto diferente de BR", () => {
    expect(e164("020 7946 0958", { defaultCountry: "GB" })).toBe("+442079460958");
    expect(e164("(202) 555-0143", { defaultCountry: "US" })).toBe("+12025550143");
  });
});

describe("normalizePhone — entradas problemáticas", () => {
  it("vazio, espaços e placeholders", () => {
    expect(e164("")).toBe("empty");
    expect(e164("   ")).toBe("empty");
    expect(e164("--")).toBe("!placeholder");
    expect(e164("0")).toBe("!placeholder");
  });
  it("letras, unicode e alfanumérico são recusados", () => {
    expect(e164("abc")).toBe("!letters");
    expect(e164("11 9999A-8888")).toBe("!letters");
    expect(e164("1-800-FLOWERS")).toBe("!letters");
    expect(e164("+55 11 ９９９９９-８８８８")).toBe("+5511999998888"); // dígitos largos (NFKC)
  });
  it("+ fora do início ou repetido", () => {
    expect(e164("11+999998888")).toBe("!bad_plus");
    expect(e164("++5511999998888")).toBe("!bad_plus");
  });
  it("ramal fica separado do E.164", () => {
    const r = normalizePhone("(11) 3333-4444 ramal 22", BR);
    expect(r).toMatchObject({ status: "valid", e164: "+551133334444", extension: "22" });
    const x = normalizePhone("+55 11 3333-4444 x 7", BR);
    expect(x).toMatchObject({ status: "valid", e164: "+551133334444", extension: "7" });
  });
  it("vários números no mesmo campo não viram um E.164 só", () => {
    const r = normalizePhone("(11) 3333-4444 / (11) 99999-8888", BR);
    expect(r).toMatchObject({ status: "invalid", reason: "multiple" });
    expect(splitPhoneCandidates("11 3333-4444; 11 99999-8888")).toHaveLength(2);
  });
});

describe("normalizePhoneField", () => {
  it("opcional vazio vira null; obrigatório vazio bloqueia", () => {
    expect(normalizePhoneField("", BR)).toEqual({ ok: true, value: null, extension: null });
    expect(normalizePhoneField("", { ...BR, required: true }).ok).toBe(false);
  });
  it("placeholder só vira vazio quando pedido", () => {
    expect(normalizePhoneField("--", BR).ok).toBe(false);
    expect(normalizePhoneField("--", { ...BR, placeholderAsEmpty: true })).toMatchObject({
      ok: true,
      value: null,
    });
  });
  it("mensagem de erro não repete o número", () => {
    const r = normalizePhoneField("11 3333", BR);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toContain("3333");
  });
});

describe("utilitários", () => {
  it("isValidE164 exige canônico e válido", () => {
    expect(isValidE164("+5511999998888")).toBe(true);
    expect(isValidE164("+55 11 99999-8888")).toBe(false);
    expect(isValidE164("+555193016927")).toBe(false);
  });
  it("exibição internacional mantém o DDI e não altera o valor", () => {
    expect(formatPhoneDisplay("+5511999998888")).toBe("+55 11 99999 8888");
    expect(formatPhoneDisplay("(11) 3333")).toBe("(11) 3333");
  });
  it("tel: com ramal no formato RFC 3966", () => {
    expect(telHref("+551133334444", "22")).toBe("tel:+551133334444;ext=22");
  });
});
