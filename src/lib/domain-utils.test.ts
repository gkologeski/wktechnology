import { describe, expect, it } from "vitest";
import {
  autoLogoUrls,
  corporateDomainFromEmail,
  extractRootDomain,
  logoDomain,
} from "./domain-utils";

describe("extractRootDomain", () => {
  it("limpa protocolo, www, caminho e porta", () => {
    expect(extractRootDomain("https://www.wktechnology.com.br/sobre")).toBe("wktechnology.com.br");
    expect(extractRootDomain("http://stripe.com:443/x?y=1")).toBe("stripe.com");
    expect(extractRootDomain("Nubank.com.br")).toBe("nubank.com.br");
    expect(extractRootDomain("joao@acme.com")).toBe("acme.com");
  });
  it("rejeita valores inválidos", () => {
    expect(extractRootDomain("")).toBeNull();
    expect(extractRootDomain(null)).toBeNull();
    expect(extractRootDomain("sem dominio")).toBeNull();
  });
});

describe("logoDomain", () => {
  it("ignora e-mail gratuito e usa o site", () => {
    expect(logoDomain("gmail.com", "https://acme.com.br")).toBe("acme.com.br");
    expect(logoDomain("hotmail.com")).toBeNull();
  });
  it("aceita portal como marca no domínio da empresa", () => {
    expect(logoDomain("uol.com.br")).toBe("uol.com.br");
  });
  it("trata portal como gratuito quando vem de e-mail", () => {
    expect(logoDomain("maria@uol.com.br")).toBeNull();
    expect(corporateDomainFromEmail("maria@uol.com.br")).toBeNull();
    expect(corporateDomainFromEmail("contato@acme.com.br")).toBe("acme.com.br");
    expect(corporateDomainFromEmail("x@gmail.com")).toBeNull();
  });
  it("gera cascata Clearbit → Google", () => {
    expect(autoLogoUrls("acme.com")).toHaveLength(2);
    expect(autoLogoUrls(null)).toEqual([]);
  });
});
