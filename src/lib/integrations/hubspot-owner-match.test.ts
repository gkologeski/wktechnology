import { describe, expect, it } from "vitest";
import { decideProvision, isHubspotBotEmail, normalizePersonKey } from "./hubspot-owner-match";

const users = {
  byEmail: new Map([["ana@x.com", "u1"]]),
  byName: new Map([["sabrina maciel", "u2"]]),
};

describe("hubspot owner match", () => {
  it("normaliza nome", () =>
    expect(normalizePersonKey("  Maurício  MACIEL ")).toBe("mauricio maciel"));
  it("detecta robô", () => expect(isHubspotBotEmail("1@aichatbot.na1.hubspot.com")).toBe(true));
  it("liga por e-mail", () =>
    expect(
      decideProvision({ email: "ANA@x.com", first_name: null, last_name: null }, users),
    ).toEqual({
      kind: "link",
      userId: "u1",
    }));
  it("liga por nome", () =>
    expect(
      decideProvision({ email: "s@y.com", first_name: "Sabrina", last_name: "Maciel" }, users),
    ).toEqual({ kind: "link", userId: "u2" }));
  it("cria quando não existe", () =>
    expect(
      decideProvision({ email: "n@y.com", first_name: "Novo", last_name: null }, users),
    ).toEqual({
      kind: "create",
      email: "n@y.com",
      fullName: "Novo",
    }));
  it("ignora sem e-mail e robôs", () => {
    expect(decideProvision({ email: null, first_name: "X", last_name: null }, users).kind).toBe(
      "skip",
    );
    expect(
      decideProvision(
        { email: "1@aichatbot.na1.hubspot.com", first_name: "T", last_name: null },
        users,
      ).kind,
    ).toBe("skip");
  });
});
