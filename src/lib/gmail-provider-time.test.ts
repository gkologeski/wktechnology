import { describe, expect, it } from "vitest";
import { gmailProviderTime } from "./gmail-provider-time";

describe("Gmail provider-confirmed timestamp", () => {
  it("preserves the provider instant, not the envelope or current clock", () => {
    expect(gmailProviderTime("1795305600123")).toBe("2026-11-22T00:00:00.123Z");
  });
  it("rejects missing provider timestamp instead of inventing current time", () => {
    expect(() => gmailProviderTime(undefined)).toThrow();
  });
  it("rejects invalid or out-of-range provider timestamps", () => {
    for (const value of ["", "not-a-date", "0", "-1", "8640000000000001"]) {
      expect(() => gmailProviderTime(value)).toThrow();
    }
  });
});
