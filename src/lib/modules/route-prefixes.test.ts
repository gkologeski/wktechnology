import { describe, expect, it } from "vitest";
import { ATS_SIDEBAR_GROUPS } from "../menu-config-ats";
import { detectModuleFromPath } from "./active-module";

describe("identificação leve dos módulos", () => {
  it("cobre os itens internos e filhos do menu ATS", () => {
    for (const group of ATS_SIDEBAR_GROUPS) {
      for (const item of group.items) {
        for (const link of [item, ...(item.children ?? [])]) {
          if (link.external || !link.url?.startsWith("/")) continue;
          expect(detectModuleFromPath(link.url)).toBe("ats");
          expect(detectModuleFromPath(`${link.url}/fixture`)).toBe("ats");
        }
      }
    }
  });
  it("não captura o portal público nem prefixos parecidos", () => {
    expect(detectModuleFromPath("/careers")).toBeNull();
    expect(detectModuleFromPath("/jobs-other")).toBeNull();
    expect(detectModuleFromPath("/workspace")).toBeNull();
    expect(detectModuleFromPath("/services/fixture")).toBe("contracts");
  });
});
