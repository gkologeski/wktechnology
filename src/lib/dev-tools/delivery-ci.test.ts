import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  parseDeliveryArgs,
  readPublishedVersion,
  publishedUrls,
  validateLocalEvidence,
  validatePublishedVersions,
} from "../../../scripts/delivery-check.mjs";

const { load } = createRequire(import.meta.url)("js-yaml");
const workflow = () => load(readFileSync(".github/workflows/ci.yml", "utf8"));

describe("CI acceleration keeps the release gate", () => {
  it("prepares only locked database dependencies before full verification", () => {
    const job = workflow().jobs.verification_shards;
    expect(job.strategy.matrix.shard).toEqual([1, 2]);
    expect(job.strategy["fail-fast"]).toBe(false);
    const steps = job.steps;
    const image = readFileSync("src/lib/contracts/legacy-postgres.test.ts", "utf8").match(
      /const image = "([^"]+)"/,
    )?.[1];
    expect(image).toMatch(/^postgres@sha256:[a-f0-9]{64}$/);
    const gatewayImage = readFileSync("tests/fixtures/notification-deliveries.ts", "utf8").match(
      /const postgrestImage\s*=\s*"([^"]+)"/,
    )?.[1];
    expect(gatewayImage).toMatch(/^postgrest\/postgrest@sha256:[a-f0-9]{64}$/);
    const authImage = readFileSync("tests/fixtures/inbox/backend-regression.ts", "utf8").match(
      /const image\s*=\s*"([^"]+)"/,
    )?.[1];
    expect(authImage).toMatch(/^supabase\/gotrue@sha256:[a-f0-9]{64}$/);
    const prepare = steps.find(
      (s: { name?: string }) => s.name === "Prepare pinned database test images",
    );
    expect(prepare.run.trim().split("\n")).toEqual([
      `docker pull ${image}`,
      `docker pull ${gatewayImage}`,
      `docker pull ${authImage}`,
    ]);
    expect(prepare.if).toBeUndefined();
    expect(prepare["continue-on-error"]).toBeUndefined();
    expect(steps.indexOf(prepare)).toBeLessThan(
      steps.findIndex((s: { run?: string }) => s.run === "bun run verify"),
    );
  });
  it("cancels only superseded runs of the same workflow/event/PR or branch", () => {
    expect(workflow().concurrency).toEqual({
      group:
        "${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}",
      "cancel-in-progress": true,
    });
  });
  it("only caches downloads and content-based lint, never release evidence or build outputs", () => {
    const jobs = workflow().jobs;
    const caches = jobs.verification_shards.steps.filter((s: { uses?: string }) =>
      s.uses?.startsWith("actions/cache"),
    );
    expect(caches.map((s: { with: { path: string } }) => s.with.path).sort()).toEqual([
      ".eslintcache",
      ".eslintcache",
      "~/.bun/install/cache",
    ]);
    expect(caches[0].with.key).toContain("hashFiles('bun.lock')");
    expect(caches[1].with["restore-keys"]).toContain("eslint-rules/**");
    const finalCaches = jobs.unit.steps.filter((s: { uses?: string }) =>
      s.uses?.startsWith("actions/cache"),
    );
    expect(finalCaches.map((s: { with: { path: string } }) => s.with.path)).toEqual([
      "~/.bun/install/cache",
    ]);
    // Every job, including future ones, may cache only these two non-evidence paths.
    for (const job of Object.values(jobs) as Array<{
      steps: Array<{ uses?: string; with?: { path?: string } }>;
    }>)
      for (const step of job.steps)
        if (step.uses?.startsWith("actions/cache"))
          expect(["~/.bun/install/cache", ".eslintcache"]).toContain(step.with?.path);
  });
  it("saves only verified lint cache before later gates without caching their evidence", () => {
    const jobs = workflow().jobs;
    const steps = jobs.verification_shards.steps;
    const restore = steps.find((s: { id?: string }) => s.id === "lint-cache");
    const verify = steps.find((s: { id?: string }) => s.id === "verify");
    const save = steps.find((s: { uses?: string }) => s.uses === "actions/cache/save@v4");
    const upload = steps.find((s: { uses?: string }) => s.uses === "actions/upload-artifact@v4");
    expect(restore.uses).toBe("actions/cache/restore@v4");
    expect(verify.run).toBe("bun run verify");
    // Only the successful first shard saves content-based lint; no test outcome is cached.
    expect(save.if).toBe("${{ success() && matrix.shard == 1 }}");
    expect(verify["continue-on-error"]).toBeUndefined();
    expect(save["continue-on-error"]).toBeUndefined();
    expect(save.with).toEqual({
      path: ".eslintcache",
      key: "${{ steps.lint-cache.outputs.cache-primary-key }}",
    });
    expect(steps.indexOf(verify)).toBeLessThan(steps.indexOf(save));
    expect(steps.indexOf(save)).toBeLessThan(steps.indexOf(upload));
    expect(jobs.unit.needs).toBe("verification_shards");
    const finalSteps = jobs.unit.steps;
    expect(finalSteps.findIndex((s: { run?: string }) => s.run === "bun run verify")).toBeLessThan(
      finalSteps.findIndex((s: { run?: string }) => s.run === "bun run build"),
    );
  });
  it("keeps full verification, build and budgets unconditional even on cache hits", () => {
    const jobs = workflow().jobs;
    const steps = jobs.unit.steps;
    for (const command of [
      "bun install --frozen-lockfile",
      "bun run permissions:check",
      "bun run verify",
      "bun run build",
      "bun run perf:check",
    ]) {
      const step = steps.find((s: { run?: string }) => s.run === command);
      expect(step).toBeDefined();
      expect(step.if).toBe(command === "bun run verify" ? "${{ always() }}" : undefined);
      expect(step["continue-on-error"]).toBeUndefined();
    }
    const aggregate = steps.find((s: { run?: string }) => s.run === "bun run verify");
    expect(jobs.unit.if).toBe("${{ always() }}");
    expect(aggregate.env).toEqual({
      VERIFY_AGGREGATE: "1",
      VERIFY_PREVIOUS_STEPS_OK: "${{ job.status == 'success' }}",
      SHARD_JOB_RESULT: "${{ needs.verification_shards.result }}",
    });
    for (const command of ["bun install --frozen-lockfile", "bun run verify"]) {
      const step = jobs.verification_shards.steps.find((s: { run?: string }) => s.run === command);
      expect(step).toBeDefined();
      expect(step.if).toBeUndefined();
      expect(step["continue-on-error"]).toBeUndefined();
    }
    expect(workflow().permissions).toEqual({ contents: "read" });
    expect(steps[0].with["persist-credentials"]).toBe(false);
    expect(jobs.verification_shards.steps[0].with["persist-credentials"]).toBe(false);
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

describe("published endpoint canonical redirects", () => {
  const canonical = publishedUrls[0];
  const alias = publishedUrls[1];
  it("follows the Lovable redirect only to the known HTTPS metadata endpoint", async () => {
    const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
      url === alias
        ? new Response(null, { status: 302, headers: { location: canonical } })
        : new Response(JSON.stringify({ source_hash: hash, built_at: "2026-10-26T17:00:00Z" })),
    );
    expect(await readPublishedVersion(alias, fetcher)).toMatchObject({
      url: alias,
      resolved_url: canonical,
      source_hash: hash,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
  it.each([
    "http://app.wktechnology.com.br/build-info.json",
    "https://untrusted.example/build-info.json",
    "https://user:password@app.wktechnology.com.br/build-info.json",
    "https://app.wktechnology.com.br/private",
    "https://app.wktechnology.com.br/build-info.json?extra=value",
    "https://app.wktechnology.com.br/build-info.json#fragment",
  ])("blocks a redirect to %s before requesting it", async (location) => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location } }));
    await expect(readPublishedVersion(alias, fetcher)).rejects.toThrow("outside known endpoints");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects redirect loops", async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: alias } }),
    );
    await expect(readPublishedVersion(alias, fetcher)).rejects.toThrow("redirect loop");
  });
  it("rejects HTTP errors", async () => {
    await expect(
      readPublishedVersion(canonical, async () => new Response(null, { status: 500 })),
    ).rejects.toThrow("HTTP 500");
  });
  it("rejects malformed metadata", async () => {
    await expect(
      readPublishedVersion(canonical, async () => new Response("not json")),
    ).rejects.toThrow();
  });
  it("rejects oversized metadata", async () => {
    await expect(
      readPublishedVersion(canonical, async () => new Response("x".repeat(4097))),
    ).rejects.toThrow("metadata size");
  });
  it("rejects redirects without a location", async () => {
    await expect(
      readPublishedVersion(alias, async () => new Response(null, { status: 302 })),
    ).rejects.toThrow("Invalid published endpoint redirect");
  });
});
