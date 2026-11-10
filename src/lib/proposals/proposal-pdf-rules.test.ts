import { describe, expect, it } from "vitest";
import { isValidProposalToken, proposalPdfSections } from "./proposal-pdf-rules";

describe("PDF público da proposta", () => {
  it("proposal pdf accepts a well-formed token", () => {
    expect(isValidProposalToken("a".repeat(32))).toBe(true);
  });
  it("proposal pdf rejects a missing token", () => {
    expect(isValidProposalToken(undefined)).toBe(false);
    expect(isValidProposalToken("")).toBe(false);
  });
  it("proposal pdf rejects a short token", () => {
    expect(isValidProposalToken("abc")).toBe(false);
  });
  it("proposal pdf rejects an oversized token", () => {
    expect(isValidProposalToken("a".repeat(129))).toBe(false);
  });
  it("proposal pdf rejects a non-string token", () => {
    expect(isValidProposalToken(123)).toBe(false);
  });
  it("puts the items table after the body", () => {
    const html = proposalPdfSections("<p>Texto</p>", "<table>T</table>", "<p>Total</p>", false);
    expect(html.indexOf("Texto")).toBeLessThan(html.indexOf("<table>"));
    expect(html).toContain("<h2>Investimento</h2>");
  });
  it("does not duplicate a table already in the body", () => {
    expect(proposalPdfSections("<p>x</p>", "<table>T</table>", "", true)).not.toContain("<table>");
  });
});
