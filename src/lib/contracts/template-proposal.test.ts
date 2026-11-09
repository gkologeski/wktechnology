import { expect, it, vi } from "vitest";
import { mergeTemplateBody, usedTokens, unknownTokens } from "./template-tokens";
import { legalEntityAddress, loadAcceptedProposalSource } from "./accepted-proposal.server";

it("maps all thirteen variables of the hunting model without requiring term dates", () => {
  const keys = [
    "contract.number",
    "counterparty.name",
    "counterparty.cnpj",
    "counterparty.address",
    "counterparty.city",
    "counterparty.state",
    "contracting.name",
    "contracting.cnpj",
    "contracting.address",
    "proposal.id",
    "proposal.title",
    "proposal.version",
    "proposal.decided_at",
  ];
  const html = keys.map((k) => `{{${k}}}`).join(" | ");
  expect(unknownTokens(html)).toEqual([]);
  expect(usedTokens(html)).toHaveLength(13);
  expect(
    mergeTemplateBody(
      html,
      {
        contract: { number: "C-42" },
        counterparty: {
          name: "Cliente",
          cnpj: "cliente-cnpj",
          address: "Rua A",
          city: "Curitiba",
          state: "PR",
        },
        contracting: { name: "WK Technology", cnpj: "wk-cnpj", address: "Rua B" },
        proposal: { id: "P-1", title: "Hunting", version: 3, decided_at: "08/11/2026" },
      },
      { strict: true },
    ),
  ).toBe(
    "C-42 | Cliente | cliente-cnpj | Rua A | Curitiba | PR | WK Technology | wk-cnpj | Rua B | P-1 | Hunting | 3 | 08/11/2026",
  );
});
it("blocks missing and unknown variables instead of issuing an incomplete contract", () => {
  expect(() =>
    mergeTemplateBody(
      "{{proposal.version}} {{contracting.address}}",
      { proposal: { version: 3 } },
      { strict: true },
    ),
  ).toThrow("contracting.address");
  expect(() => mergeTemplateBody("{{proposal.latest}}", {}, { strict: true })).toThrow(
    "proposal.latest",
  );
});
it("escapes CRM data without changing the model markup", () => {
  expect(
    mergeTemplateBody(
      "<p>{{counterparty.name}}</p>",
      { counterparty: { name: '<img src=x onerror="alert(1)">' } },
      { strict: true },
    ),
  ).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
});
it("formats only the selected legal entity address and detects a missing address", () => {
  expect(legalEntityAddress({ street: "Rua A", number: 42, city: "Curitiba", state: "PR" })).toBe(
    "Rua A, 42, Curitiba, PR",
  );
  expect(legalEntityAddress({})).toBeNull();
  expect(legalEntityAddress("unexpected")).toBeNull();
});
it("loads the explicit accepted version using only the user RPC", async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: { workspace_id: "W", proposal: { id: "P", version: 3 } },
    error: null,
  });
  await expect(loadAcceptedProposalSource({ rpc } as never, "W", "P")).resolves.toMatchObject({
    proposal: { version: 3 },
  });
  expect(rpc).toHaveBeenCalledWith("proposal_contract_source", { p_id: "P" });
});
it("fails closed when the accepted source belongs to a foreign workspace", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { workspace_id: "OTHER" }, error: null });
  await expect(loadAcceptedProposalSource({ rpc } as never, "W", "P")).rejects.toThrow("workspace");
});
it("propagates source authorization and acceptance failures without fallback", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: null, error: { message: "Proposta indisponível" } });
  await expect(loadAcceptedProposalSource({ rpc } as never, "W", "P")).rejects.toThrow(
    "Proposta indisponível",
  );
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("builds the hunting context from the selected version and selected issuer", async () => {
  const { buildMergeContext } = await import("./template-merge.server");
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const source = {
    workspace_id: "W",
    decided_at: "2026-11-08T02:00:00Z",
    proposal: {
      id: "P",
      title: "Proposta aceita",
      version: 3,
      company_id: "C",
      deal_id: "D",
      total_amount: 12000,
      currency: "BRL",
    },
    company: {
      id: "C",
      name: "Cliente na versão aceita",
      cnpj: "cliente",
      address: "Rua Cliente",
      city: "Curitiba",
      state: "PR",
    },
    contact: null,
  };
  const records: Record<string, unknown> = {
    deals: { id: "D", name: "Negócio", value: 99999, company_id: "C" },
    companies: { id: "C", name: "Cadastro alterado depois do envio" },
    legal_entities: {
      id: "PJ",
      name: "WK Technology",
      cnpj: "wk",
      address_json: { street: "Rua WK", number: 10 },
    },
    profiles: { full_name: "Operador", email: "operator@techerp-test.invalid" },
  };
  const rpc = vi.fn().mockResolvedValue({ data: source, error: null });
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      const filters: Array<[string, unknown]> = [];
      queries.push({ table, filters });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return chain;
        },
        maybeSingle: async () => ({ data: records[table], error: null }),
      };
      return chain;
    }),
  };
  const template = {
    name: "Hunting",
    body_html:
      "{{proposal.id}} {{proposal.title}} {{proposal.version}} {{proposal.decided_at}} {{counterparty.name}} {{contracting.address}}",
    defaults: { total_value: 1 },
  };
  const built = await buildMergeContext(
    client,
    "W",
    "U",
    { templateId: "T", proposalId: "P", contractingLegalEntityId: "PJ" },
    template,
  );
  expect(mergeTemplateBody(template.body_html, built.ctx, { strict: true })).toBe(
    "P Proposta aceita 3 07/11/2026 Cliente na versão aceita Rua WK, 10",
  );
  expect(built.contract).toMatchObject({ total_value: 12000, starts_at: null, ends_at: null });
  expect(built.entity.id).toBe("PJ");
  expect(queries.find((q) => q.table === "legal_entities")?.filters).toContainEqual(["id", "PJ"]);
  expect(queries.some((q) => q.table === "contacts")).toBe(false);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("requires an accepted proposal before any context query for the hunting model", async () => {
  const { buildMergeContext } = await import("./template-merge.server");
  const from = vi.fn();
  await expect(
    buildMergeContext(
      { from },
      "W",
      "U",
      { templateId: "T" },
      { body_html: "{{proposal.version}}" },
    ),
  ).rejects.toThrow("Proposta Comercial aceita");
  expect(from).not.toHaveBeenCalled();
});
it("rejects a conflicting company before reading other merge sources", async () => {
  const { buildMergeContext } = await import("./template-merge.server");
  const from = vi.fn();
  const rpc = vi.fn().mockResolvedValue({
    data: { workspace_id: "W", proposal: { company_id: "OTHER" } },
    error: null,
  });
  await expect(
    buildMergeContext(
      { from, rpc },
      "W",
      "U",
      { templateId: "T", proposalId: "P", companyId: "C" },
      { body_html: "{{proposal.id}}" },
    ),
  ).rejects.toThrow("outra empresa");
  expect(from).not.toHaveBeenCalled();
});
