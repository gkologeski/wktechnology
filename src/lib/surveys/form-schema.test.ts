import { describe, expect, it } from "vitest";
import {
  newField,
  scoreAnswers,
  validateAnswers,
  validateSchema,
  visibleFieldIds,
  type FormSchema,
} from "./form-schema";

const f = (type: Parameters<typeof newField>[0], extra = {}) => ({ ...newField(type), ...extra });

describe("pontuação opcional", () => {
  it("formulário livre só texto: enviado sem score", () => {
    const s: FormSchema = {
      version: 1,
      title: "Livre",
      scoringEnabled: false,
      fields: [f("short_text", { id: "a", required: true })],
    };
    expect(validateAnswers(s, { a: "oi" })).toEqual({});
    expect(scoreAnswers(s, { a: "oi" }).score).toBeNull();
  });
  it("número/escala sem flag scored não gera score", () => {
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: true,
      fields: [f("number", { id: "n" }), f("nps", { id: "p" })],
    };
    expect(scoreAnswers(s, { n: 8, p: 9 })).toMatchObject({
      score: null,
      max: null,
      percent: null,
    });
  });
  it("misto soma só as pontuadas", () => {
    const choice = f("single_choice", {
      id: "c",
      scored: true,
      options: [
        { id: "1", label: "A", points: 10 },
        { id: "2", label: "B", points: 2 },
      ],
    });
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: true,
      fields: [
        choice,
        f("long_text", { id: "t" }),
        f("boolean", { id: "b", scored: true, weight: 5 }),
      ],
    };
    expect(scoreAnswers(s, { c: "B", t: "abc", b: true })).toEqual({
      score: 7,
      max: 15,
      percent: 47,
      scoredCount: 2,
    });
  });
  it("obrigatório e pontuado são independentes", () => {
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: true,
      fields: [f("boolean", { id: "b", scored: true, required: false })],
    };
    expect(validateAnswers(s, {})).toEqual({});
    expect(scoreAnswers(s, {}).score).toBe(0);
  });
  it("oculto obrigatório não impede envio e não entra no máximo", () => {
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: true,
      fields: [
        f("boolean", { id: "q" }),
        f("rating", {
          id: "r",
          required: true,
          scored: true,
          showIf: { mode: "all", rules: [{ fieldId: "q", op: "equals", value: "true" }] },
        }),
      ],
    };
    expect(validateAnswers(s, { q: false })).toEqual({});
    expect(scoreAnswers(s, { q: false }).score).toBeNull();
    expect(visibleFieldIds(s, { q: true }).has("r")).toBe(true);
    expect(validateAnswers(s, { q: true })).toHaveProperty("r");
  });
  it("matriz exige todas as linhas quando obrigatória", () => {
    const m = f("matrix", { id: "m", required: true });
    const s: FormSchema = { version: 1, title: "x", scoringEnabled: false, fields: [m] };
    expect(validateAnswers(s, { m: { [m.rows![0]!.id]: "Neutro" } })).toHaveProperty("m");
  });
  it("página pulada esconde seus campos", () => {
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: false,
      fields: [
        f("boolean", { id: "q" }),
        f("page_break", {
          id: "p",
          showIf: { mode: "any", rules: [{ fieldId: "q", op: "equals", value: "true" }] },
        }),
        f("short_text", { id: "z", required: true }),
      ],
    };
    expect(validateAnswers(s, { q: false })).toEqual({});
    expect(validateAnswers(s, { q: true })).toHaveProperty("z");
  });
  it("valida referência excluída e ordem (ciclo)", () => {
    const s: FormSchema = {
      version: 1,
      title: "x",
      scoringEnabled: false,
      fields: [
        f("short_text", {
          id: "a",
          showIf: { mode: "all", rules: [{ fieldId: "b", op: "filled" }] },
        }),
        f("short_text", { id: "b" }),
        f("short_text", {
          id: "c",
          showIf: { mode: "all", rules: [{ fieldId: "zz", op: "filled" }] },
        }),
      ],
    };
    const msgs = validateSchema(s).join("\n");
    expect(msgs).toMatch(/anteriores/);
    expect(msgs).toMatch(/excluído/);
  });
});
