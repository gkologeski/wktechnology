import { describe, expect, it } from "vitest";
import { cleanEmailSignatureHtml } from "./email-signature-html";

describe("cleanEmailSignatureHtml", () => {
  const signature =
    'Abraços,<br><table><tbody><tr><td><img src="https://example.com/photo.png"></td><td><a href="https://example.com">Guilherme</a></td></tr></tbody></table>';

  it("removes Gmail's fixed-height editor shell without changing images, links or inner tables", () => {
    const pasted = `<table class="An" style="width: 500px"><tbody><tr><td class="Ap"><div class="IN" style="padding: 8px"><div class="Am aiL editable" style="height: 100px; overflow: visible auto">${signature}</div></div></td></tr></tbody></table>`;
    expect(cleanEmailSignatureHtml(pasted)).toBe(signature);
    expect(cleanEmailSignatureHtml(cleanEmailSignatureHtml(pasted))).toBe(signature);
  });

  it("leaves ordinary signatures and intentionally sized content unchanged", () => {
    expect(cleanEmailSignatureHtml(signature)).toBe(signature);
    expect(cleanEmailSignatureHtml('<div style="height: 100px">Logo</div>')).toBe(
      '<div style="height: 100px">Logo</div>',
    );
    const noHeight = `<table class="An"><tbody><tr><td class="Ap"><div class="IN"><div class="editable">${signature}</div></div></td></tr></tbody></table>`;
    expect(cleanEmailSignatureHtml(noHeight)).toBe(noHeight);
  });
});
