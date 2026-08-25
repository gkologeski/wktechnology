import { describe, expect, it } from "vitest";
import {
  buildSuggestionEvidence,
  dedupeSuggestions,
  effectiveRole,
  inferRoleFromParties,
  isOwnParty,
  isValidSuggestion,
  roleMismatch,
  type ContractLinkMeta,
  type LinkSuggestion,
} from "@/lib/contracts/link-suggest";

function meta(over: Partial<ContractLinkMeta> & { id: string }): ContractLinkMeta {
  return {
    role: "provider",
    document_kind: "main",
    number: null,
    self_number: null,
    title: "Contrato",
    company_name: null,
    contracting_name: null,
    contracting_cnpj: null,
    counterparty_name: null,
    counterparty_cnpj: null,
    starts_at: null,
    ends_at: null,
    ...over,
  };
}

const own = [{ cnpjDigits: "12345678000190", name: "WK Technology Ltda", tradeName: "WK" }];

describe("isOwnParty", () => {
  it("casa por CNPJ", () => {
    expect(isOwnParty(own, "12.345.678/0001-90", null)).toBe(true);
  });
  it("casa por nome ignorando sufixos societários", () => {
    expect(isOwnParty(own, null, "WK TECHNOLOGY")).toBe(true);
  });
  it("não casa terceiros", () => {
    expect(isOwnParty(own, "98765432000100", "Gralha Imóveis")).toBe(false);
  });
});

describe("isValidSuggestion", () => {
  const provider = meta({ id: "p1", role: "provider" });
  const client = meta({ id: "c1", role: "client" });
  const amendment = meta({ id: "a1", role: "provider", document_kind: "amendment" });

  it("aceita compra → prestação", () => {
    expect(
      isValidSuggestion({ pending_id: "c1", target_id: "p1", kind: "parent" }, client, provider),
    ).toBe(true);
  });
  it("recusa prestação → prestação", () => {
    expect(
      isValidSuggestion({ pending_id: "p1", target_id: "p2", kind: "parent" }, provider, {
        ...provider,
        id: "p2",
      }),
    ).toBe(false);
  });
  it("aceita aditivo → principal do mesmo papel", () => {
    expect(
      isValidSuggestion(
        { pending_id: "a1", target_id: "p1", kind: "amendment" },
        amendment,
        provider,
      ),
    ).toBe(true);
  });
  it("recusa aditivo → principal de papel diferente", () => {
    expect(
      isValidSuggestion(
        { pending_id: "a1", target_id: "c1", kind: "amendment" },
        amendment,
        client,
      ),
    ).toBe(false);
  });
  it("recusa vínculo consigo mesmo e ids inexistentes", () => {
    expect(
      isValidSuggestion({ pending_id: "p1", target_id: "p1", kind: "parent" }, provider, provider),
    ).toBe(false);
    expect(
      isValidSuggestion({ pending_id: "p1", target_id: "x", kind: "parent" }, provider, undefined),
    ).toBe(false);
  });
});

describe("dedupeSuggestions", () => {
  const base: LinkSuggestion = {
    pending_id: "c1",
    target_id: "p1",
    kind: "parent",
    confidence: "low",
    reason: "ia",
    source: "ai",
  };

  it("mantém a de maior confiança por pendência", () => {
    const out = dedupeSuggestions([
      base,
      { ...base, target_id: "p2", confidence: "high", reason: "regra", source: "rule" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].target_id).toBe("p2");
  });

  it("prefere regra determinística em empate", () => {
    const out = dedupeSuggestions([
      { ...base, confidence: "medium" },
      { ...base, target_id: "p3", confidence: "medium", source: "rule" },
    ]);
    expect(out[0].source).toBe("rule");
  });
});

describe("coerência de papel", () => {
  const stored = meta({
    id: "x1",
    role: "client", // gravado errado
    contracting_name: "CITEL",
    contracting_cnpj: "51.212.892/0001-25",
    counterparty_name: "WK Technology Ltda",
    counterparty_cnpj: "12.345.678/0001-90",
  });

  it("infere prestação quando a nossa empresa é a CONTRATADA", () => {
    expect(inferRoleFromParties(stored, own)).toBe("provider");
    expect(roleMismatch(stored, own)).toBe(true);
    expect(effectiveRole(stored, own)).toBe("provider");
  });

  it("não infere nada sem empresas do workspace", () => {
    expect(inferRoleFromParties(stored, [])).toBeNull();
    expect(roleMismatch(stored, [])).toBe(false);
    expect(effectiveRole(stored, [])).toBe("client");
  });

  it("recusa par em que somos CONTRATADA nos dois contratos", () => {
    const other = meta({
      id: "x2",
      role: "provider",
      contracting_name: "CITEL",
      contracting_cnpj: "51.212.892/0001-25",
      counterparty_name: "WK Technology Ltda",
      counterparty_cnpj: "12.345.678/0001-90",
    });
    expect(
      isValidSuggestion({ pending_id: "x1", target_id: "x2", kind: "parent" }, stored, other, own),
    ).toBe(false);
    // sem as entidades próprias, o papel gravado ainda formava par "válido"
    expect(
      isValidSuggestion({ pending_id: "x1", target_id: "x2", kind: "parent" }, stored, other),
    ).toBe(true);
  });

  it("marca role_conflict nas evidências", () => {
    const target = meta({ id: "x3", role: "provider" });
    const ev = buildSuggestionEvidence(stored, target, own);
    expect(ev.role_conflict).toBe(true);
    expect(ev.pending.role_inferred).toBe("provider");
  });
});
