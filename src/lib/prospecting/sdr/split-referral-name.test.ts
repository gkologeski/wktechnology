import { describe, expect, it } from "vitest";
import { splitReferralName } from "./third-party";

describe("splitReferralName", () => {
  it("remove empresa e cargo do cartão", () => {
    expect(splitReferralName("Thiago City Gerente TI", "City Connect BR")).toEqual({
      name: "Thiago",
      role: "Gerente TI",
    });
  });
  it("preserva sobrenome real", () => {
    expect(splitReferralName("Daniel Flamia", "Acme Ltda")).toEqual({ name: "Daniel Flamia", role: null });
  });
  it("sem empresa retira só o cargo", () => {
    expect(splitReferralName("Ana Souza Diretora de TI")).toEqual({ name: "Ana Souza", role: "Diretora de TI" });
  });
});
