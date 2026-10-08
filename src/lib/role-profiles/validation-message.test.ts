import { describe, expect, it } from "vitest";
import { ProfileDataZ } from "./schema";
import { parseFriendly } from "./validation-message";

const base = {
  outsourcing: {
    allocation_months: 3,
    dedication: "full",
    hours_per_week: 40,
    management: "client",
    start_policy: "nada a declarar",
    replacement_policy: "nada a declarar",
  },
  selection: {
    stages: ["nada a declarar"],
    evaluators: "nada a declarar",
    criteria: "nada a declarar",
    client_confirmation: true,
  },
};

describe("parseFriendly perfis", () => {
  it("aceita o perfil preenchido com textos livres", () => {
    expect(() => parseFriendly(ProfileDataZ, base)).not.toThrow();
  });
  it("nomeia o campo em português quando horas por semana passa de 60", () => {
    expect(() =>
      parseFriendly(ProfileDataZ, {
        ...base,
        outsourcing: { ...base.outsourcing, hours_per_week: 80 },
      }),
    ).toThrow("Horas por semana aceita no máximo 60");
  });
  it("não devolve JSON técnico para data inválida", () => {
    expect(() =>
      parseFriendly(ProfileDataZ, { ...base, conditions: { start_date: "01/11/2026" } }),
    ).toThrow("Início desejado está em formato inválido");
  });
});
