import { describe, expect, it } from "vitest";
import { renderTokens } from "./message-tokens";

describe("renderTokens", () => {
  it("resolve chaves simples", () => {
    expect(renderTokens("Olá {{first_name}}!", { first_name: "Ana" })).toBe("Olá Ana!");
  });

  it("resolve chaves com ponto em objetos aninhados", () => {
    const out = renderTokens("Att, {{agent.name}} ({{agent.email}})", {
      agent: { name: "Bruno", email: "bruno@wk.com" },
    });
    expect(out).toBe("Att, Bruno (bruno@wk.com)");
  });

  it("resolve chaves com ponto declaradas de forma plana", () => {
    expect(renderTokens("Vaga: {{job.title}}", { "job.title": "Dev" })).toBe("Vaga: Dev");
  });

  it("tolera espaços e substitui ausentes por vazio", () => {
    expect(renderTokens("[{{ company }}]", {})).toBe("[]");
  });
});

describe("renderTokens por superfície", () => {
  it("e-mail: contato + remetente", () => {
    const out = renderTokens("Olá {{first_name}}, sou {{agent.name}} ({{agent.email}}).", {
      first_name: "Ana",
      agent: { name: "Bruno", email: "bruno@wk.com" },
    });
    expect(out).toBe("Olá Ana, sou Bruno (bruno@wk.com).");
  });

  it("ATS: chaves da interface e aliases legados", () => {
    const vars = {
      candidate_name: "Ana Souza",
      job_title: "Dev",
      stage: "Entrevista",
      "candidate.full_name": "Ana Souza",
      "candidate.first_name": "Ana",
      "job.title": "Dev",
      "company.name": "WK",
    };
    expect(renderTokens("{{candidate.first_name}} — {{job.title}} @ {{company.name}}", vars)).toBe(
      "Ana — Dev @ WK",
    );
    expect(renderTokens("{{candidate_name}} / {{job_title}} / {{stage}}", vars)).toBe(
      "Ana Souza / Dev / Entrevista",
    );
  });

  it("campanha: {{name}} e alias de empresa", () => {
    expect(renderTokens("Oi {{name}} da {{company}}", { name: "Ana", company: "WK" })).toBe(
      "Oi Ana da WK",
    );
  });

  it("macro de atendimento", () => {
    const out = renderTokens("{{contact_first_name}}, sobre {{ticket_subject}} — {{agent_name}}", {
      contact_first_name: "Ana",
      ticket_subject: "Fatura",
      agent_name: "Bruno",
    });
    expect(out).toBe("Ana, sobre Fatura — Bruno");
  });

  it("WhatsApp texto livre: token sem valor no contexto resolve para vazio", () => {
    // Variáveis posicionais ({{1}}) pertencem a templates oficiais, não ao
    // texto livre — se aparecerem aqui, saem vazias em vez de literais.
    expect(renderTokens("Olá {{first_name}} {{1}}", { first_name: "Ana" })).toBe("Olá Ana ");
  });
});

describe("sequências (vendas e sourcing ATS)", () => {
  it("vendas: contato + remetente no assunto e corpo", () => {
    const ctx = {
      first_name: "Ana",
      last_name: "Souza",
      full_name: "Ana Souza",
      company: "WK",
      agent: { name: "Bruno", email: "bruno@wk.com" },
    };
    expect(renderTokens("Proposta para {{company}}", ctx)).toBe("Proposta para WK");
    expect(renderTokens("Olá {{first_name}}, {{agent.name}}", ctx)).toBe("Olá Ana, Bruno");
  });

  it("sourcing ATS: candidato sem vaga vinculada", () => {
    const ctx = {
      first_name: "Ana",
      headline: "Dev Sênior",
      "candidate.full_name": "Ana Souza",
      agent: { name: "Bruno", email: null },
    };
    expect(renderTokens("{{candidate.full_name}} — {{headline}}", ctx)).toBe("Ana Souza — Dev Sênior");
    expect(renderTokens("[{{job.title}}]", ctx)).toBe("[]");
  });
});
