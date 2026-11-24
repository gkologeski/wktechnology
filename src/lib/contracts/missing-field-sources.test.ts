import { describe, expect, it } from "vitest";
import { groupMissingDraftFields, type DraftMissingSources } from "./missing-field-sources";

const SALES_SOURCES: DraftMissingSources = {
  legalEntityId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  proposalId: "33333333-3333-4333-8333-333333333333",
  dealId: "44444444-4444-4444-8444-444444444444",
  isPurchase: false,
};

describe("groupMissingDraftFields", () => {
  it("agrupa endereço da prestadora e signatário/cliente nos cadastros corretos em venda", () => {
    const groups = groupMissingDraftFields(
      [
        { key: "signer.full_name", label: "Nome do signatário", group: "Signatário" },
        { key: "signer.cpf", label: "CPF do signatário", group: "Signatário" },
        { key: "contracting.address", label: "Endereço", group: "Contratante" },
        { key: "counterparty.address", label: "Endereço", group: "Contraparte" },
      ],
      SALES_SOURCES,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      id: "legal_entity",
      sourceLabel: "Empresa prestadora",
      actionLabel: "Abrir cadastro",
      labels: ["Endereço"],
      destination: { kind: "legal_entity", id: SALES_SOURCES.legalEntityId },
    });
    expect(groups[1]).toMatchObject({
      id: "counterparty",
      sourceLabel: "Cliente/signatário",
      actionLabel: "Abrir cadastro",
      labels: ["Nome do signatário", "CPF do signatário", "Endereço"],
      destination: { kind: "company", id: SALES_SOURCES.companyId },
    });
  });

  it("identifica fornecedor como contraparte e WK como contratante em compra", () => {
    const groups = groupMissingDraftFields(
      [
        { key: "contracting.address", label: "Endereço", group: "Contratante" },
        { key: "counterparty.cnpj", label: "CNPJ", group: "Contraparte" },
        { key: "signer.full_name", label: "Nome do signatário", group: "Signatário" },
      ],
      { ...SALES_SOURCES, isPurchase: true, proposalId: null },
    );

    expect(groups[0]?.sourceLabel).toBe("Empresa contratante (WK)");
    expect(groups[0]?.destination).toEqual({
      kind: "legal_entity",
      id: SALES_SOURCES.legalEntityId,
    });
    expect(groups[1]?.sourceLabel).toBe("Fornecedor/signatário");
    expect(groups[1]?.destination).toEqual({ kind: "company", id: SALES_SOURCES.companyId });
  });

  it("remove rótulos repetidos dentro do mesmo grupo e omite destino quando ID está ausente", () => {
    const groups = groupMissingDraftFields(
      [
        { key: "signer.full_name", label: "Nome do signatário", group: "Signatário" },
        { key: "signer.full_name", label: "Nome do signatário", group: "Signatário" },
        { key: "custom.unknown", label: "custom.unknown", group: "Outros" },
      ],
      { ...SALES_SOURCES, companyId: null },
    );

    expect(groups[0]?.labels).toEqual(["Nome do signatário"]);
    expect(groups[0]?.destination).toEqual({ kind: "none" });
    expect(groups[1]).toMatchObject({
      id: "other",
      sourceLabel: "Outros dados",
      labels: ["custom.unknown"],
      destination: { kind: "none" },
    });
  });

  it("direciona campos de proposta/contrato para proposta ou negócio e retorna vazio sem pendências", () => {
    expect(groupMissingDraftFields([], SALES_SOURCES)).toEqual([]);

    const withProposal = groupMissingDraftFields(
      [{ key: "contract.payment_method", label: "Forma de pagamento", group: "Contrato" }],
      SALES_SOURCES,
    );
    expect(withProposal[0]?.destination).toEqual({
      kind: "proposal",
      id: SALES_SOURCES.proposalId,
    });

    const withoutProposal = groupMissingDraftFields(
      [{ key: "deal.value", label: "Valor do negócio", group: "Negócio" }],
      { ...SALES_SOURCES, proposalId: null },
    );
    expect(withoutProposal[0]?.destination).toEqual({
      kind: "deal",
      id: SALES_SOURCES.dealId,
    });
  });
});
