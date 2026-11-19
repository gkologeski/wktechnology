import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Disposable subprocess harness tests orchestration, not authorization decisions.
async function gate(mode: string) {
  const root = mkdtempSync(join(tmpdir(), "verify-orchestration-"));
  const put = (path: string, body: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body, { mode: 0o700 });
  };
  try {
    put("package.json", '{"type":"module"}');
    put("src/input.txt", "original");
    mkdirSync(join(root, "scripts/perf"), { recursive: true });
    copyFileSync("scripts/verify.mjs", join(root, "scripts/verify.mjs"));
    copyFileSync(
      "scripts/perf/source-fingerprint.mjs",
      join(root, "scripts/perf/source-fingerprint.mjs"),
    );
    put("node_modules/@typescript/native-preview/package.json", '{"type":"module"}');
    put(
      "node_modules/@typescript/native-preview/lib/getExePath.js",
      'export default () => new URL("../../../.bin/typecheck", import.meta.url).pathname;',
    );
    for (const name of ["bun", "typecheck", "eslint", "vitest"]) {
      const label = name === "bun" ? "permissions" : name;
      put(
        `node_modules/.bin/${name}`,
        `#!${process.execPath}\nconst fs=require('node:fs');const label=${JSON.stringify(label)};fs.appendFileSync('events',label+':start\\n');setTimeout(()=>{if(process.env.MODE==='changed'&&label==='vitest')fs.appendFileSync('src/input.txt','changed');fs.appendFileSync('events',label+':end\\n');process.exit((process.env.MODE==='permissions'&&label==='permissions')||(process.env.MODE==='lint'&&label==='eslint')?7:0)},${label === "permissions" ? 20 : 250});`,
      );
    }
    const child = spawn(process.execPath, ["scripts/verify.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        MODE: mode,
        PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH}`,
      },
      stdio: "ignore",
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    const report = JSON.parse(readFileSync(join(root, ".verification/verify.json"), "utf8"));
    const events = readFileSync(join(root, "events"), "utf8").trim().split("\n");
    return { code, report, events };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
it("full gate completes independent checks only after permissions and records every result", async () => {
  const { code, report, events } = await gate("allowed");
  expect(code).toBe(0);
  expect(report.complete).toBe(true);
  expect(report.steps.map((s: { name: string }) => s.name)).toEqual([
    "permissions",
    "typecheck",
    "lint",
    "test",
  ]);
  expect(events.slice(0, 2)).toEqual(["permissions:start", "permissions:end"]);
  // All checks actually start before any finishes; no timing threshold masks missing work.
  expect(events.slice(2, 5).sort()).toEqual(["eslint:start", "typecheck:start", "vitest:start"]);
});
it("permission gate failure prevents all downstream checks and release evidence", async () => {
  const { code, report, events } = await gate("permissions");
  expect(code).toBe(7);
  expect(report.complete).toBe(false);
  expect(events).toEqual(["permissions:start", "permissions:end"]);
});
it("one independent failure still waits for every other result and fails release", async () => {
  const { code, report, events } = await gate("lint");
  expect(code).toBe(7);
  expect(report.complete).toBe(false);
  expect(report.steps).toHaveLength(4);
  expect(events).toContain("vitest:end");
  expect(events).toContain("typecheck:end");
});
it("source mutation during verification rejects otherwise successful checks", async () => {
  const { code, report } = await gate("changed");
  expect(code).toBe(1);
  expect(report.source_changed).toBe(true);
  expect(report.complete).toBe(false);
});
