import { describe, expect, it } from "vitest";
import { splitTemplateBody, variableSnippet } from "./template-variable-context";

describe("template variable context", () => {
  it("returns the text around the variable", () => {
    expect(variableSnippet("Olá, como vai a TI na {{1}}?", 1, 6)).toBe("…TI na {{1}}?");
  });
  it("returns null when the variable is not in the body", () => {
    expect(variableSnippet("Olá {{1}}", 2)).toBeNull();
  });
  it("marks variables when splitting", () => {
    expect(splitTemplateBody("A {{2}} B").filter((p) => p.variable).map((p) => p.variable)).toEqual(["2"]);
  });
});
