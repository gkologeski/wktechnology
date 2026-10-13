import { describe, expect, it } from "vitest";
import { composerPolicy } from "./composer-policy";
import { checkTemplateVariables, describeTemplate } from "./template-shape";

const base = {
  channelReady: true,
  windowChecking: false,
  windowError: false,
  withinWindow: null as boolean | null,
  templateRequiredByServer: false,
  templates: null as { approved: boolean }[] | null,
  templatesLoading: false,
  templatesError: false,
};

describe("política do compositor de WhatsApp", () => {
  it("libera texto livre apenas dentro da janela de 24 horas", () => {
    const p = composerPolicy({ ...base, withinWindow: true });
    expect(p.windowState).toBe("open");
    expect(p.freeTextAllowed).toBe(true);
    expect(p.templateRequired).toBe(false);
    expect(p.aiComposeAllowed).toBe(true);
  });

  it("fora da janela exige modelo e bloqueia texto livre e IA", () => {
    const p = composerPolicy({ ...base, withinWindow: false });
    expect(p.windowState).toBe("closed");
    expect(p.freeTextAllowed).toBe(false);
    expect(p.templateRequired).toBe(true);
    expect(p.aiComposeAllowed).toBe(false);
  });

  it("recusa do servidor força o modo modelo mesmo sem resposta da janela", () => {
    const p = composerPolicy({ ...base, withinWindow: true, templateRequiredByServer: true });
    expect(p.windowState).toBe("closed");
    expect(p.freeTextAllowed).toBe(false);
  });

  it("enquanto verifica ou em erro não libera texto livre", () => {
    expect(composerPolicy({ ...base, windowChecking: true }).freeTextAllowed).toBe(false);
    const err = composerPolicy({ ...base, windowError: true });
    expect(err.windowState).toBe("error");
    expect(err.freeTextAllowed).toBe(false);
  });

  it("canal desconectado é estado próprio", () => {
    const p = composerPolicy({ ...base, channelReady: false, withinWindow: true });
    expect(p.windowState).toBe("no_channel");
    expect(p.catalogState).toBe("no_channel");
    expect(p.freeTextAllowed).toBe(false);
  });

  it("erro de catálogo é diferente de catálogo vazio", () => {
    expect(
      composerPolicy({ ...base, withinWindow: false, templatesError: true }).catalogState,
    ).toBe("error");
    expect(composerPolicy({ ...base, withinWindow: false, templates: [] }).catalogState).toBe(
      "empty",
    );
    expect(
      composerPolicy({ ...base, withinWindow: false, templates: [{ approved: true }] })
        .catalogState,
    ).toBe("ready");
  });
});

describe("forma do modelo aprovado", () => {
  const components = [
    { type: "HEADER", format: "TEXT", text: "Olá {{1}}" },
    { type: "BODY", text: "Tudo bem, {{1}}? Falo da {{2}}." },
    { type: "FOOTER", text: "WK Technology" },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Quero saber mais" }] },
  ];

  it("lê corpo, cabeçalho, rodapé, botões e variáveis", () => {
    const s = describeTemplate(components);
    expect(s.variableCount).toBe(2);
    expect(s.headerType).toBe("TEXT");
    expect(s.headerVariableCount).toBe(1);
    expect(s.footer).toBe("WK Technology");
    expect(s.buttons).toHaveLength(1);
  });

  it("exige todas as variáveis preenchidas", () => {
    const s = describeTemplate(components);
    expect(checkTemplateVariables(s, { variables: ["Ana", ""], headerVariables: ["Ana"] })).toEqual(
      { ok: false, reason: "missing_body", index: 2 },
    );
    expect(checkTemplateVariables(s, { variables: ["Ana", "WK"], headerVariables: [] })).toEqual({
      ok: false,
      reason: "missing_header",
      index: 1,
    });
    expect(
      checkTemplateVariables(s, { variables: ["Ana", "WK"], headerVariables: ["Ana"] }),
    ).toEqual({ ok: true });
  });

  it("cabeçalho de mídia exige link", () => {
    const s = describeTemplate([
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "oi" },
    ]);
    expect(s.headerMediaRequired).toBe(true);
    expect(checkTemplateVariables(s, {})).toEqual({ ok: false, reason: "missing_media" });
    expect(checkTemplateVariables(s, { headerMediaUrl: "https://x/y.png" })).toEqual({ ok: true });
  });
});
