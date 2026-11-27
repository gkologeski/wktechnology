import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ContractPaymentTermsCard } from "./contract-payment-terms-card";
const terms = { downPayment: { kind: "none" }, plan: { kind: "monthly", months: 2, dueDay: 10 } };
it("uses the persisted contract start instead of inventing dates from the viewing day", () => {
  const html = renderToStaticMarkup(
    createElement(ContractPaymentTermsCard, {
      raw: terms,
      total: 2000,
      currency: "BRL",
      startsAt: "2030-04-05",
      publicView: true,
    }),
  );
  expect(html).toContain("10/04/2030");
  expect(html).toContain("10/05/2030");
  expect(html).toContain("O aceite comercial e a assinatura são registros separados");
});
it("keeps relative due dates unresolved if the contract has no start date", () => {
  const html = renderToStaticMarkup(
    createElement(ContractPaymentTermsCard, { raw: terms, total: 2000, currency: "BRL" }),
  );
  expect(html).toContain("quando a data de início do contrato estiver definida");
  expect(html).not.toContain("Mensalidade 1/2");
  expect(html).not.toContain("geradas na ativação");
});
it("preserves explicitly agreed dates while distinguishing release from execution", () => {
  const html = renderToStaticMarkup(
    createElement(ContractPaymentTermsCard, {
      raw: { downPayment: { kind: "none" }, plan: { kind: "fixed_date", date: "2026-11-30" } },
      total: 4500,
      currency: "BRL",
    }),
  );
  expect(html).toContain("30/11/2026");
  expect(html).toContain("liberação financeira");
  expect(html).toContain("A conclusão da execução é independente");
});
