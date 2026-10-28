import { describe, expect, it } from "vitest";
import { buildCompanyLeftPrompt, parseCompanyLeftAnswer } from "./company-left-ai";
import { audioSource } from "@/lib/whatsapp/inbound-media";

const wrap = (o: unknown) => JSON.stringify({ choices: [{ message: { content: JSON.stringify(o) } }] });

describe("company-left-ai", () => {
  it("aceita confiança >= 0,7", () => {
    expect(parseCompanyLeftAnswer(wrap({ saiu_ou_nao_pertence: true, nova_empresa: null, confianca: 0.9 })))
      .toEqual({ left: true, newCompany: null });
  });
  it("recusa confiança abaixo de 0,7", () => {
    expect(parseCompanyLeftAnswer(wrap({ saiu_ou_nao_pertence: true, nova_empresa: "Y", confianca: 0.6 }))).toBeNull();
  });
  it("recusa falso e JSON inválido", () => {
    expect(parseCompanyLeftAnswer(wrap({ saiu_ou_nao_pertence: false, nova_empresa: null, confianca: 1 }))).toBeNull();
    expect(parseCompanyLeftAnswer("xx")).toBeNull();
  });
  it("devolve nova empresa", () => {
    expect(parseCompanyLeftAnswer(wrap({ saiu_ou_nao_pertence: true, nova_empresa: " Acme ", confianca: 0.8 }))?.newCompany).toBe("Acme");
  });
  it("prompt inclui empresa e mensagem", () => {
    const m = buildCompanyLeftPrompt("Ciashop", "Não sou da CiaShop");
    expect(m[1].content).toContain("Ciashop");
    expect(m[1].content).toContain("Não sou da CiaShop");
  });
});

describe("audioSource", () => {
  it("Meta direta quando há número Cloud", () => {
    expect(audioSource({ _cloud_phone_number_id: "1311815615348040" })).toBe("cloud");
  });
  it("Conector Lovable nos demais casos", () => {
    expect(audioSource({})).toBe("gateway");
    expect(audioSource(null)).toBe("gateway");
  });
});
