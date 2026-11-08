import { describe, expect, it } from "vitest";
import {
  buildProposalEmail,
  defaultProposalMessage,
  defaultProposalSubject,
} from "./proposal-email";

describe("e-mail da proposta", () => {
  it("assunto usa a empresa quando existe", () => {
    expect(defaultProposalSubject("P1", "ÓGEA")).toBe("Proposta comercial — ÓGEA");
    expect(defaultProposalSubject("P1", null)).toBe("Proposta comercial — P1");
  });
  it("saudação usa o primeiro nome do contato", () => {
    expect(defaultProposalMessage("Alan Fuentes")).toMatch(/^Olá, Alan, tudo bem\?/);
  });
  it("corpo inclui o link de aprovação e escapa HTML", () => {
    const r = buildProposalEmail({
      title: "x",
      company: null,
      contact: null,
      link: "https://app/proposal/abc",
      message: "<b>oi</b>",
    });
    expect(r.html).toContain('href="https://app/proposal/abc"');
    expect(r.html).not.toContain("<b>oi</b>");
    expect(r.text).toContain("https://app/proposal/abc");
  });
});
