import { it, expect } from "vitest";
import { mergeTemplateBody } from "@/lib/contracts/template-tokens";
it("x", () => {
  expect(
    mergeTemplateBody(
      "{{contract.total_value}} ({{contract.total_value_extenso}})",
      { contract: { total_value: "R$ 18.870,00" } },
      { strict: true },
    ),
  ).toBe("R$ 18.870,00 (dezoito mil, oitocentos e setenta reais)");
});
