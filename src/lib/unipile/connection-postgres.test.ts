import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("enforces connection correlation, concurrent limits, receipts and private logs in PostgreSQL", () => {
  const output = execFileSync("python3", ["tests/unipile/connection-limits-sql.py"], {
    encoding: "utf8",
    timeout: 110000,
    maxBuffer: 1000000,
  });
  const result = JSON.parse(output) as {
    count: number;
    passed: string[];
    production_connections: number;
  };
  expect(result.production_connections).toBe(0);
  expect(result.count).toBeGreaterThanOrEqual(67);
  expect(result.passed).toContain("daily quota holds under eight concurrent reads");
  expect(result.passed).toContain("uncertain delivery never automatically repeated");
  expect(result.passed).toContain("logs deny inactive");
  expect(result.passed).toContain("sequence response keeps its selected agent and stops followup");
  expect(result.passed).toContain("new nonce cannot bypass unresolved personal account delivery");
}, 120000);
