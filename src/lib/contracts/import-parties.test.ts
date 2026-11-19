import { it, expect } from "vitest";
import { resolveImportParties, matchImportedOwnEntity } from "./import-parties.server";
import type { OwnEntity } from "./import-link.server";

const wk: OwnEntity = {
  id: "wk-entity",
  name: "Empresa WK",
  tradeName: "WK",
  cnpjDigits: "11222333000181",
};
const other = "22333444000190";

it("import provider maps the WK contracted side to its entity and the customer to counterparty", () => {
  expect(
    resolveImportParties(
      {
        contracting_cnpj: other,
        contracting_name: "Cliente",
        counterparty_cnpj: wk.cnpjDigits,
        counterparty_name: wk.name,
      },
      [wk],
    ),
  ).toMatchObject({
    role: "provider",
    ownEntityId: wk.id,
    counterpartyCnpj: other,
    counterpartyName: "Cliente",
    roleSource: "inferred",
  });
});
it("import purchase maps the WK contracting side to its entity and the supplier to counterparty", () => {
  expect(
    resolveImportParties(
      {
        contracting_cnpj: wk.cnpjDigits,
        contracting_name: wk.name,
        counterparty_cnpj: other,
        counterparty_name: "Fornecedor",
      },
      [wk],
    ),
  ).toMatchObject({
    role: "client",
    ownEntityId: wk.id,
    counterpartyCnpj: other,
    counterpartyName: "Fornecedor",
  });
});
it("import manual role remains explicit and a contradictory side requires human review", () => {
  expect(
    resolveImportParties(
      { contracting_cnpj: wk.cnpjDigits, counterparty_cnpj: other },
      [wk],
      "provider",
    ),
  ).toMatchObject({ role: "provider", roleSource: "manual", conflict: true, ownEntityId: null });
});
it("import never invents the WK entity when neither side matches", () => {
  expect(
    resolveImportParties(
      { role: "client", contracting_cnpj: other, counterparty_name: "Fornecedor" },
      [wk],
    ),
  ).toMatchObject({ role: "client", ownEntityId: null, roleSource: "extracted" });
});
it("import does not infer a commercial role from an ambiguous intercompany document", () => {
  expect(
    resolveImportParties(
      { role: "client", contracting_cnpj: wk.cnpjDigits, counterparty_cnpj: wk.cnpjDigits },
      [wk],
    ),
  ).toMatchObject({ inferredRole: null, roleSource: "extracted" });
});
it("import must not override an explicit unmatched CNPJ with a similar WK name", () => {
  expect(matchImportedOwnEntity([wk], other, wk.name)).toBeNull();
});
it("import ambiguous entity names do not silently select the first canonical entity", () => {
  expect(
    matchImportedOwnEntity([wk, { ...wk, id: "other-wk", cnpjDigits: other }], null, wk.name),
  ).toBeNull();
});
