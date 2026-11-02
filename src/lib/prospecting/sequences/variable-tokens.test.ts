import { expect, it } from "vitest";
import { buildFieldToken, parseFieldToken, renderRequiredTokens, sanitizeEntityRow } from "./variable-tokens";

it("resolve campo por entidade", () => {
  expect(renderRequiredTokens("Oi {{lead.first_name}} da {{company.name}}", { lead: { first_name: "Ana" }, company: { name: "WK" } })).toBe("Oi Ana da WK");
});
it("usa o padrão quando o campo está vazio", () => {
  expect(renderRequiredTokens("{{deal.name|seu projeto}}", { deal: undefined })).toBe("seu projeto");
});
it("sem padrão e sem valor, recusa o envio", () => {
  expect(() => renderRequiredTokens("{{contact.job_title}}", { contact: {} })).toThrow();
});
it("tokens antigos continuam valendo", () => {
  expect(renderRequiredTokens("{{full_name}}", { full_name: "Ana Lima" })).toBe("Ana Lima");
});
it("colunas sensíveis nunca chegam ao texto", () => {
  const row = sanitizeEntityRow({ portal_token: "x", owner_id: "u", custom_fields: { setor: "TI" }, name: "A" })!;
  expect(row.portal_token).toBeUndefined();
  expect(() => renderRequiredTokens("{{lead.portal_token}}", { lead: row })).toThrow();
  expect(renderRequiredTokens("{{lead.cf.setor}}", { lead: row })).toBe("TI");
});
it("monta e lê o token com padrão", () => {
  const t = buildFieldToken("company", "cf:setor", "TI");
  expect(t).toBe("{{company.cf.setor|TI}}");
  expect(parseFieldToken(t)).toEqual({ entity: "company", path: "cf.setor", fallback: "TI" });
});
