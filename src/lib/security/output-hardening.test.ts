import { describe, expect, it } from "vitest";
import { neutralizeCsvFormula } from "@/lib/export/csv-formula";
import { toCsv } from "@/lib/csv-export";
import { renderHtmlTokens, renderTokens } from "@/lib/message-tokens";
import { orIlikeContains } from "@/lib/postgrest-or";
import { validatedCvUrl } from "./cv-url";

describe("untrusted output", () => {
  it("neutralizes all spreadsheet operators before quoting", () => {
    for (const value of [
      '=HYPERLINK("https://evil.invalid")',
      "+SUM(1,2)",
      "-SUM(1,2)",
      "@SUM(1,2)",
      "\t=1",
      "\r=1",
    ])
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
  });
  it("preserves typed amounts, booleans and canonical phone identity", () => {
    expect(neutralizeCsvFormula(-125.5)).toBe("-125.5");
    expect(neutralizeCsvFormula(false)).toBe("false");
    expect(neutralizeCsvFormula("+554861370317")).toBe("+554861370317");
    expect(neutralizeCsvFormula(null)).toBe("");
  });
  it("neutralizes lead export headers and cells with quotes and delimiters", () => {
    const csv = toCsv(
      [{ name: '=HYPERLINK("x";"y")' }],
      [{ header: "@name", value: (row) => row.name }],
    );
    expect(csv).toBe('\uFEFF\'@name\r\n"\'=HYPERLINK(""x"";""y"")"');
  });
  it("escapes flat and nested email tokens without changing the template", () => {
    const context = {
      name: '<a href="https://evil.invalid">x</a>',
      candidate: { full_name: "<img src=x>" },
      "job.title": "R&D",
    };
    expect(renderHtmlTokens("<p>{{name}} {{candidate.full_name}} {{job.title}}</p>", context)).toBe(
      "<p>&lt;a href=&quot;https://evil.invalid&quot;&gt;x&lt;/a&gt; &lt;img src=x&gt; R&amp;D</p>",
    );
    expect(renderTokens("{{name}}", context)).toBe(context.name);
  });
  it("keeps filter operators inside one quoted PostgREST value", () => {
    expect(orIlikeContains('x,or(id.neq.null),"\\%_')).toBe(
      '"%x,or(id.neq.null),\\"\\\\\\\\\\\\%\\\\_%"',
    );
    expect(orIlikeContains("Alice")).toBe('"%Alice%"');
  });
});

describe("CV storage capability", () => {
  const origin = "https://storage.example.invalid";
  const valid = `${origin}/storage/v1/object/sign/ats-cvs/workspace/cv.pdf?token=signed-fixture`;
  it("CV permits the configured signed bucket", () => {
    expect(validatedCvUrl(valid, origin).href).toBe(valid);
  });
  it("CV refuses missing capability", () => {
    expect(() => validatedCvUrl(valid.split("?")[0] ?? "", origin)).toThrow();
  });
  it("CV refuses invalid capability path", () => {
    expect(() => validatedCvUrl(valid.replace("ats-cvs", "contracts"), origin)).toThrow();
  });
  it("CV refuses foreign storage origin", () => {
    expect(() =>
      validatedCvUrl(valid.replace("storage.example", "foreign.example"), origin),
    ).toThrow();
  });
  it("CV refuses credentials and unsafe protocol", () => {
    expect(() => validatedCvUrl(valid.replace("https://", "https://user:pass@"), origin)).toThrow();
    expect(() => validatedCvUrl(valid.replace("https://", "http://"), origin)).toThrow();
  });
});
