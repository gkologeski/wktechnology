import { describe, expect, it } from "vitest";
import { describeDeliveryError } from "./delivery-error";

describe("describeDeliveryError", () => {
  it("131026 → número sem WhatsApp", () => {
    expect(describeDeliveryError("131026", "Message undeliverable").label).toBe(
      "Não entregue: número sem WhatsApp ou inativo",
    );
  });
  it("131049 → bloqueio de engajamento", () => {
    expect(describeDeliveryError("131049", "x").label).toBe(
      "Não entregue: bloqueada pela Meta para preservar o engajamento",
    );
  });
  it("código desconhecido usa a mensagem original", () => {
    expect(describeDeliveryError("999", "Algo").label).toBe("Não entregue: Algo");
  });
  it("sem código nem mensagem", () => {
    expect(describeDeliveryError(null, null).label).toBe("Não entregue: motivo não informado");
  });
  it("detalhe traz código e texto original", () => {
    expect(describeDeliveryError("131042", "Business eligibility payment issue").detail).toBe(
      "Código 131042 — Business eligibility payment issue",
    );
  });
});
