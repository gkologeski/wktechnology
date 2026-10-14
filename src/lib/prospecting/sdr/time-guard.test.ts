import { describe, expect, it } from "vitest";
import { extractTimes, unverifiedTimes } from "./time-guard";

describe("barreira de horários inventados", () => {
  it("normaliza formatos de hora", () => {
    expect(extractTimes("às 9h, 15:00 ou 16h30")).toEqual(["09:00", "15:00", "16:30"]);
  });
  it("datas não contam como hora", () => {
    expect(extractTimes("quinta, 15/10/2026")).toEqual([]);
  });
  it("hora que não veio da agenda é barrada", () => {
    const agenda = '{"label":"quinta-feira, 15/10/2026 às 14:00"}';
    expect(unverifiedTimes("Tenho 14:00 e 16:30", [agenda])).toEqual(["16:30"]);
    expect(unverifiedTimes("Tenho 14h", [agenda])).toEqual([]);
  });
});
