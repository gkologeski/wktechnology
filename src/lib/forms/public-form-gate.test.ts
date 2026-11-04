import { describe, expect, it } from "vitest";
import { publicFormGate } from "./public-form-gate";

describe("publicFormGate", () => {
  it("public form allows active form under rate limit", () => {
    expect(publicFormGate({ active: true }, 0)).toBeNull();
  });
  it("public form rejects missing form", () => {
    expect(publicFormGate(null, 0)?.status).toBe(404);
  });
  it("public form rejects rate limited ip", () => {
    expect(publicFormGate({ active: true }, 5)?.status).toBe(429);
  });
  it("public form rejects slug outside any workspace", () => {
    expect(publicFormGate(null, 0)?.error).toBe("Not found");
  });
  it("public form keeps inactive form closed", () => {
    expect(publicFormGate({ active: false }, 0)?.status).toBe(404);
  });
});
