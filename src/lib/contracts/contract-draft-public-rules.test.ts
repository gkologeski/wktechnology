import { describe, expect, it } from "vitest";
import { clientDraftDecisionError } from "./contract-draft-public-rules";

const T = "6f1c2a4e-8b7d-4c3a-9e2f-1a2b3c4d5e6f";
const base = { token: T, status: "sent", decision: "accept" as const, name: "Alan Fuentes", note: null };

describe("contract draft client acceptance", () => {
  it("client draft accepts a sent draft with a valid token and name", () => {
    expect(clientDraftDecisionError(base)).toBeNull();
  });
  it("client draft rejects a malformed token", () => {
    expect(clientDraftDecisionError({ ...base, token: "abc" })).toBe("Link inválido.");
  });
  it("client draft rejects an unknown token", () => {
    expect(clientDraftDecisionError({ ...base, status: null })).toBe("Minuta não encontrada.");
  });
  it("client draft rejects a draft not yet sent or already answered", () => {
    expect(clientDraftDecisionError({ ...base, status: "approved" })).toBe(
      "Esta minuta já foi respondida.",
    );
    expect(clientDraftDecisionError({ ...base, status: "accepted" })).toBe(
      "Esta minuta já foi respondida.",
    );
  });
  it("client draft requires a reason when asking for changes", () => {
    expect(clientDraftDecisionError({ ...base, decision: "changes", note: "ok" })).toBe(
      "Descreva os ajustes desejados.",
    );
    expect(
      clientDraftDecisionError({ ...base, decision: "changes", note: "Ajustar multa" }),
    ).toBeNull();
  });
});
