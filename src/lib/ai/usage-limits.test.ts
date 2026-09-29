import { describe, it, expect } from "vitest";
import { Filters } from "./ai-usage.functions";

describe("AI Usage Limits Audit", () => {
  it("should have correct pagination boundaries in Zod schema", () => {
    const valid = Filters.safeParse({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      page: 0,
      pageSize: 1000,
    });
    expect(valid.success).toBe(true);

    const tooLarge = Filters.safeParse({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      pageSize: 1001,
    });
    expect(tooLarge.success).toBe(false);
  });

  it("should default pageSize to 25", () => {
    const valid = Filters.parse({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
    });
    expect(valid.pageSize).toBe(25);
  });
});
