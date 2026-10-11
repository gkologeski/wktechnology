import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceFingerprint } from "../../../scripts/perf/source-fingerprint.mjs";
it("accepts identical copies but invalidates reports after source changes", () => {
  const root = mkdtempSync(join(tmpdir(), "techerp-fingerprint-"));
  try {
    for (const name of ["a", "b"]) {
      mkdirSync(join(root, name, "src"), { recursive: true });
      writeFileSync(join(root, name, "src", "example.ts"), "export const n = 1;");
    }
    writeFileSync(
      join(root, "a", "bun.lock"),
      "https://europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/example@1 sha512-locked",
    );
    writeFileSync(
      join(root, "b", "bun.lock"),
      "https://registry.npmjs.org/example@1 sha512-locked",
    );
    const hash = sourceFingerprint(join(root, "a"));
    expect(sourceFingerprint(join(root, "b"))).toBe(hash);
    writeFileSync(join(root, "b", "src", "example.ts"), "export const n = 2;");
    expect(sourceFingerprint(join(root, "b"))).not.toBe(hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
