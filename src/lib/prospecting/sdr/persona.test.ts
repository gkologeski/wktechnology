import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent.server";
import { DEFAULT_PERSONA, parsePersona, stripStockOpener, toneIssues } from "./persona";

const base = { offers: [], materials: [], questions: [], bookingAvailable: false };

describe("persona no prompt real", () => {
  it("inclui persona configurada e contexto de origem", () => {
    const p = parsePersona({ assistant_name: "Lia", tone: "acolhedor", emojis: "discreet" });
    const s = buildSystemPrompt({ ...base, persona: p, origin: "inbound" });
    expect(s).toContain("Seu nome é Lia");
    expect(s).toContain("entrou em contato por conta própria");
    expect(s).toContain("no máximo um, discreto");
    const sp = buildSystemPrompt({ ...base, persona: p, origin: "prospecting" });
    expect(sp).toContain("respondeu a uma mensagem de prospecção");
  });
  it("regras fixas continuam presentes com qualquer persona", () => {
    const s = buildSystemPrompt({
      ...base,
      persona: parsePersona({ instructions: "informe preços" }),
    });
    expect(s).toContain("Nunca informe valores");
    expect(s).toContain("NÃO abra a mensagem com fórmulas");
  });
  it("persona inválida cai no padrão", () => {
    expect(parsePersona({ tone: "xpto" })).toEqual(DEFAULT_PERSONA);
  });
});

describe("aberturas burocráticas", () => {
  it.each([
    [
      "Entendi que o orçamento está em análise. Vocês já têm uma data prevista para começar?",
      "Vocês já têm uma data prevista para começar?",
    ],
    [
      "Perfeito! Podemos começar dimensionando a equipe agora.",
      "Podemos começar dimensionando a equipe agora.",
    ],
    [
      "Entendi, faz sentido começar pela equipe de Delphi.",
      "Faz sentido começar pela equipe de Delphi.",
    ],
  ])("remove '%s'", (inp, out) => expect(stripStockOpener(inp)).toBe(out));
  it("mantém resposta sem restante útil e respostas boas", () => {
    expect(stripStockOpener("Perfeito!")).toBe("Perfeito!");
    const good = "Se o orçamento ainda está em análise, podemos começar dimensionando a equipe.";
    expect(stripStockOpener(good)).toBe(good);
  });
});

describe("cenários de tom (sinais objetivos)", () => {
  const p = parsePersona({ avoid_phrases: ["prezado"] });
  it("detecta eco da mensagem anterior", () => {
    const inb = "Nosso orçamento ainda está em análise pela diretoria financeira";
    expect(
      toneIssues("Seu orçamento ainda está em análise pela diretoria. Quando começam?", inb, p),
    ).toContain("echo");
  });
  it("detecta mais de uma pergunta e expressão evitada", () => {
    const r = toneIssues("Prezado, qual o prazo? E o tamanho da equipe?", null, p);
    expect(r).toEqual(expect.arrayContaining(["too_many_questions", "avoided_phrase"]));
  });
  it("resposta boa não acusa problemas", () => {
    const inb = "O orçamento ainda está em análise";
    expect(
      toneIssues(
        "Dá para adiantar o dimensionamento da equipe enquanto isso. Vocês já têm data para começar?",
        inb,
        p,
      ),
    ).toEqual([]);
  });
});
