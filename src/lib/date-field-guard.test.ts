/**
 * Guarda de regressão dos campos de data (docs/architecture/date-fields.md).
 *
 * Data única só por `DatePicker` / `IsoDatePicker` (skill date-picker-br);
 * data-hora só por `ActivityDateTimePicker` (mesma seleção de dia). Barra:
 * - `<input type="date">` / `type="datetime-local"` (literal ou dinâmico);
 * - calendário avulso (`@/components/ui/calendar`) fora dos componentes
 *   compartilhados.
 * Intervalos (DateRangePicker) e mês/ano/horário isolados ficam fora.
 * Exceção nova exige motivo aqui e no documento.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** Componentes que podem usar o calendário base diretamente. */
const CALENDAR_OWNERS = new Set([
  "src/components/date-picker.tsx",
  "src/components/date-range-picker.tsx",
  "src/components/date-range-filter.tsx",
  "src/components/ui/calendar.tsx",
]);

/** Exceções justificadas (arquivo → motivo). */
const ALLOWED: Record<string, string> = {
  // Expressão regular que lê HTML de documento importado (não é tela).
  "src/lib/import/document-source.ts": "leitura de HTML de integração",
  // Comentário histórico do adaptador de intervalo.
  "src/components/iso-date-range-picker.tsx": "comentário; componente de intervalo",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p, out);
    } else if (
      /\.(tsx|ts)$/.test(name) &&
      !/\.test\.tsx?$/.test(name) &&
      !name.endsWith(".gen.ts")
    ) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(SRC).map((p) => ({ rel: relative(ROOT, p), src: readFileSync(p, "utf8") }));

const NATIVE_DATE = [
  /type\s*=\s*["']date["']/, // <input type="date">
  /type\s*=\s*\{\s*["']date["']\s*\}/, // type={"date"}
  /type\s*=\s*\{[^}]*\?\s*["']date["']/, // type={x ? "date" : ...}
  /["']datetime-local["']/, // data-hora nativa (literal ou dinâmico)
];

export function findDateFieldViolations(rel: string, src: string): string[] {
  if (ALLOWED[rel]) return [];
  const out: string[] = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const re of NATIVE_DATE) {
      if (re.test(line))
        out.push(
          `${rel}:${i + 1}: entrada de data nativa — use IsoDatePicker/ActivityDateTimePicker`,
        );
    }
  });
  if (!CALENDAR_OWNERS.has(rel) && /from\s+["']@\/components\/ui\/calendar["']/.test(src)) {
    out.push(`${rel}: calendário avulso — use DatePicker/DatePickerPanel`);
  }
  return out;
}

describe("guarda dos campos de data", () => {
  it("nenhuma tela usa entrada de data nativa nem calendário avulso", () => {
    const violations = files.flatMap((f) => findDateFieldViolations(f.rel, f.src));
    expect(violations).toEqual([]);
  });

  it("detecta as formas proibidas (inclusive dinâmicas)", () => {
    expect(findDateFieldViolations("x.tsx", '<Input type="date" value={v} />')).toHaveLength(1);
    expect(findDateFieldViolations("x.tsx", "<input type='date' />")).toHaveLength(1);
    expect(
      findDateFieldViolations("x.tsx", '<Input type={f.type === "date" ? "date" : "text"} />'),
    ).toHaveLength(1);
    expect(findDateFieldViolations("x.tsx", 'const t = "datetime-local";')).toHaveLength(1);
    expect(
      findDateFieldViolations("x.tsx", 'import { Calendar } from "@/components/ui/calendar";'),
    ).toHaveLength(1);
  });

  it("não barra intervalos, mês/horário isolados nem textos que falam de data", () => {
    expect(findDateFieldViolations("x.tsx", "<DateRangePicker value={r} />")).toEqual([]);
    expect(findDateFieldViolations("x.tsx", '<Input type="month" />')).toEqual([]);
    expect(findDateFieldViolations("x.tsx", '<Input type="time" />')).toEqual([]);
    expect(findDateFieldViolations("x.tsx", '{ name: "due", type: "date" }')).toEqual([]);
    expect(findDateFieldViolations("x.tsx", '// antes: <input type="date">')).toEqual([]);
    expect(
      findDateFieldViolations(
        "src/components/date-picker.tsx",
        'import { Calendar } from "@/components/ui/calendar";',
      ),
    ).toEqual([]);
  });

  it("toda exceção tem motivo", () => {
    for (const [file, why] of Object.entries(ALLOWED)) {
      expect(why.length, file).toBeGreaterThan(5);
    }
  });
});
