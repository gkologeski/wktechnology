import { describe, expect, it } from "vitest";
import { formatCompactDate, formatCompactDateTime } from "@/lib/format/compact-date";

// Referência: 31/08/2026 12:00 em São Paulo (UTC-3).
const NOW = new Date("2026-08-31T15:00:00Z");

describe("formatCompactDateTime", () => {
  it("usa rótulos relativos", () => {
    expect(formatCompactDateTime("2026-08-31T21:00:00-03:00", "—", NOW)).toBe("Hoje às 21h");
    expect(formatCompactDateTime("2026-08-30T21:00:00-03:00", "—", NOW)).toBe("Ontem às 21h");
    expect(formatCompactDateTime("2026-08-29T21:00:00-03:00", "—", NOW)).toBe("Anteontem às 21h");
    expect(formatCompactDateTime("2026-09-01T09:00:00-03:00", "—", NOW)).toBe("Amanhã às 9h");
    expect(formatCompactDateTime("2026-09-02T09:15:00-03:00", "—", NOW)).toBe(
      "Depois de amanhã às 9h15min",
    );
  });

  it("usa dia/mês no mesmo ano e dia/mês/ano nos demais", () => {
    expect(formatCompactDateTime("2026-01-14T09:15:00-03:00", "—", NOW)).toBe("14/Jan às 9h15min");
    expect(formatCompactDateTime("2027-01-14T09:15:00-03:00", "—", NOW)).toBe(
      "14/Jan/27 às 9h15min",
    );
  });

  it("omite a hora em valores só-data", () => {
    expect(formatCompactDateTime("2026-08-31", "—", NOW)).toBe("Hoje");
    expect(formatCompactDateTime("2027-01-14", "—", NOW)).toBe("14/Jan/27");
  });

  it("retorna o fallback para valores vazios ou inválidos", () => {
    expect(formatCompactDateTime(null, "Sem data", NOW)).toBe("Sem data");
    expect(formatCompactDateTime("", "Sem data", NOW)).toBe("Sem data");
    expect(formatCompactDateTime("não-é-data", "Sem data", NOW)).toBe("Sem data");
  });
});

describe("formatCompactDate", () => {
  it("nunca inclui hora", () => {
    expect(formatCompactDate("2026-08-30T21:00:00-03:00", "—", NOW)).toBe("Ontem");
    expect(formatCompactDate("2027-01-14T09:15:00-03:00", "—", NOW)).toBe("14/Jan/27");
  });
});
