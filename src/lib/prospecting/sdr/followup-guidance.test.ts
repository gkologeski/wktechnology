import { describe, expect, it } from "vitest";
import { FOLLOW_UP_GUIDANCE } from "./agent.server";

describe("orientação de retomada", () => {
  it("proíbe reapresentação e pede retomar o assunto pendente", () => {
    expect(FOLLOW_UP_GUIDANCE).toContain("NÃO se apresente de novo");
    expect(FOLLOW_UP_GUIDANCE).toContain("Conseguiu dar uma olhada na apresentação?");
    expect(FOLLOW_UP_GUIDANCE).toContain("retomada automática");
  });
});
