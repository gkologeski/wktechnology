import { expect, it } from "vitest";
import { emptyPreparation } from "./types";
import { preparationOriginProblems, type PreparationOrigin } from "./origin-presentation";
const source = (patch: Partial<PreparationOrigin> = {}): PreparationOrigin => ({
  source: "commercial_contract",
  id: "contract",
  title: "Venda",
  legal_entity_id: "entity",
  legal_entity_name: "Contratante",
  cnpj: "12345678000100",
  active: true,
  deal_id: "deal",
  contract_id: "contract",
  ...patch,
});
it("compatible commercial origin has no fabricated mismatch", () => {
  expect(
    preparationOriginProblems(
      {
        ...emptyPreparation("supplier"),
        purpose: "client",
        legal_entity_id: "entity",
        commercial_contract_id: "contract",
      },
      [source()],
    ),
  ).toEqual([]);
});
it("divergence names the actual source and entity before saving", () => {
  const issues = preparationOriginProblems(
    { ...emptyPreparation("supplier"), purpose: "client", legal_entity_id: "other" },
    [source()],
  );
  expect(issues.join(" ")).toContain("Venda");
  expect(issues.join(" ")).toContain("Contratante");
  expect(issues.join(" ")).toContain("12345678000100");
});
it("inactive entity without CNPJ cannot be silently matched to an active namesake", () => {
  const issues = preparationOriginProblems(
    { ...emptyPreparation("supplier"), purpose: "client", legal_entity_id: "other" },
    [source({ active: false, cnpj: null })],
  );
  expect(issues.join(" ")).toContain("inativa");
  expect(issues.join(" ")).toContain("CNPJ não informado");
});
it("a project without commercial links is not proof of belonging to the selected sale", () => {
  const form = {
    ...emptyPreparation("supplier"),
    purpose: "client" as const,
    legal_entity_id: "entity",
    deal_id: "deal",
    commercial_contract_id: "contract",
  };
  const issues = preparationOriginProblems(form, [
    source({ source: "project", deal_id: null, contract_id: null }),
  ]);
  expect(issues).toHaveLength(2);
  expect(issues.join(" ")).toContain("projeto não está vinculado");
});
it("internal purpose does not inherit client-only comparison rules", () => {
  expect(
    preparationOriginProblems(
      { ...emptyPreparation("supplier"), legal_entity_id: "other", project_id: "project" },
      [source({ source: "project", active: false })],
    ),
  ).toEqual([]);
});
