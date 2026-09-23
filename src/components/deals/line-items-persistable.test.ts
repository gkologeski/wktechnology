import { describe, expect, it } from "vitest";

import { persistableFields } from "./use-line-items";

describe("persistableFields", () => {
  it("descarta rótulos de exibição que não são colunas", () => {
    const out = persistableFields({
      contracting_preset_id: "preset-1",
      preset_name: "Desenvolvedor Java Sr",
      service_name: "Outsourcing de TI",
      job_profile_name: "Desenvolvedor Java",
      service: { name: "Outsourcing de TI" },
      preset: { name: "Desenvolvedor Java Sr" },
    });
    expect(out).toEqual({ contracting_preset_id: "preset-1" });
  });

  it("preserva o vínculo do preset e os campos que ele preenche", () => {
    const out = persistableFields({
      contracting_preset_id: "preset-1",
      job_profile_id: "job-1",
      seniority: "senior",
      unit: "hora",
      billing_model: "per_hour",
      unit_price: 106.25,
      preset_name: "Desenvolvedor Java Sr",
    });
    expect(out).toEqual({
      contracting_preset_id: "preset-1",
      job_profile_id: "job-1",
      seniority: "senior",
      unit: "hora",
      billing_model: "per_hour",
      unit_price: 106.25,
    });
  });

  it("mantém valores nulos ao limpar o preset", () => {
    const out = persistableFields({
      contracting_preset_id: null,
      job_profile_id: null,
      seniority: null,
      preset_name: null,
    });
    expect(out).toEqual({
      contracting_preset_id: null,
      job_profile_id: null,
      seniority: null,
    });
  });
});
