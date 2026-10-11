import { expect, it } from "vitest";
import { checkBuild } from "./budgets";
const report = () => ({
  complete: true,
  finalized: true,
  duration_ms: 156_000,
  phases: {
    client: { complete: true, duration_ms: 35_000, entry_gzip_bytes: 247_139 },
    ssr: { complete: true, duration_ms: 52_000, entry_gzip_bytes: 0 },
    nitro: { complete: true, duration_ms: 65_000, entry_gzip_bytes: 0 },
  },
});
it("rejects incomplete artifacts and excess even when complete is claimed", () => {
  expect(checkBuild(report())).toEqual([]);
  const broken = report();
  broken.phases.nitro.complete = false;
  expect(checkBuild(broken)).toContain("missing phase nitro");
  const invalid = report();
  invalid.duration_ms = -1;
  expect(checkBuild(invalid)).toContain("build time");
  const slow = report();
  slow.duration_ms = 240_001;
  expect(checkBuild(slow)).toContain("build time");
  const heavy = report();
  heavy.phases.client.entry_gzip_bytes = 280_001;
  expect(checkBuild(heavy)).toContain("client entry size");
});
