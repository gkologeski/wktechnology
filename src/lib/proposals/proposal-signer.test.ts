import { describe, expect, it } from "vitest";
import { chooseProposalSigner } from "./proposal-signer";

const marcos = { first_name: "Marcos", last_name: "Gulfier", email: "m@x.com", custom_fields: { cpf: "168.773.388-04" } };
const outro = { first_name: "Ana", last_name: "Lima", email: null, custom_fields: null };
const contato = { first_name: "Alan", last_name: "Fuentes", email: "a@x.com", custom_fields: null };

describe("chooseProposalSigner", () => {
  it("usa o signatário legal único", () => {
    expect(chooseProposalSigner([marcos], contato)).toEqual({ full_name: "Marcos Gulfier", cpf: "168.773.388-04", email: "m@x.com" });
  });
  it("com dois signatários usa o contato da proposta", () => {
    expect(chooseProposalSigner([marcos, outro], contato).full_name).toBe("Alan Fuentes");
  });
  it("sem signatário nem contato fica vazio", () => {
    expect(chooseProposalSigner([], null).full_name).toBe("");
  });
});
