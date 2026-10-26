import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  parseDeliveryArgs,
  publishedUrls,
  validateLocalEvidence,
  validatePublishedVersions,
} from "../../../scripts/delivery-check.mjs";

const { load } = createRequire(import.meta.url)("js-yaml");
const workflow = () => load(readFileSync(".github/workflows/ci.yml", "utf8"));

describe("CI acceleration keeps the release gate", () => {
  it("cancels only superseded runs of the same workflow/event/PR or branch", () => {
    expect(workflow().concurrency).toEqual({
      group:
        "${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}",
      "cancel-in-progress": true,
    });
  });
  it("only caches downloads and content-based lint, never release evidence or build outputs", () => {
    const caches = workflow().jobs.unit.steps.filter(
      (s: { uses?: string }) => s.uses === "actions/cache@v4",
    );
    expect(caches.map((s: { with: { path: string } }) => s.with.path).sort()).toEqual([
      ".eslintcache",
      "~/.bun/install/cache",
    ]);
    expect(caches[0].with.key).toContain("hashFiles('bun.lock')");
    expect(caches[1].with["restore-keys"]).toContain("eslint-rules/**");
  });
  it("keeps full verification, build and budgets unconditional even on cache hits", () => {
    const steps = workflow().jobs.unit.steps;
    for (const command of [
      "bun install --frozen-lockfile",
      "bun run permissions:check",
      "bun run verify",
      "bun run build",
      "bun run perf:check",
    ]) {
      const step = steps.find((s: { run?: string }) => s.run === command);
      expect(step).toBeDefined();
      expect(step.if).toBeUndefined();
      expect(step["continue-on-error"]).toBeUndefined();
    }
    expect(workflow().permissions).toEqual({ contents: "read" });
    expect(steps[0].with["persist-credentials"]).toBe(false);
  });
});

const hash = "a".repeat(64);
const evidence = (value = hash) => ({ complete: true, finalized: true, source_hash: value });
const versions = () =>
  publishedUrls.map((url: string) => ({
    url,
    source_hash: hash,
    built_at: "2026-10-26T17:00:00Z",
  }));
describe("delivery evidence fails closed", () => {
  it("accepts matching full verification/build", () => {
    expect(validateLocalEvidence(evidence(), evidence(), hash)).toBe(hash);
  });
  it("rejects targeted-only feedback, incomplete builds and changed sources", () => {
    expect(() => validateLocalEvidence({ release_eligible: false }, evidence(), hash)).toThrow();
    expect(() =>
      validateLocalEvidence(evidence(), { ...evidence(), finalized: false }, hash),
    ).toThrow();
    expect(() => validateLocalEvidence(evidence("b".repeat(64)), evidence(), hash)).toThrow();
  });
  it("requires both official published domains at the expected source", () => {
    expect(validatePublishedVersions(hash, versions())).toBe(true);
    expect(() => validatePublishedVersions(hash, versions().slice(0, 1))).toThrow();
    expect(() => validatePublishedVersions(hash, [...versions()].reverse())).toThrow();
    const stale = versions();
    stale[1].source_hash = "b".repeat(64);
    expect(() => validatePublishedVersions(hash, stale)).toThrow();
  });
  it("rejects invalid metadata and unknown CLI arguments", () => {
    const invalid = versions();
    invalid[0].built_at = "invalid";
    expect(() => validatePublishedVersions(hash, invalid)).toThrow();
    expect(() => parseDeliveryArgs(["--expected-commit"])).toThrow();
    expect(() => parseDeliveryArgs(["--skip-checks"])).toThrow();
    expect(parseDeliveryArgs(["--prepare"])).toEqual({ prepare: true, expectedCommit: undefined });
  });
});
