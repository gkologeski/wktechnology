import { describe, expect, it } from "vitest";
import { lastBusinessDayOfMonth } from "./date-business";

describe("lastBusinessDayOfMonth", () => {
  it("retorna o último dia quando é dia útil", () => {
    // 31/07/2026 é sexta-feira.
    expect(lastBusinessDayOfMonth(new Date(2026, 6, 10))).toBe("2026-07-31");
  });

  it("recua para sexta quando o último dia cai no fim de semana", () => {
    // 31/05/2026 é domingo → 29/05 (sexta).
    expect(lastBusinessDayOfMonth(new Date(2026, 4, 1))).toBe("2026-05-29");
    // 28/02/2026 é sábado → 27/02 (sexta).
    expect(lastBusinessDayOfMonth(new Date(2026, 1, 15))).toBe("2026-02-27");
  });
});
