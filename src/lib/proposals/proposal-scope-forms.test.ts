import { describe, expect, it } from "vitest";
import { createBlankVisualDesign } from "./visual-design";
import {
  MODALITY_FIELD,
  SERVICE_TYPE_FIELDS,
  appendScopePagesToVisualDesign,
  buildInitialScopeBrief,
  detectContractingModality,
  detectServiceScopeType,
  extractSectionsFromScopeHtml,
  hasAnyScopeInput,
  mergeScopeIntoProposalHtml,
  parseScopeBrief,
  sanitizeScopeHtml,
} from "./proposal-scope-forms";

describe("proposal-scope-forms", () => {
  it("detects service type and modality for Brooks support hours and other domains", () => {
    expect(detectServiceScopeType("CT/Brooks/Sergio/Suporte 18 horas", "18 h · R$ 3.600")).toBe(
      "suporte",
    );
    expect(detectContractingModality("CT/Brooks/Sergio/Suporte 18 horas", "18 h")).toBe("hourly");

    expect(detectServiceScopeType("Desenvolvimento de módulo fiscal", "Preço fechado")).toBe(
      "desenvolvimento",
    );
    expect(detectContractingModality("Desenvolvimento de módulo fiscal", "R$ 45.000")).toBe(
      "fixed_price",
    );

    expect(detectServiceScopeType("Alocação Dev Sênior", "R$ 18.000/mês")).toBe("alocacao");
    expect(detectContractingModality("Alocação Dev Sênior", "R$ 18.000/mês")).toBe("monthly");

    expect(detectServiceScopeType("Implantação e integração ERP", "Projeto")).toBe("implantacao");
    expect(detectServiceScopeType("Consultoria técnica estratégica", "Pacote de horas")).toBe(
      "consultoria",
    );
  });

  it("exposes specific guided fields for every service type and contracting modality", () => {
    expect(SERVICE_TYPE_FIELDS.suporte.map((f) => f.key)).toEqual([
      "covered_systems",
      "coverage_hours",
      "channels",
      "sla_priorities",
      "hours_allowance_overage",
    ]);
    expect(SERVICE_TYPE_FIELDS.consultoria.map((f) => f.key)).toContain("methodology");
    expect(SERVICE_TYPE_FIELDS.desenvolvimento.map((f) => f.key)).toContain("acceptance_criteria");
    expect(SERVICE_TYPE_FIELDS.alocacao.map((f) => f.key)).toContain("replacement_rules");
    expect(SERVICE_TYPE_FIELDS.implantacao.map((f) => f.key)).toContain("golive_criteria");
    expect(MODALITY_FIELD.fixed_price.key).toBe("modality_rules");
    expect(MODALITY_FIELD.hourly.key).toBe("modality_rules");
    expect(MODALITY_FIELD.monthly.key).toBe("modality_rules");
  });

  it("initializes multi-service brief from items and preserves saved brief when present", () => {
    const initial = buildInitialScopeBrief([
      { id: "1", name: "Implantação ERP", billing: "R$ 20.000" },
      { id: "2", name: "Sustentação mensal", billing: "R$ 4.000/mês" },
    ]);
    expect(initial.services).toHaveLength(2);
    expect(initial.services[0]?.serviceType).toBe("implantacao");
    expect(initial.services[0]?.modality).toBe("fixed_price");
    expect(initial.services[1]?.serviceType).toBe("suporte");
    expect(initial.services[1]?.modality).toBe("monthly");
    expect(hasAnyScopeInput(initial)).toBe(false);

    const saved = parseScopeBrief({
      general: { objective: "Estabilizar ERP" },
      services: [
        {
          id: "s1",
          name: "Suporte 18h",
          billing: "18 h",
          serviceType: "suporte",
          modality: "hourly",
          answers: { channels: "WhatsApp e e-mail" },
          freeNotes: "Atendimento rápido",
        },
      ],
    });
    expect(saved).not.toBeNull();
    expect(hasAnyScopeInput(saved!)).toBe(true);
    const restored = buildInitialScopeBrief([], saved);
    expect(restored.general["objective"]).toBe("Estabilizar ERP");
    expect(restored.services[0]?.answers["channels"]).toBe("WhatsApp e e-mail");
  });

  it("sanitizes unsafe scripts and event handlers from AI HTML", () => {
    const dirty =
      '```html\n<h3>Escopo</h3><script>alert(1)</script><p onclick="steal()">Texto <a href="javascript:void(0)">ok</a></p>\n```';
    const clean = sanitizeScopeHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<h3>Escopo</h3>");
    expect(clean).toContain("Texto");
  });

  it("merges generated scope before Condições comerciais and avoids duplication on regenerate", () => {
    const existing =
      "<p>Introdução da proposta</p><h3>Condições comerciais</h3><ul><li>Forma: PIX</li></ul>";
    const first = mergeScopeIntoProposalHtml(
      existing,
      "<h3>Objetivo</h3><p>Versão 1</p>",
      "insert",
    );
    expect(first).toContain("<h2>Escopo Técnico Detalhado</h2>");
    expect(first.indexOf("Versão 1")).toBeLessThan(first.indexOf("Condições comerciais"));

    const second = mergeScopeIntoProposalHtml(first, "<h3>Objetivo</h3><p>Versão 2</p>", "insert");
    expect(second).not.toContain("Versão 1");
    expect(second).toContain("Versão 2");
    expect(second.match(/Escopo Técnico Detalhado/g)).toHaveLength(1);
    expect(second).toContain("Condições comerciais");

    const replaced = mergeScopeIntoProposalHtml(first, "<h3>Novo</h3><p>Limpo</p>", "replace");
    expect(replaced).not.toContain("Introdução da proposta");
    expect(replaced).toContain("Novo");
    expect(replaced).toContain("Condições comerciais");
  });

  it("extracts sections and appends/replaces A4 scope pages in VisualDesign without duplicating", () => {
    const sections = extractSectionsFromScopeHtml(
      "<h3>Visão Geral</h3><p>Atendimento Brooks.</p><h3>Suporte 18h</h3><ul><li>Horário comercial</li><li>SLA 4h</li></ul>",
    );
    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("Visão Geral");
    expect(sections[1]?.content).toContain("• Horário comercial");

    const base = createBlankVisualDesign();
    const initialCount = base.pages.length;
    const withScope = appendScopePagesToVisualDesign(base, sections);
    expect(withScope.pages.length).toBeGreaterThan(initialCount);
    expect(withScope.pages.some((p) => p.id.startsWith("scope-ai-"))).toBe(true);

    // Regenerar substitui as páginas anteriores de escopo sem duplicar
    const regenerated = appendScopePagesToVisualDesign(withScope, [
      { title: "Escopo Atualizado", content: "Nova redação" },
    ]);
    expect(regenerated.pages.filter((p) => p.id.startsWith("scope-ai-"))).toHaveLength(1);
  });
});
