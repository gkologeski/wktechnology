import { describe, expect, it } from "vitest";
import {
  compilePurchaseProposalDesign,
  createPurchaseFactoryTemplate,
  renderPurchaseProposalHtml,
} from "./purchase-proposal-render";
import { createEmptyPurchaseProposalData } from "./purchase-proposal.types";

const parties = {
  wk: { name: "WK Contratante", cnpj: "123" },
  supplier: { name: "Fornecedora de teste", cnpj: "456" },
};
const input = () => ({
  ...createEmptyPurchaseProposalData(),
  scope: "Aplicativo com autenticação",
  acceptanceCriteria: "Testes aprovados expressamente",
  hours: 40,
  hourlyRate: 110,
  businessDays: 5,
  milestones: [
    {
      id: "M1",
      title: "Autenticação",
      description: "Entrega do fluxo de acesso",
      acceptanceCriteria: "Validar login",
      hours: 40,
      businessDays: 5,
    },
  ],
});
const meta = { version: 2, issuedOn: "2026-11-27", currency: "BRL" };

describe("native factory purchase proposal", () => {
  it("keeps the generic catalogue free of transaction values and preserves workspace identity", () => {
    const template = createPurchaseFactoryTemplate({
      primaryColor: "#1557A0",
      headingFont: "Plus Jakarta Sans",
      bodyFont: "Inter",
    });
    expect(template.brandKit.primaryColor).toBe("#1557A0");
    expect(template.brandKit.bodyFont).toBe("Inter");
    const html = renderPurchaseProposalHtml(template);
    expect(html).not.toContain("170 horas");
    expect(html).not.toContain("21.250,00");
  });
  it("freezes only purchase parties, price, effort and dates without a sale context", () => {
    const design = compilePurchaseProposalDesign(
      createPurchaseFactoryTemplate(),
      input(),
      parties,
      meta,
    );
    const html = renderPurchaseProposalHtml(design);
    expect(html).toContain("WK Contratante");
    expect(html).toContain("Fornecedora de teste");
    expect(html).toContain("4.400,00");
    expect(html).toContain("27/11/2026");
    expect(html).not.toMatch(/NEXID|TechSales|TechERP|deal\.name/);
  });
  it("paginates large scopes without dropping the final line or overflowing body boxes", () => {
    const data = input();
    data.scope =
      Array.from(
        { length: 160 },
        (_, i) => `Requisito ${i}: validar comportamento e documentação.`,
      ).join("\n") + "\nMARCADOR_FINAL_PRESERVADO";
    const design = compilePurchaseProposalDesign(
      createPurchaseFactoryTemplate(),
      data,
      parties,
      meta,
    );
    expect(design.pages.length).toBeGreaterThan(5);
    expect(renderPurchaseProposalHtml(design)).toContain("MARCADOR_FINAL_PRESERVADO");
    for (const page of design.pages.slice(1))
      for (const el of page.elements) expect(el.y + el.h).toBeLessThanOrEqual(275);
  });
  it("escapes supplier and scope HTML and discards arbitrary template assets and sales text", () => {
    const template = createPurchaseFactoryTemplate({
      logoUrl: "https://unrelated.invalid/tracker.png",
    });
    template.pages[0].elements.push({
      ...template.pages[0].elements[1],
      id: "foreign-sale",
      props: { text: "CLIENTE_NAO_DEVE_APARECER" },
    } as (typeof template.pages)[0]["elements"][number]);
    const data = input();
    data.scope = '<img src="https://unrelated.invalid/leak" onerror="x()">';
    const html = renderPurchaseProposalHtml(
      compilePurchaseProposalDesign(
        template,
        data,
        { ...parties, supplier: { name: "<script>bad()</script>", cnpj: null } },
        meta,
      ),
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src="https://unrelated.invalid');
    expect(html).not.toContain("CLIENTE_NAO_DEVE_APARECER");
    expect(html).not.toContain("<script>bad()");
  });
  it("rejects oversized layouts instead of silently truncating the proposal", () => {
    const data = input();
    data.scope = "A\n".repeat(14000);
    expect(() =>
      compilePurchaseProposalDesign(createPurchaseFactoryTemplate(), data, parties, meta),
    ).toThrow("Nenhum texto foi descartado");
  });
  it("reserves heading height for long delivery names and wraps unbroken scope", () => {
    const data = input();
    data.milestones[0].title = "W".repeat(190);
    data.scope = "W".repeat(500);
    const design = compilePurchaseProposalDesign(
      createPurchaseFactoryTemplate(),
      data,
      parties,
      meta,
    );
    const elements = design.pages.flatMap((page) => page.elements);
    const heading = elements.find(
      (el) => el.type === "heading" && el.props.text.startsWith("Marco 1"),
    );
    expect(heading?.h).toBeGreaterThan(25);
    const allText = elements
      .flatMap((el) => (el.type === "heading" || el.type === "text" ? [el.props.text] : []))
      .join("\n");
    expect(allText.replace(/\n/g, "")).toContain("W".repeat(500));
    for (const page of design.pages.slice(1))
      for (const el of page.elements) expect(el.y + el.h).toBeLessThanOrEqual(275);
  });
  it("rechecks images and font CSS on designs saved through direct authenticated RPC", () => {
    const design = compilePurchaseProposalDesign(
      createPurchaseFactoryTemplate(),
      input(),
      parties,
      meta,
    );
    design.brandKit.logoUrl = "https://foreign.invalid/hidden-logo";
    design.brandKit.bodyFont = "Inter';background:url(https://foreign.invalid/css)";
    design.pages[0].elements.push({
      id: "foreign-image",
      name: "Foreign image",
      type: "image",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 0,
      z: 1,
      style: {},
      props: {
        src: "https://foreign.invalid/raw",
        storagePath: "foreign/asset",
        alt: "Foreign",
        fit: "contain",
        bindLogo: "none",
      },
    });
    const html = renderPurchaseProposalHtml(design, "https://workspace.invalid/own-logo");
    expect(html).not.toContain("foreign.invalid");
    expect(html).not.toContain("foreign/asset");
    expect(html).toContain("https://workspace.invalid/own-logo");
    expect(html).toContain("4.400,00");
  });
});
