import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aggregate, currentCiCommit, discoverTestFiles, shardTestArgs } from "../verify-shards.mjs";

function fixture() {
  const now = Date.now(),
    root = "/ci/workspace";
  const inventory = Array.from({ length: 608 }, (_, index) => ({
    file: `${root}/src/synthetic-${index}.test.ts`,
    projectName: index === 607 ? "process-timezone" : "isolated",
  }));
  const expected = {
    commit: "a".repeat(40),
    sourceHash: "b".repeat(64),
    root,
    inventory,
    physicalFiles: inventory.map((item) => item.file),
    runId: "123456",
    runAttempt: "1",
    shardJobResult: "success",
    priorStepsOk: "true",
    now,
  };
  const iso = (ms) => new Date(ms).toISOString();
  const steps = (index) =>
    ["permissions", "orchestration", "typecheck", "lint", "test"].map((name) => {
      const start = now - (name === "permissions" ? 200000 : 190000);
      const end = now - (name === "permissions" ? 195000 : 2000);
      return {
        name,
        ok: true,
        exit_code: 0,
        signal: null,
        started_at: iso(start),
        finished_at: iso(end),
        duration_ms: end - start,
        command:
          name === "test"
            ? ["vitest", ...shardTestArgs(index)].join(" ")
            : name === "orchestration"
              ? "node --test scripts/testing/verify-shards.test.mjs"
              : name,
      };
    });
  const files = inventory.map((entry, index) => ({
    name: entry.file,
    status: "passed",
    message: "",
    assertionResults: Array.from({ length: index < 3 ? 12 : 11 }, (_, item) => ({
      fullName: `synthetic case ${item}`,
      status: "passed",
      failureMessages: [],
    })),
  }));
  const parts = [1, 2, 3, 4].map((index) => {
    const testResults = files.slice((index - 1) * 152, index * 152);
    const count = testResults.reduce((sum, file) => sum + file.assertionResults.length, 0);
    return {
      inventory,
      verify: {
        complete: false,
        part_complete: true,
        source_changed: false,
        interrupted: null,
        commit: expected.commit,
        source_hash: expected.sourceHash,
        run_id: expected.runId,
        run_attempt: expected.runAttempt,
        root,
        shard: { index, count: 4 },
        started_at: iso(now - 210000),
        finished_at: iso(now - 1000),
        duration_ms: 209000,
        steps: steps(index),
      },
      tests: {
        success: true,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        numFailedTestSuites: 0,
        numPendingTestSuites: 0,
        numTotalTests: count,
        numPassedTests: count,
        testResults,
      },
    };
  });
  return { parts, expected };
}
test("four complete parts certify all 608 unique files and 6691 passed assertions within global wall time", () => {
  const { parts, expected } = fixture();
  const result = aggregate(parts, expected);
  assert.equal(result.complete, true);
  assert.equal(result.test_files, 608);
  assert.equal(result.passed_assertions, 6691);
  assert.equal(result.duration_ms, 200000);
});
test("legitimate new files/cases are accepted without a manual count baseline", () => {
  const { parts, expected } = fixture();
  const file = `${expected.root}/src/new-legitimate.test.ts`;
  expected.inventory.push({ file, projectName: "isolated" });
  expected.physicalFiles.push(file);
  parts[1].tests.testResults.push({
    name: file,
    status: "passed",
    message: "",
    assertionResults: [{ fullName: "new legitimate case", status: "passed", failureMessages: [] }],
  });
  parts[1].tests.numTotalTests++;
  parts[1].tests.numPassedTests++;
  const result = aggregate(parts, expected);
  assert.equal(result.test_files, 609);
  assert.equal(result.passed_assertions, 6692);
});
test("narrowed configured inventory cannot omit a physical mandatory test", () => {
  const { parts, expected } = fixture();
  expected.inventory.pop();
  parts[1].tests.testResults.pop();
  assert.throws(() => aggregate(parts, expected), /physical test file/);
});
test("physical discovery includes nested mandatory tests and refuses symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-shards-inventory-"));
  try {
    mkdirSync(join(root, "src/nested"), { recursive: true });
    writeFileSync(join(root, "src/first.test.ts"), "never imported");
    writeFileSync(join(root, "src/nested/second.test.ts"), "never imported");
    writeFileSync(join(root, "src/other.spec.ts"), "not the configured mandatory pattern");
    assert.deepEqual(discoverTestFiles(root), ["src/first.test.ts", "src/nested/second.test.ts"]);
    symlinkSync(join(root, "src/first.test.ts"), join(root, "src/link.test.ts"));
    assert.throws(() => discoverTestFiles(root), /symlinks/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
for (const extra of [
  " -t subset",
  " src/only.test.ts",
  " --exclude src/hidden.test.ts",
  " --project isolated",
  " --passWithNoTests",
])
  test(`filtered/modified Vitest command is refused: ${extra}`, () => {
    const { parts, expected } = fixture();
    parts[0].verify.steps[4].command += extra;
    assert.throws(() => aggregate(parts, expected), /exact unfiltered/);
  });
const negatives = {
  "missing shard": (p) => p.pop(),
  "legacy two-part evidence": (p) => p.splice(2),
  "extra shard": (p) => p.push(structuredClone(p[0])),
  "legacy shard denominator": (p) => (p[0].verify.shard.count = 2),
  "out-of-range shard": (p) => (p[3].verify.shard.index = 5),
  "duplicate shard": (p) => (p[1].verify.shard.index = 1),
  "duplicate executed file": (p) =>
    (p[1].tests.testResults[0].name = p[0].tests.testResults[0].name),
  "missing executed file": (p) => p[1].tests.testResults.pop(),
  "skipped assertion": (p) => (p[0].tests.testResults[0].assertionResults[0].status = "skipped"),
  "failed assertion": (p) => (p[0].tests.testResults[0].assertionResults[0].status = "failed"),
  "pending counter": (p) => (p[0].tests.numPendingTests = 1),
  "todo counter": (p) => (p[0].tests.numTodoTests = 1),
  "failed suite": (p) => (p[0].tests.numFailedTestSuites = 1),
  "different SHA": (p) => (p[1].verify.commit = "c".repeat(40)),
  "different source hash": (p) => (p[1].verify.source_hash = "c".repeat(64)),
  "old run": (p) => (p[0].verify.run_id = "123455"),
  "old attempt": (p) => (p[0].verify.run_attempt = "2"),
  "partial marked complete": (p) => (p[0].verify.complete = true),
  "part incomplete": (p) => (p[0].verify.part_complete = false),
  "source changed": (p) => (p[0].verify.source_changed = true),
  interrupted: (p) => (p[0].verify.interrupted = "SIGTERM"),
  "permission step failed": (p) => (p[0].verify.steps[0].ok = false),
  "orchestration evidence missing": (p) => p[0].verify.steps.splice(1, 1),
  "typecheck failed": (p) => (p[1].verify.steps[2].exit_code = 1),
  "lint failed": (p) => (p[0].verify.steps[3].ok = false),
  "wrong shard command": (p) => (p[1].verify.steps[4].command = "vitest run --shard=1/2"),
  "missing assertion": (p) => {
    p[0].tests.testResults[0].assertionResults.pop();
  },
  "future completion": (p, e) => {
    p[1].verify.finished_at = new Date(e.now + 1).toISOString();
  },
  "incorrect report duration": (p) => p[1].verify.duration_ms--,
  "incorrect step duration": (p) => p[1].verify.steps[3].duration_ms--,
  "tests before permissions": (p, e) => {
    p[0].verify.steps[4].started_at = new Date(e.now - 200000).toISOString();
    p[0].verify.steps[4].duration_ms = 198000;
  },
  "duplicate inventory physical file": (p) =>
    (p[0].inventory[0] = { ...p[0].inventory[1], projectName: "other" }),
  "inventory path traversal": (p) => (p[0].inventory[0].file = "../src/outside.test.ts"),
  "empty assertions in a passed file": (p) => (p[0].tests.testResults[0].assertionResults = []),
};
for (const [name, mutate] of Object.entries(negatives))
  test(`aggregate rejects ${name}`, () => {
    const { parts, expected } = fixture();
    mutate(parts, expected);
    assert.throws(() => aggregate(parts, expected));
  });
for (const result of ["failure", "cancelled", "skipped", undefined])
  test(`aggregate rejects matrix result ${result}`, () => {
    const { parts, expected } = fixture();
    assert.throws(() => aggregate(parts, { ...expected, shardJobResult: result }));
  });
test("aggregate rejects previous final-job failure and missing run identity", () => {
  const { parts, expected } = fixture();
  assert.throws(() => aggregate(parts, { ...expected, priorStepsOk: "false" }));
  assert.throws(() => aggregate(parts, { ...expected, runId: undefined }));
});
test("global budget includes shard skew, artifact transport and aggregate-job startup", () => {
  const { parts, expected } = fixture();
  assert.throws(() => aggregate(parts, { ...expected, now: expected.now + 50000 }));
});
test("checkout must match the independent GitHub event SHA", () => {
  assert.equal(currentCiCommit("a".repeat(40), "a".repeat(40)), "a".repeat(40));
  assert.throws(() => currentCiCommit("a".repeat(40), "b".repeat(40)));
  assert.throws(() => currentCiCommit("a".repeat(40), undefined));
  assert.throws(() => currentCiCommit("a".repeat(40), "invalid"));
});

// Disposable subprocesses verify orchestration only; these substitutes do not
// claim to test permission decisions, database policies or the product cases.
async function runVerify(mode) {
  const root = mkdtempSync(join(tmpdir(), "verify-shards-orchestration-"));
  const put = (path, text) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text, { mode: 0o700 });
  };
  try {
    put("package.json", '{"type":"module"}');
    put("src/input.txt", "synthetic immutable input");
    for (const path of [
      "scripts/verify.mjs",
      "scripts/verify-shards.mjs",
      "scripts/perf/source-fingerprint.mjs",
      "src/lib/performance/budgets.ts",
    ]) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      copyFileSync(path, join(root, path));
    }
    put(
      "scripts/testing/verify-shards.test.mjs",
      `import fs from 'node:fs';fs.appendFileSync('events',JSON.stringify({name:'orchestration',shard:process.env.VERIFY_SHARD,aggregate:process.env.VERIFY_AGGREGATE})+'\\n');`,
    );
    put("node_modules/@typescript/native-preview/package.json", '{"type":"module"}');
    put(
      "node_modules/@typescript/native-preview/lib/getExePath.js",
      'export default ()=>new URL("../../../.bin/typecheck",import.meta.url).pathname;',
    );
    put(
      "node_modules/.bin/git",
      `#!${process.execPath}\nprocess.stdout.write('${"a".repeat(40)}\\n')`,
    );
    for (const name of ["bun", "typecheck", "eslint", "vitest"])
      put(
        `node_modules/.bin/${name}`,
        `#!${process.execPath}\nconst fs=require('node:fs');const name=${JSON.stringify(name)};fs.appendFileSync('events',JSON.stringify({name,args:process.argv.slice(2),shard:process.env.VERIFY_SHARD,aggregate:process.env.VERIFY_AGGREGATE})+'\\n');process.exit(process.env.MODE==='permission-failure'&&name==='bun'?7:0);`,
      );
    const child = spawn(process.execPath, ["scripts/verify.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH}`,
        MODE: mode,
        VERIFY_SHARD: "1/4",
        VERIFY_AGGREGATE: undefined,
        GITHUB_SHA: "a".repeat(40),
        GITHUB_RUN_ID: "123456",
        GITHUB_RUN_ATTEMPT: "1",
      },
      stdio: "ignore",
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    return {
      code,
      report: JSON.parse(readFileSync(join(root, ".verification/verify.json"), "utf8")),
      events: readFileSync(join(root, "events"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("shard subprocess emits only partial proof, runs every step after permissions and prevents recursive mode inheritance", async () => {
  const result = await runVerify("allowed");
  assert.equal(result.code, 0);
  assert.equal(result.report.complete, false);
  assert.equal(result.report.part_complete, true);
  assert.deepEqual(
    result.report.steps.map((step) => step.name),
    ["permissions", "orchestration", "typecheck", "lint", "test"],
  );
  assert.equal(result.events[0].name, "bun");
  assert(
    result.events.every((event) => event.shard === undefined && event.aggregate === undefined),
  );
  assert(result.events.find((event) => event.name === "vitest").args.includes("--shard=1/4"));
});
test("shard permission failure starts no downstream validators and leaves complete false", async () => {
  const result = await runVerify("permission-failure");
  assert.equal(result.code, 7);
  assert.equal(result.report.complete, false);
  assert.equal(result.report.part_complete, false);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun"],
  );
});
