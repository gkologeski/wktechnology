import { describe, expect, it } from "vitest";
import { extractText } from "unpdf";
import { PDFDocument } from "pdf-lib";
import { htmlToBlocks, planSignaturePlacements } from "./forsign-core";
import { applyForsignTagsToPackagePdf, contractHtmlToPdf } from "./forsign-pdf";

async function pagesText(bytes: Uint8Array): Promise<string[]> {
  const res = await extractText(new Uint8Array(bytes), { mergePages: false });
  return Array.isArray(res.text) ? res.text : [String(res.text)];
}

describe("ForSign PDF — tags de assinatura e rubrica em todas as páginas", () => {
  const signers = [
    {
      name: "Alice Silva",
      email: "alice@example.test",
      role: "CONTRATANTE",
      cpf: "111.222.333-44",
    },
    { name: "Bruno Costa", email: "bruno@example.test", role: "CONTRATADO", cpf: null },
  ];

  it("insere tag de assinatura acima da linha identificada e rubricas em todas as páginas sem página extra", async () => {
    const longClauses = Array.from(
      { length: 45 },
      (_, i) =>
        `<p>Cláusula ${i + 1}. Obrigações e prazos acordados entre as partes para execução dos serviços contratados.</p>`,
    ).join("");
    const html = `
      <h1>Contrato de Prestação de Serviços</h1>
      ${longClauses}
      <p>________________________________________</p>
      <p>CONTRATANTE</p>
      <p>________________________________________</p>
      <p>CONTRATADA</p>
    `;
    const plan = planSignaturePlacements(htmlToBlocks(html), signers);
    expect(plan.hasFallbackPage).toBe(false);

    const tagged = signers.map((s, i) => ({ ...s, placement: plan.placements[i]! }));
    const pdfBytes = await contractHtmlToPdf(html, "Contrato Teste", { signers: tagged });
    const pages = await pagesText(pdfBytes);
    expect(pages.length).toBeGreaterThanOrEqual(2);

    const allText = pages.join("\n");
    expect(allText).not.toContain("Página de Assinaturas");
    expect(allText).toContain("#TE-ASSINA-1");
    expect(allText).toContain("#TE-ASSINA-2");
    for (const pageText of pages) {
      expect(pageText).toContain("#TE-RUBRICA-1");
      expect(pageText).toContain("#TE-RUBRICA-2");
    }
  });

  it("adiciona Página de Assinaturas no fallback e mantém rubricas em todas as páginas", async () => {
    const html = "<h1>Contrato Simples</h1><p>Sem bloco de assinatura no corpo do texto.</p>";
    const plan = planSignaturePlacements(htmlToBlocks(html), signers);
    expect(plan.hasFallbackPage).toBe(true);

    const tagged = signers.map((s, i) => ({ ...s, placement: plan.placements[i]! }));
    const pdfBytes = await contractHtmlToPdf(html, "Contrato Sem Linha", { signers: tagged });
    const pages = await pagesText(pdfBytes);
    expect(pages.length).toBe(2);
    expect(pages[1]).toContain("Página de Assinaturas");
    expect(pages[1]).toContain("Alice Silva");
    expect(pages[1]).toContain("Bruno Costa");
    expect(pages[1]).toContain("#TE-ASSINA-1");
    expect(pages[1]).toContain("#TE-ASSINA-2");
    for (const pageText of pages) {
      expect(pageText).toContain("#TE-RUBRICA-1");
      expect(pageText).toContain("#TE-RUBRICA-2");
    }
  });

  it("aplica tags de assinatura e rubricas em todas as páginas do pacote com anexos sem perder páginas", async () => {
    const baseHtml = `
      <h1>Contrato com Anexo</h1>
      <p>CONTRATANTE:</p><p>(assinatura eletrônica)</p>
      <p>CONTRATADA:</p><p>(assinatura eletrônica)</p>
    `;
    const contractPdf = await PDFDocument.load(
      await contractHtmlToPdf(baseHtml, "Contrato e anexos"),
    );
    const annexPdf = await PDFDocument.load(
      await contractHtmlToPdf("<h1>Anexo 1</h1><p>Proposta Comercial Aceita</p>", "Anexo"),
    );
    for (const p of await contractPdf.copyPages(annexPdf, annexPdf.getPageIndices())) {
      contractPdf.addPage(p);
    }
    const frozenPackageBytes = await contractPdf.save();

    const plan = planSignaturePlacements(htmlToBlocks(baseHtml), signers);
    const tagged = signers.map((s, i) => ({ ...s, placement: plan.placements[i]! }));
    const stamped = await applyForsignTagsToPackagePdf(
      frozenPackageBytes,
      baseHtml,
      "Contrato com Anexo",
      { signers: tagged },
    );
    const pages = await pagesText(stamped);
    expect(pages.length).toBe(2);
    expect(pages[0]).toContain("#TE-ASSINA-1");
    expect(pages[0]).toContain("#TE-ASSINA-2");
    expect(pages[1]).toContain("Proposta Comercial Aceita");
    for (const pageText of pages) {
      expect(pageText).toContain("#TE-RUBRICA-1");
      expect(pageText).toContain("#TE-RUBRICA-2");
    }
  });
});
