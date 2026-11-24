import { describe, expect, it } from "vitest";
import { nextCopyName } from "./copy-name";

describe("nextCopyName", () => {
  it("appends (cópia) when no copy exists yet", () => {
    expect(nextCopyName("Proposta Padrão", ["Proposta Padrão"])).toBe("Proposta Padrão (cópia)");
  });

  it("numbers copies sequentially when copies already exist", () => {
    expect(
      nextCopyName("Proposta Padrão", [
        "Proposta Padrão",
        "Proposta Padrão (cópia)",
        "Proposta Padrão (cópia 2)",
      ]),
    ).toBe("Proposta Padrão (cópia 3)");
  });

  it("avoids stacking copy suffixes when duplicating an existing copy", () => {
    expect(
      nextCopyName("Proposta Padrão (cópia)", ["Proposta Padrão", "Proposta Padrão (cópia)"]),
    ).toBe("Proposta Padrão (cópia 2)");
  });

  it("matches existing names case-insensitively", () => {
    expect(nextCopyName("Consultoria", ["CONSULTORIA (CÓPIA)"])).toBe("Consultoria (cópia 2)");
  });

  it("respects the maximum length limit of 200 characters", () => {
    const longName = "A".repeat(200);
    const result = nextCopyName(longName, [longName], 200);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(" (cópia)")).toBe(true);
  });
});
