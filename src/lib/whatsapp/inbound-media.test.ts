import { describe, expect, it } from "vitest";
import { inboundBody, isLegacyPlaceholder } from "./inbound-media";

describe("inboundBody", () => {
  it("documento mostra nome do arquivo e legenda", () => {
    expect(
      inboundBody({ type: "document", document: { filename: "proposta.pdf", caption: "Segue" } }),
    ).toBe("📎 Documento: proposta.pdf\nSegue");
  });
  it("áudio e imagem têm rótulos legíveis", () => {
    expect(inboundBody({ type: "audio", audio: { id: "1" } })).toBe("🎤 Áudio");
    expect(inboundBody({ type: "image", image: { id: "1" } })).toBe("🖼 Imagem");
  });
  it("localização gera link do mapa", () => {
    expect(
      inboundBody({ type: "location", location: { latitude: -27.5, longitude: -48.5, name: "WK" } }),
    ).toContain("https://maps.google.com/?q=-27.5,-48.5");
  });
  it("contato compartilhado lista nome e telefone", () => {
    expect(
      inboundBody({
        type: "contacts",
        contacts: [{ name: { formatted_name: "Ana" }, phones: [{ phone: "+5548999" }] }],
      }),
    ).toContain("Ana: +5548999");
  });
  it("reconhece corpo antigo", () => {
    expect(isLegacyPlaceholder("[document]")).toBe(true);
    expect(isLegacyPlaceholder("Oi")).toBe(false);
  });
});
