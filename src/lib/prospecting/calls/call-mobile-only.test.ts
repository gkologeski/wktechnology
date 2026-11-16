import { describe, expect, it } from "vitest";
import { pickCallMobile } from "./call-audience";

describe("campanha de voz só disca celular", () => {
  it("descarta telefone fixo", () => {
    expect(pickCallMobile(["(11) 3040-1234"])).toEqual({ phone: null, landline: true });
  });
  it("escolhe o celular mesmo quando o fixo vem antes", () => {
    expect(pickCallMobile(["(11) 3040-1234", "(11) 98765-4321"]).phone).toBe("+5511987654321");
  });
});
