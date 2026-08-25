import { describe, it, expect } from "vitest";
import { parseWhatsAppPaste, maybeConvertWhatsAppPaste } from "./whatsapp-paste";

const sample = `[10:00, 17/06/2026] Guilherme Kologeski: Fala Gustavo
[10:00, 17/06/2026] Guilherme Kologeski: bom dia, tudo bem?
[11:38, 17/06/2026] +55 47 9786-9780: Opa bom dia guilherme
[11:38, 17/06/2026] +55 47 9786-9780: podemos sim`;

describe("whatsapp paste", () => {
  it("parses lines", () => {
    const r = parseWhatsAppPaste(sample);
    expect(r).not.toBeNull();
    expect(r!.length).toBe(4);
    expect(r![0].sender).toBe("Guilherme Kologeski");
    expect(r![2].sender).toBe("+55 47 9786-9780");
  });

  it("returns null for non-whatsapp text", () => {
    expect(parseWhatsAppPaste("oi tudo bem?")).toBeNull();
  });

  it("renders html with bubbles", () => {
    const html = maybeConvertWhatsAppPaste(sample);
    expect(html).toContain("Fala Gustavo");
    expect(html).toContain("Opa bom dia guilherme");
    expect(html).toContain("#075E54");
    expect(html).toContain("#202C33");
  });

  it("handles html-wrapped input from rich editor", () => {
    const wrapped = sample
      .split("\n")
      .map((l) => `<p>${l}</p>`)
      .join("");
    const html = maybeConvertWhatsAppPaste(wrapped);
    expect(html).not.toBeNull();
    expect(html).toContain("podemos sim");
  });
});
