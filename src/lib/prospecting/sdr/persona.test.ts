import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent.server";
import { DEFAULT_PERSONA, parsePersona, toneIssues } from "./persona";

const base = { offers: [], materials: [], questions: [], bookingAvailable: false };

describe("persona no prompt real", () => {
  it("inclui a persona configurada e a origem verificável", () => {
    const p = parsePersona({ assistant_name: "Lia", tone: "acolhedor", emojis: "discreet" });
    const s = buildSystemPrompt({ ...base, persona: p, origin: "inbound" });
    expect(s).toContain("Nome: Lia");
    expect(s).toContain("Origem: receptivo");
    expect(s).toContain("Emojis: discretos permitidos");
    const sp = buildSystemPrompt({ ...base, persona: p, origin: "prospecting" });
    expect(sp).toContain("Origem: campanha de prospecção");
  });
  it("persona entra na íntegra, sem regras de estilo/comerciais fixas no código", () => {
    const instructions = "Prefira 1 a 3 frases. Não informe valores.";
    const s = buildSystemPrompt({ ...base, persona: parsePersona({ instructions }) });
    expect(s).toContain(instructions);
    expect(s).not.toContain("REGRAS FIXAS");
    expect(s).not.toContain("NÃO abra a mensagem com fórmulas");
    expect(s).not.toContain("WK Sob Medida");
    expect(s).not.toContain("pesquisa em bases comerciais");
    expect(s).toContain("CONTRATO TÉCNICO");
    expect(s).toContain("PRECEDÊNCIA");
  });
  it("persona inválida cai no padrão", () => {
    expect(parsePersona({ tone: "xpto" }).tone).toBe(DEFAULT_PERSONA.tone);
  });
  it("aceita textos longos nos campos de persona", () => {
    const long = "a".repeat(1800);
    const p = parsePersona({
      description: long,
      goal: long,
      collect: long,
      handoff_when: long,
      instructions: "b".repeat(7000),
      good_examples: ["c".repeat(900)],
    });
    expect(p.description).toHaveLength(1800);
    expect(p.goal).toHaveLength(1800);
    expect(p.collect).toHaveLength(1800);
    expect(p.handoff_when).toHaveLength(1800);
    expect(p.instructions).toHaveLength(7000);
    expect(p.good_examples[0]).toHaveLength(900);
  });
  it("campo acima do limite não apaga o resto da persona", () => {
    const p = parsePersona({ assistant_name: "Lia", description: "x".repeat(3000) });
    expect(p.assistant_name).toBe("Lia");
    expect(p.description).toBe("");
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
