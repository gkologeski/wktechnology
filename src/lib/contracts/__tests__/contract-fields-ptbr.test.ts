// Garante que nenhum campo ou valor de contrato apareça em inglês na interface
// e que a mescla de padrões respeite a precedência definida.
import { describe, expect, it } from "vitest";
import {
  CONTRACT_FIELDS,
  DEFAULTABLE_CONTRACT_FIELDS,
  fieldsForKind,
} from "../contract-field-catalog";
import { CONTRACT_FIELD_LABELS, CONTRACT_FIELD_OPTIONS } from "../workflow-field-meta";
import { applyDefaults, effectiveDefaults, sanitizeDefaults } from "../contract-defaults-shared";
import { columnsToKind, kindToColumns } from "../contract-kinds";

describe("catálogo de campos de contrato", () => {
  it("todo campo tem rótulo em português (nunca o nome da coluna)", () => {
    for (const field of CONTRACT_FIELDS) {
      expect(field.label, field.name).not.toBe(field.name);
      expect(CONTRACT_FIELD_LABELS[field.name], field.name).toBeTruthy();
    }
  });

  it("todo combo tem opções e nenhum rótulo igual ao valor cru em inglês", () => {
    for (const field of CONTRACT_FIELDS.filter((f) => f.type === "select")) {
      expect(field.options?.length, field.name).toBeGreaterThan(0);
    }
    for (const [name, options] of Object.entries(CONTRACT_FIELD_OPTIONS)) {
      for (const option of options) {
        expect(option.label.trim(), `${name}.${option.value}`).not.toBe("");
      }
    }
  });

  it("aditivo mostra os campos de vínculo; prestação não", () => {
    const amendment = fieldsForKind("amendment").map((f) => f.name);
    const provider = fieldsForKind("provider").map((f) => f.name);
    expect(amendment).toContain("parent_contract_id");
    expect(provider).not.toContain("parent_contract_id");
  });
});

describe("tipos de documento", () => {
  it("converte ida e volta entre a escolha do usuário e as colunas", () => {
    expect(kindToColumns("provider")).toEqual({ document_kind: "main", role: "provider" });
    expect(kindToColumns("client")).toEqual({ document_kind: "main", role: "client" });
    expect(kindToColumns("amendment", "client")).toEqual({
      document_kind: "amendment",
      role: "client",
    });
    expect(columnsToKind("main", "client")).toBe("client");
    expect(columnsToKind("amendment", "provider")).toBe("amendment");
  });
});

describe("padrões de contrato", () => {
  it("ignora campos que não são configuráveis e valores vazios", () => {
    const clean = sanitizeDefaults({ currency: "BRL", title: "x", payment_method: "  " });
    expect(clean).toEqual({ currency: "BRL" });
    expect(DEFAULTABLE_CONTRACT_FIELDS.map((f) => f.name)).toContain("currency");
  });

  it("padrão do tipo sobrescreve o padrão geral", () => {
    const bundle = {
      general: { currency: "BRL", payment_method: "pix" },
      byKind: { client: { payment_method: "boleto" } },
    };
    expect(effectiveDefaults(bundle, "client").payment_method).toBe("boleto");
    expect(effectiveDefaults(bundle, "provider").payment_method).toBe("pix");
  });

  it("não sobrescreve o que já foi preenchido", () => {
    const merged = applyDefaults(
      { currency: "USD", payment_method: null },
      {
        currency: "BRL",
        payment_method: "pix",
      },
    );
    expect(merged).toEqual({ currency: "USD", payment_method: "pix" });
  });
});
