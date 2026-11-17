import { describe, expect, it } from "vitest";
import { buildSenderRotation, pickSender } from "./campaign-sender-rotation";

const A = "111111",
  B = "222222",
  C = "333333";

describe("rodízio de números remetentes", () => {
  it("limita a 5 números, sem duplicar, principal primeiro", () => {
    expect(buildSenderRotation(A, [B, A, C, "444444", "555555", "666666"])).toEqual([
      A,
      B,
      C,
      "444444",
      "555555",
    ]);
    expect(buildSenderRotation(null, [B])).toEqual([]);
  });

  it("intercala em sequência entre os números", () => {
    const all = new Set([A, B, C]);
    const got = [0, 1, 2, 3].map((s) => pickSender([A, B, C], all, "sequential", s, 0));
    expect(got.map((g) => (g.kind === "ok" ? g.sender : null))).toEqual([A, B, C, A]);
  });

  it("contato preso ao número continua nele e nunca troca", () => {
    expect(pickSender([A, B], new Set([A, B]), "sequential", 0, 0, B)).toEqual({
      kind: "ok",
      sender: B,
      fixedNow: false,
    });
    expect(pickSender([A, B], new Set([A]), "sequential", 0, 0, B)).toEqual({
      kind: "fixed_unavailable",
      sender: B,
    });
  });

  it("número indisponível sai do rodízio para contatos novos", () => {
    const p = pickSender([A, B], new Set([B]), "sequential", 0, 0);
    expect(p).toEqual({ kind: "ok", sender: B, fixedNow: true });
    expect(pickSender([A, B], new Set(), "sequential", 0, 0)).toEqual({ kind: "none" });
  });

  it("sorteio escolhe entre os disponíveis", () => {
    const p = pickSender([A, B], new Set([A, B]), "random", 0, 0.9);
    expect(p).toEqual({ kind: "ok", sender: B, fixedNow: true });
  });
});
