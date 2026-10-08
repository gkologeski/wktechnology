import { describe, expect, it } from "vitest";
import { emptyData } from "@/lib/role-profiles/schema";
import { applyCommon, overwrittenBy } from "./apply-common";

describe("aplicar campos comuns", () => {
  it("copia a seção e avisa o que será sobrescrito", () => {
    const src = { ...emptyData(), conditions: { work_mode: "remote" as const } };
    const tgt = { ...emptyData(), conditions: { work_mode: "onsite" as const, location: "SP" } };
    expect(overwrittenBy(src, tgt, ["conditions"])).toEqual(["Condições"]);
    expect(applyCommon(src, tgt, ["conditions"]).conditions).toEqual({ work_mode: "remote" });
    expect(overwrittenBy(src, emptyData(), ["conditions"])).toEqual([]);
  });
  it("nunca copia honorários antigos", () => {
    const src = { ...emptyData(), hunting: { hiring_regime: "clt" as const, fee_value: 20 } };
    const out = applyCommon(src, emptyData(), ["hiring"]);
    expect(out.hunting.hiring_regime).toBe("clt");
    expect(out.hunting.fee_value).toBeUndefined();
  });
});
