import { describe, expect, it } from "vitest";
import { hasCallAudience, parseManualPhones } from "./call-audience";

const st = {
  mode: "manual" as const,
  queueId: "",
  base: "leads" as const,
  groups: [],
  groupsLogic: "or" as const,
  recentOverrides: [],
  excludeCustomers: true,
  excludeOpenDeals: true,
  commercialOverrides: [],
};
describe("público da campanha de ligação", () => {
  it("lista manual pega o telefone de cada linha e completa +55", () => {
    expect(parseManualPhones("48 99999-1111,João\n+5511988887777\n123\n4899999111 1")).toEqual([
      "+5548999991111",
      "+5511988887777",
    ]);
  });
  it("lista manual vazia não conta como público", () => {
    expect(hasCallAudience({ state: st, manualRaw: "" })).toBe(false);
  });
  it("fila só conta com fila escolhida", () => {
    expect(hasCallAudience({ state: { ...st, mode: "queue", queueId: "q" }, manualRaw: "" })).toBe(
      true,
    );
  });
});
