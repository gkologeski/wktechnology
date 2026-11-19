import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportModeChooser } from "./import-mode-chooser";

const full = { draft: true, legacy: true, legacyMissing: [] };
const render = (p: Partial<Parameters<typeof ImportModeChooser>[0]> = {}) =>
  renderToStaticMarkup(
    <ImportModeChooser
      mode={null}
      onModeChange={() => {}}
      reason=""
      onReasonChange={() => {}}
      access={full}
      {...p}
    />,
  );

describe("ImportModeChooser", () => {
  it("shows both required options and no reason before choosing", () => {
    const html = render();
    expect(html).toContain("Documento em elaboração");
    expect(html).toContain("Contrato legado / já formalizado");
    expect(html).toContain('aria-required="true"');
    expect(html).not.toContain("Motivo do reconhecimento");
  });
  it("legacy shows required reason and explains no quote/proposal/billing", () => {
    const html = render({ mode: "legacy", reason: "abc" });
    expect(html).toContain("Motivo do reconhecimento");
    expect(html).toContain("mínimo 5");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/não libera cobranças/);
  });
  it("legacy disabled names the missing permissions", () => {
    const html = render({
      access: { draft: true, legacy: false, legacyMissing: ["reconhecer contrato legado"] },
    });
    expect(html).toContain("Sem permissão para: reconhecer contrato legado.");
  });
});
