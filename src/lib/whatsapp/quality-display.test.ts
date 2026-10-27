import { describe, expect, it } from "vitest";
import { qualityDisplay } from "./quality-display";

describe("qualityDisplay", () => {
  it("GREEN é alta", () => expect(qualityDisplay("GREEN")).toEqual({ label: "Qualidade alta", tone: "open" }));
  it("YELLOW é média", () => expect(qualityDisplay("YELLOW").tone).toBe("onhold"));
  it("RED é baixa", () => expect(qualityDisplay("RED").tone).toBe("closed"));
  it("desconhecida é não avaliada", () => expect(qualityDisplay("UNKNOWN").tone).toBe("draft"));
});
