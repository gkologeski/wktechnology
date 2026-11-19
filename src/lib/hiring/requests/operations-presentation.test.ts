import { describe, expect, it } from "vitest";
import { allowedFiscalTypes, sniffFiscalMime } from "./operations-types";
const bytes = (...b: number[]) => new Uint8Array(b);
describe("operations presentation", () => {
  it("fiscal types follow the request regime without inferring freelance policy", () => {
    expect(allowedFiscalTypes("professional", "clt")).toEqual(["payroll_evidence"]);
    expect(allowedFiscalTypes("professional", "pj")).toEqual(["nfse", "nfe"]);
    expect(allowedFiscalTypes("professional", "freelance")).toEqual(["freelance_document"]);
    expect(allowedFiscalTypes("supplier", null)).toEqual(["nfse", "nfe"]);
  });
  it("file type comes from real bytes, not the extension", () => {
    expect(sniffFiscalMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
    expect(sniffFiscalMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      "image/png",
    );
    expect(sniffFiscalMime(new TextEncoder().encode("<?xml version"))).toBe("application/xml");
    expect(sniffFiscalMime(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
  });
});
