import { describe, it, expect } from "vitest";
import { isPhoneAllowlisted } from "./allowlist";
describe("allowlist", () => {
  const l = ["+5548991104003"];
  it("aceita com e sem nono dígito", () => {
    expect(isPhoneAllowlisted("+554891104003", l)).toBe(true);
    expect(isPhoneAllowlisted("5548991104003", l)).toBe(true);
  });
  it("recusa outros", () => expect(isPhoneAllowlisted("+5548991104004", l)).toBe(false));
  it("vazia libera", () => expect(isPhoneAllowlisted("+1", [])).toBe(true));
});
