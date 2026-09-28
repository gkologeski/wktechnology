import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  followUpDate,
  followUpLabel,
  nextOccurrence,
} from "./activity-task-options";

describe("nextOccurrence", () => {
  const from = new Date(2026, 0, 31, 9);
  it("avança pela frequência", () => {
    expect(
      nextOccurrence({ frequency: "weekly", interval: 2, ends: "never" }, from)?.getDate(),
    ).toBe(14);
    expect(
      nextOccurrence({ frequency: "daily", interval: 1, ends: "never" }, from)?.getDate(),
    ).toBe(1);
  });
  it("respeita término", () => {
    expect(
      nextOccurrence(
        { frequency: "daily", interval: 1, ends: "on_date", end_date: "2026-01-31" },
        from,
      ),
    ).toBeNull();
    expect(
      nextOccurrence(
        { frequency: "daily", interval: 1, ends: "after", count: 3, occurrence: 3 },
        from,
      ),
    ).toBeNull();
    expect(
      nextOccurrence(
        { frequency: "daily", interval: 1, ends: "after", count: 3, occurrence: 2 },
        from,
      ),
    ).not.toBeNull();
  });
  it("descreve", () => {
    expect(describeRecurrence({ frequency: "monthly", interval: 1, ends: "after", count: 4 })).toBe(
      "Mensalmente, 4 vezes",
    );
  });
});

describe("followUpDate", () => {
  it("pula fim de semana em dias úteis", () => {
    const fri = new Date(2026, 8, 25, 22); // sexta
    expect(followUpDate("bd3", fri)?.getDay()).toBe(3); // quarta
    expect(followUpDate("bd3", fri)?.getHours()).toBe(8);
  });
});

describe("followUpLabel", () => {
  const now = new Date(2026, 8, 28, 14); // segunda-feira
  it("mostra dia abreviado e data", () => {
    expect(followUpLabel("today", now)).toBe("Hoje (Seg, 28/09/2026)");
    expect(followUpLabel("w2", now)).toBe("Em 2 semanas (Seg, 12/10/2026)");
    expect(followUpLabel("m1", now)).toBe("Em 1 mês (Qua, 28/10/2026)");
  });
  it("não acrescenta sufixo na data personalizada", () => {
    expect(followUpLabel("custom", now)).toBe("Data personalizada");
  });
});
