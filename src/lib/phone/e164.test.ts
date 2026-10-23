import { describe, expect, it } from "vitest";
import {
  formatPhoneDisplay,
  isValidE164,
  normalizePhone,
  normalizePhoneField,
  isBlankableShortPhone,
  phoneMainDigitCount,
  sanitizePhoneText,
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
  it("00/011 dependem do país: lidos pelo prefixo internacional DESSE país", () => {
    expect(e164("00351211234567", { defaultCountry: "PT" })).toBe("+351211234567");
    expect(e164("011 1 202 555 0143", { defaultCountry: "US" })).toBe("+12025550143");
    // Brasil exige operadora (00 + CSP): "0021 …" é internacional; "00 …" não.
    expect(e164("0021 1 202 555 0143")).toBe("+12025550143");
    expect(e164("00 1 202 555 0143")).toBe("!ambiguous");
  });
  it("sem país, 00 não é presumido internacional (fica candidato para revisão)", () => {
    const r = normalizePhone("00351211234567", { defaultCountry: null });
    expect(r).toMatchObject({
      status: "invalid",
      reason: "region_unknown",
      candidates: ["+351211234567"],
    });
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

describe("régua de até 4 dígitos (limpeza e dado novo)", () => {
  it("0 a 3 dígitos e o limite de 4 ficam em branco; 5 não", () => {
    for (const v of ["--", "0", "1", "12", "(11)", "+55", "1234", "12-34", "+5 5 1 1"]) {
      expect(isBlankableShortPhone(v)).toBe(true);
    }
    expect(phoneMainDigitCount("1234")).toBe(4);
    expect(isBlankableShortPhone("12345")).toBe(false);
    expect(isBlankableShortPhone("")).toBe(false);
    expect(isBlankableShortPhone(null)).toBe(false);
  });
  it("ramal não infla o comprimento e ramal sozinho não vira telefone", () => {
    expect(phoneMainDigitCount("1234 ramal 5678")).toBe(4);
    expect(isBlankableShortPhone("1234 ramal 5678")).toBe(true);
    expect(isBlankableShortPhone("ramal 22")).toBe(true);
    expect(normalizePhone("ramal 22", BR)).toMatchObject({ reason: "extension_only" });
  });
  it("dado novo com até 4 dígitos é recusado com mensagem clara", () => {
    expect(e164("1234")).toBe("!too_short");
    const r = normalizePhoneField("1234", BR);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/incompleto/i);
  });
  it("fixo e celular válidos não são afetados", () => {
    expect(isBlankableShortPhone("+551133334444")).toBe(false);
    expect(isBlankableShortPhone("+5511999998888")).toBe(false);
    expect(e164("+551133334444")).toBe("+551133334444");
    expect(e164("+5511999998888")).toBe("+5511999998888");
  });
});

describe("normalizador v2 — artefatos, ramal, + e DDI repetido", () => {
  it("ramal sai antes da divisão em vários números", () => {
    expect(normalizePhone("(11) 3333-4444, ramal 22", BR)).toMatchObject({
      status: "valid",
      e164: "+551133334444",
      extension: "22",
    });
    expect(normalizePhone("(11) 3333-4444; ramal 22", BR)).toMatchObject({ extension: "22" });
  });
  it("vários números continuam 'multiple' (sem escolher um)", () => {
    expect(normalizePhone("11 3333-4444 / 11 99999-8888 ramal 2", BR)).toMatchObject({
      reason: "multiple",
    });
  });
  it("remove só artefatos sem perder dígitos", () => {
    expect(e164("\u200b(11)\u00a03333\u20134444\ufeff")).toBe("+551133334444");
    expect(e164("'+55 11 99999-8888")).toBe("+5511999998888");
    expect(e164("Tel: +55 11 3333-4444")).toBe("+551133334444");
    expect(e164("tel:+12025550143")).toBe("+12025550143");
    expect(e164("Telefone (11) 3333-4444")).toBe("+551133334444");
    expect(sanitizePhoneText("Telefone (11) 3333-4444").replace(/\D/g, "")).toBe("1133334444");
    expect(e164("Celular 11 99999-8888")).toBe("!letters");
  });
  it("+ aceito só no início, admitindo '(' antes", () => {
    expect(e164("(+55) 11 99999-8888")).toBe("+5511999998888");
    expect(e164("55 (+11) 99999-8888")).toBe("!bad_plus");
  });
  it("DDI repetido só com evidência do registro e leitura única", () => {
    const raw = "+55 55 11 99999-8888";
    expect(normalizePhone(raw, BR)).toMatchObject({
      status: "invalid",
      reason: "repeated_country_code",
      candidates: ["+5511999998888"],
    });
    expect(
      normalizePhone(raw, { defaultCountry: "BR", allowRepeatedCountryCode: true }),
    ).toMatchObject({ status: "valid", e164: "+5511999998888", via: "repeated_country_code" });
    // Evidência de outro país não autoriza.
    expect(
      normalizePhone(raw, { defaultCountry: "PT", allowRepeatedCountryCode: true }),
    ).toMatchObject({ reason: "repeated_country_code" });
    // DDD 55 legítimo não é tratado como repetição.
    expect(e164("+55 55 3222-1234")).toBe("+555532221234");
  });
  it("exterior: zero significativo e +1 compartilhado preservados", () => {
    expect(e164("+39 06 1234 5678")).toBe("+390612345678");
    expect(e164("+1 416 555 0143")).toBe("+14165550143");
    expect(normalizePhone("+1 416 555 0143", BR)).toMatchObject({ country: "CA" });
    expect(normalizePhone("+1 202 555 0143", BR)).toMatchObject({ country: "US" });
  });
  it("celular antigo sem 9 nunca ganha o 9", () => {
    expect(e164("(51) 9301-6927")).toBe("!invalid");
  });
});

describe("DDI repetido seguido de 0 não é corrigido", () => {
  it("+55 55 0800… fica para revisão mesmo com evidência", () => {
    const r = normalizePhone("+55 55 0800 591 1234", {
      defaultCountry: "BR",
      allowRepeatedCountryCode: true,
    });
    expect(r.status).toBe("invalid");
  });
});
