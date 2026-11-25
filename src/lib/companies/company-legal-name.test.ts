import { describe, expect, it } from "vitest";
import {
  applyPersonCnpjSuggestion,
  planCompanyCnpjEnrichment,
  resolveCompanyLegalName,
} from "./company-legal-name";

describe("resolveCompanyLegalName", () => {
  it("prioritizes native legal_name over legacy custom_fields.razao_social and name", () => {
    expect(
      resolveCompanyLegalName({
        name: "Nexid",
        legal_name: "NEXID TECNOLOGIA LTDA",
        custom_fields: { razao_social: "LEGADO LTDA" },
      }),
    ).toBe("NEXID TECNOLOGIA LTDA");
  });

  it("falls back to custom_fields.razao_social when native legal_name is absent", () => {
    expect(
      resolveCompanyLegalName({
        name: "ÓGEA",
        legal_name: null,
        custom_fields: { razao_social: "OGEA SERVICOS LTDA" },
      }),
    ).toBe("OGEA SERVICOS LTDA");
  });

  it("falls back to display name when neither legal_name nor custom razao_social exists", () => {
    expect(
      resolveCompanyLegalName({
        name: "WK Technology",
        legal_name: "   ",
        custom_fields: {},
      }),
    ).toBe("WK Technology");
  });

  it("returns null when company is missing or all names are empty", () => {
    expect(resolveCompanyLegalName(null)).toBeNull();
    expect(resolveCompanyLegalName({ name: "  ", legal_name: "" })).toBeNull();
  });
});

describe("planCompanyCnpjEnrichment", () => {
  it("populates legal_name and trade_name separately and never includes name", () => {
    const plan = planCompanyCnpjEnrichment(
      {
        legal_name: null,
        trade_name: null,
        city: null,
        state: null,
      },
      {
        legal_name: "GM KOLOGESKI & CIA LTDA",
        trade_name: "WK TECHNOLOGY",
        city: "PORTO ALEGRE",
        state: "RS",
      },
    );
    expect(plan.conflicts).toEqual([]);
    expect(plan.update).toEqual({
      legal_name: "GM KOLOGESKI & CIA LTDA",
      trade_name: "WK TECHNOLOGY",
      city: "PORTO ALEGRE",
      state: "RS",
    });
    expect("name" in plan.update).toBe(false);
  });

  it("reports conflicts without overwriting existing values unless overwrite is true", () => {
    const current = {
      legal_name: "RAZAO ANTIGA LTDA",
      trade_name: "FANTASIA ANTIGA",
      city: null,
    };
    const incoming = {
      legal_name: "RAZAO NOVA LTDA",
      trade_name: "FANTASIA NOVA",
      city: "CURITIBA",
    };

    const preview = planCompanyCnpjEnrichment(current, incoming, { overwrite: false });
    expect(preview.conflicts.map((c) => c.field)).toEqual(["legal_name", "trade_name"]);
    expect(preview.update).toEqual({ city: "CURITIBA" });

    const confirmed = planCompanyCnpjEnrichment(current, incoming, { overwrite: true });
    expect(confirmed.update).toEqual({
      legal_name: "RAZAO NOVA LTDA",
      trade_name: "FANTASIA NOVA",
      city: "CURITIBA",
    });
    expect("name" in confirmed.update).toBe(false);
  });

  it("ignores case-only differences as conflicts", () => {
    const plan = planCompanyCnpjEnrichment(
      { legal_name: "Nexid Tecnologia Ltda", trade_name: "Nexid" },
      { legal_name: "NEXID TECNOLOGIA LTDA", trade_name: "NEXID" },
    );
    expect(plan.conflicts).toEqual([]);
    expect(plan.update).toEqual({});
  });
});

describe("applyPersonCnpjSuggestion", () => {
  it("fills empty PJ fields without conflicts", () => {
    const res = applyPersonCnpjSuggestion(
      { legal_entity_name: "", trade_name: "" },
      { legal_entity_name: "AM IT SERVICOS EM INFORMATICA LTDA", trade_name: "AM IT" },
    );
    expect(res.changed).toBe(true);
    expect(res.conflicts).toEqual([]);
    expect(res.next).toEqual({
      legal_entity_name: "AM IT SERVICOS EM INFORMATICA LTDA",
      trade_name: "AM IT",
    });
  });

  it("preserves existing field when lookup returns empty and flags real conflicts", () => {
    const res = applyPersonCnpjSuggestion(
      { legal_entity_name: "EMPRESA ANTIGA LTDA", trade_name: "NOME MANUAL" },
      { legal_entity_name: "EMPRESA NOVA LTDA", trade_name: "" },
    );
    expect(res.changed).toBe(true);
    expect(res.conflicts).toEqual([
      {
        field: "legal_entity_name",
        label: "Razão social",
        current: "EMPRESA ANTIGA LTDA",
        incoming: "EMPRESA NOVA LTDA",
      },
    ]);
    expect(res.next).toEqual({
      legal_entity_name: "EMPRESA NOVA LTDA",
      trade_name: "NOME MANUAL",
    });
  });
});
