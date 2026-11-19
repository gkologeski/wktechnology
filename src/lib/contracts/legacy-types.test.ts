import { describe, expect, it } from "vitest";
import { isPdfBytes } from "./legacy-types";

describe("legacy evidence bytes", () => {
  it("accepts only real PDF signatures, never DOCX/ZIP", () => {
    expect(isPdfBytes(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(isPdfBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(false);
  });
});
