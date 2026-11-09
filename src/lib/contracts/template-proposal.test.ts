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
  const rpc = vi
    .fn()
    .mockResolvedValue({
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
