import { describe, expect, it } from "vitest";
import { EDUCATION_OPTIONS, isLegacyValue, nextSeniority } from "./person-field-options";

describe("person field options", () => {
  it("marca valor digitado à mão como anterior", () => {
    expect(isLegacyValue("SUPERIOR COMPLETO", EDUCATION_OPTIONS)).toBe(true);
    expect(isLegacyValue("Superior completo", EDUCATION_OPTIONS)).toBe(false);
    expect(isLegacyValue("", EDUCATION_OPTIONS)).toBe(false);
  });
  it("senioridade do cargo só preenche quando vazia", () => {
    expect(nextSeniority("", "senior")).toBe("Sênior");
    expect(nextSeniority("Pleno", "senior")).toBe("Pleno");
  });
});
