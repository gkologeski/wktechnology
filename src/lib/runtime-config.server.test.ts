import { describe, expect, it } from "vitest";
import { internalMocksEnabled, publicAppOrigin } from "./runtime-config.server";

describe("runtime config", () => {
  it("uses the canonical domain when no public URL is configured", () => {
    expect(publicAppOrigin({})).toBe("https://app.wktechnology.com.br");
  });

  it("normalizes a configured public origin", () => {
    expect(publicAppOrigin({ PUBLIC_APP_URL: "https://example.com/path" })).toBe(
      "https://example.com",
    );
  });

  it("rejects non-http public URLs", () => {
    expect(() => publicAppOrigin({ PUBLIC_APP_URL: "javascript:alert(1)" })).toThrow(
      "HTTP ou HTTPS",
    );
  });

  it("requires explicit opt-in for internal mocks", () => {
    expect(internalMocksEnabled({})).toBe(false);
    expect(internalMocksEnabled({ INTERNAL_MOCKS_ENABLED: "false" })).toBe(false);
    expect(internalMocksEnabled({ INTERNAL_MOCKS_ENABLED: "true" })).toBe(true);
  });
});
