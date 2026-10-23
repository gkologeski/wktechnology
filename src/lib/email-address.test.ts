import { describe, expect, it } from "vitest";
import {
  isEmailAddress,
  isEmailColumn,
  normalizeEmailAddress,
  normalizeEmailFields,
  parseEmailList,
  validateEmailAddress,
} from "./email-address";
import { emailSchema } from "./email-schema";
import { coerceBulkValue } from "./grid/bulk-edit-fields";
import { isEmail } from "./validators";

const valid = [
  "User@example.com",
  "User+projetos@Sub.Example.technology",
  "o'hara@example.co.uk",
  "josé@exemplo.com.br",
  "用户@例子.广告",
  "δοκιμή@παράδειγμα.δοκιμή",
  "пользователь@пример.рф",
  "müller@bücher.de",
  "User@xn--bcher-kva.de",
  "user@faß.de",
  "a@☃.net",
  "a@sub.empresa.photography",
  "a@empresa.museum",
  `${"a".repeat(64)}@example.com`,
  `${"é".repeat(32)}@example.com`,
];
const invalid = [
  "",
  "abc",
  "@example.com",
  "a@",
  "a@@example.com",
  "a b@example.com",
  "a@exa mple.com",
  "a..b@example.com",
  ".a@example.com",
  "a.@example.com",
  "Nome <a@example.com>",
  '"a b"@example.com',
  "a@example.com,b@example.com",
  "a@example.com; b@example.com",
  "a@example.com\r\nBcc:x@example.com",
  "a@example.com\n",
  "a@localhost",
  "a@_example.com",
  "a@-example.com",
  "a@example-.com",
  "a@example..com",
  "a@example.com.",
  "a@xn--.com",
  "a@ab--cd.com",
  "a@[127.0.0.1]",
  "a@example.123",
  "a\u200Bb@example.com",
  "a@ab\u200Dcd.com",
  "a@aא.com",
  `${"a".repeat(65)}@example.com`,
  `${"é".repeat(33)}@example.com`,
  `a@${"b".repeat(64)}.com`,
  `a@${["b".repeat(63), "c".repeat(63), "d".repeat(63), "e".repeat(61)].join(".")}`,
];

describe("e-mail internacional: cadastro, schema e bulk têm a mesma regra", () => {
  it.each(valid)("aceita %s", (value) => {
    expect(isEmailAddress(value)).toBe(true);
    expect(isEmail(value)).toBe(true);
    expect(emailSchema().safeParse(value).success).toBe(true);
    expect(coerceBulkValue("email", "text", value)).toBe(normalizeEmailAddress(value));
  });
  it.each(invalid)("recusa inteiro, sem corrigir ou extrair: %s", (value) => {
    expect(isEmailAddress(value)).toBe(false);
    expect(isEmail(value)).toBe(false);
    expect(emailSchema().safeParse(value).success).toBe(false);
    if (value) expect(() => coerceBulkValue("email", "text", value)).toThrow();
  });
  it("normaliza apenas domínio/trim, preservando +tag, acentos e case local", () => {
    expect(normalizeEmailAddress("  José+WK@BÜCHER.DE  ")).toBe("José+WK@xn--bcher-kva.de");
    expect(emailSchema().parse("  José+WK@BÜCHER.DE  ")).toBe("José+WK@xn--bcher-kva.de");
    expect(validateEmailAddress("José@example.com")).toMatchObject({
      ok: true,
      requiresSmtpUtf8: true,
    });
    expect(validateEmailAddress("User@bücher.de")).toMatchObject({
      ok: true,
      requiresSmtpUtf8: false,
    });
  });
  it("mantém contrato PATCH/nullable/optional e não limpa inválidos", () => {
    expect(emailSchema().optional().parse(undefined)).toBeUndefined();
    expect(emailSchema().nullable().parse(null)).toBeNull();
    expect(normalizeEmailAddress(null)).toBeNull();
    expect(normalizeEmailAddress("")).toBeNull();
    expect(() => normalizeEmailAddress("x y@exemplo.com")).toThrow();
    expect(normalizeEmailFields({ email: undefined, name: "Teste" })).toEqual({
      email: undefined,
      name: "Teste",
    });
    expect(normalizeEmailFields({ email: "User@BÜCHER.DE", email_subject: "Texto" })).toEqual({
      email: "User@xn--bcher-kva.de",
      email_subject: "Texto",
    });
    expect(isEmailColumn("email_body")).toBe(false);
    expect(isEmailColumn("linkedin_notification_email")).toBe(true);
  });
  it("limites específicos de uma coluna são preservados após normalizar IDN", () => {
    expect(emailSchema(10).safeParse("User@bücher.de").success).toBe(false);
    expect(emailSchema().parse("User@bücher.de")).toBe("User@xn--bcher-kva.de");
  });
  it("listas têm separação explícita e validam cada item, sem filtrar erros", () => {
    expect(parseEmailList("José@exemplo.com; User@BÜCHER.DE\nuser+tag@example.com")).toEqual([
      "José@exemplo.com",
      "User@xn--bcher-kva.de",
      "user+tag@example.com",
    ]);
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList(["User@BÜCHER.DE"])).toEqual(["User@xn--bcher-kva.de"]);
    for (const value of [
      "a@example.com,",
      "a@example.com,,b@example.com",
      "a@example.com b@example.com",
      "Nome <a@example.com>",
      "a@example.com\r\nBcc:x@example.com",
    ])
      expect(() => parseEmailList(value)).toThrow();
    expect(() => parseEmailList(Array(51).fill("a@example.com"))).toThrow();
  });
});
