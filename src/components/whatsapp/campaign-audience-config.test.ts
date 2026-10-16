import { describe, expect, it } from "vitest";
import { EMPTY_AUDIENCE, hydrateAudienceConfig, toAudienceConfig } from "./campaign-audience-panel";

describe("configuração do público salva na campanha", () => {
  it("relê grupos E/OU, variáveis com texto livre e reenvio", () => {
    const state = {
      ...EMPTY_AUDIENCE,
      mode: "filter" as const,
      base: "contacts" as const,
      groupsLogic: "and" as const,
      groups: [
        {
          logic: "and" as const,
          filters: [
            {
              entity: "companies" as const,
              column: "industry",
              op: "ilike" as const,
              value: "soft",
            },
          ],
        },
        {
          logic: "or" as const,
          filters: [
            { entity: "contacts" as const, column: "state", op: "eq" as const, value: "SC" },
          ],
        },
      ],
      variableMap: { "1": { field: "__free__", fallback: "Olá" } },
      recentDays: 14,
    };
    const back = hydrateAudienceConfig(JSON.parse(JSON.stringify(toAudienceConfig(state, "x"))));
    expect(back?.state.groupsLogic).toBe("and");
    expect(back?.state.groups).toHaveLength(2);
    expect(back?.state.variableMap["1"]).toEqual({ field: "__free__", fallback: "Olá" });
    expect(back?.state.recentDays).toBe(14);
    expect(back?.manualRaw).toBe("");
  });
  it("campanha antiga sem configuração vira null", () => {
    expect(hydrateAudienceConfig(null)).toBeNull();
    expect(hydrateAudienceConfig({ foo: 1 })).toBeNull();
  });
});
