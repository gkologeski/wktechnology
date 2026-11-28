import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { aggregate, currentCiCommit, discoverTestFiles, shardTestArgs } from "../verify-shards.mjs";
import { sourceFingerprint } from "../perf/source-fingerprint.mjs";

function fixture(root = "/ci/workspace") {
  const now = Date.now();
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
    typesJobResult: "success",
    priorStepsOk: "true",
    now,
  };
  const iso = (ms) => new Date(ms).toISOString();
  const steps = (index) =>
    ["permissions", "orchestration", "lint", "test"].map((name) => {
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
              : name === "permissions"
                ? "bun scripts/check-permissions.ts"
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
        part_kind: "tests",
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
  const typesPart = {
    verify: {
      ...parts[0].verify,
      part_kind: "types",
      steps: [
        { ...parts[0].verify.steps[0] },
        {
          ...parts[0].verify.steps[1],
          name: "typecheck",
          command: `${root}/node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --incremental false`,
        },
      ],
    },
  };
  delete typesPart.verify.shard;
  return { parts, expected, typesPart };
}
test("four test parts and a separate full typecheck certify all files and assertions within global wall time", () => {
  const { parts, expected, typesPart } = fixture();
  const result = aggregate(parts, expected, typesPart);
  assert.equal(result.complete, true);
  assert.equal(result.test_files, 608);
  assert.equal(result.passed_assertions, 6691);
  assert.equal(result.duration_ms, 200000);
  assert.equal(result.typecheck_parts, 1);
  assert.deepEqual(result.typecheck_proof, typesPart.verify);
  assert.equal(result.steps.filter((step) => step.part_kind === "types").length, 2);
});
test("aggregate CLI requires all four test directories and the separate types artifact", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "verify-aggregate-cli-")));
  const put = (path, text) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text, { mode: 0o700 });
  };
  try {
    put("package.json", '{"type":"module"}');
    for (const path of [
      "scripts/verify-shards.mjs",
      "scripts/perf/source-fingerprint.mjs",
      "src/lib/performance/budgets.ts",
    ])
      put(path, readFileSync(path, "utf8"));
    const { parts, expected, typesPart } = fixture(root);
    for (const item of expected.inventory) writeFileSync(item.file, "// synthetic test inventory");
    put("bin/git", `#!${process.execPath}\nprocess.stdout.write('${expected.commit}')`);
    const hash = sourceFingerprint(root);
    put(".verification/test-inventory.json", JSON.stringify(expected.inventory));
    typesPart.verify.source_hash = hash;
    put(".verification-types/verify.json", JSON.stringify(typesPart.verify));
    for (const part of parts) {
      part.verify.source_hash = hash;
      const directory = `.verification-parts/shard-${part.verify.shard.index}`;
      put(`${directory}/verify.json`, JSON.stringify(part.verify));
      put(`${directory}/test-inventory.json`, JSON.stringify(part.inventory));
      put(`${directory}/test-results.json`, JSON.stringify(part.tests));
    }
    const run = () =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/verify-shards.mjs"], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${join(root, "bin")}:${process.env.PATH}`,
            GITHUB_SHA: expected.commit,
            GITHUB_RUN_ID: expected.runId,
            GITHUB_RUN_ATTEMPT: expected.runAttempt,
            SHARD_JOB_RESULT: "success",
            TYPES_JOB_RESULT: "success",
            VERIFY_PREVIOUS_STEPS_OK: "true",
          },
          stdio: "ignore",
        });
        child.once("error", reject);
        child.once("close", resolve);
      });
    assert.equal(await run(), 0, readFileSync(join(root, ".verification/verify.json"), "utf8"));
    const report = () => JSON.parse(readFileSync(join(root, ".verification/verify.json"), "utf8"));
    assert.equal(report().complete, true);
    assert.equal(report().shard_count, 4);
    assert.equal(report().typecheck_parts, 1);
    rmSync(join(root, ".verification-types/verify.json"));
    assert.equal(await run(), 1);
    assert.equal(report().complete, false);
    put(".verification-types/verify.json", JSON.stringify(typesPart.verify));
    assert.equal(await run(), 0);
    assert.equal(report().test_files, 608);
    rmSync(join(root, ".verification-parts/shard-4"), { recursive: true });
    assert.equal(await run(), 1);
    assert.equal(report().complete, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("legitimate new files/cases are accepted without a manual count baseline", () => {
  const { parts, expected, typesPart } = fixture();
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
  const result = aggregate(parts, expected, typesPart);
  assert.equal(result.test_files, 609);
  assert.equal(result.passed_assertions, 6692);
});
test("narrowed configured inventory cannot omit a physical mandatory test", () => {
  const { parts, expected, typesPart } = fixture();
  expected.inventory.pop();
  parts[1].tests.testResults.pop();
  assert.throws(() => aggregate(parts, expected, typesPart), /physical test file/);
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
    const { parts, expected, typesPart } = fixture();
    parts[0].verify.steps[3].command += extra;
    assert.throws(() => aggregate(parts, expected, typesPart), /exact unfiltered/);
  });
const negatives = {
  "missing shard": (p) => p.pop(),
  "legacy two-part evidence": (p) => p.splice(2),
  "extra shard": (p) => p.push(structuredClone(p[0])),
  "legacy shard denominator": (p) => (p[0].verify.shard.count = 2),
  "legacy missing part kind": (p) => delete p[0].verify.part_kind,
  "type proof substituted for test shard": (p) => (p[0].verify.part_kind = "types"),
  "legacy mixed test/type steps": (p) =>
    p[0].verify.steps.splice(2, 0, { ...p[0].verify.steps[2], name: "typecheck" }),
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
  "different checkout root": (p) => (p[1].verify.root = "/other/checkout"),
  "old run": (p) => (p[0].verify.run_id = "123455"),
  "old attempt": (p) => (p[0].verify.run_attempt = "2"),
  "partial marked complete": (p) => (p[0].verify.complete = true),
  "part incomplete": (p) => (p[0].verify.part_complete = false),
  "source changed": (p) => (p[0].verify.source_changed = true),
  interrupted: (p) => (p[0].verify.interrupted = "SIGTERM"),
  "permission step failed": (p) => (p[0].verify.steps[0].ok = false),
  "permission command replaced": (p) => (p[0].verify.steps[0].command = "echo permissions"),
  "orchestration evidence missing": (p) => p[0].verify.steps.splice(1, 1),
  "lint failed": (p) => (p[0].verify.steps[2].ok = false),
  "wrong shard command": (p) => (p[1].verify.steps[3].command = "vitest run --shard=1/2"),
  "missing assertion": (p) => {
    p[0].tests.testResults[0].assertionResults.pop();
  },
  "future completion": (p, e) => {
    p[1].verify.finished_at = new Date(e.now + 1).toISOString();
  },
  "incorrect report duration": (p) => p[1].verify.duration_ms--,
  "incorrect step duration": (p) => p[1].verify.steps[3].duration_ms--,
  "tests before permissions": (p, e) => {
    p[0].verify.steps[3].started_at = new Date(e.now - 200000).toISOString();
    p[0].verify.steps[3].duration_ms = 198000;
  },
  "duplicate inventory physical file": (p) =>
    (p[0].inventory[0] = { ...p[0].inventory[1], projectName: "other" }),
  "inventory path traversal": (p) => (p[0].inventory[0].file = "../src/outside.test.ts"),
  "empty assertions in a passed file": (p) => (p[0].tests.testResults[0].assertionResults = []),
};
for (const [name, mutate] of Object.entries(negatives))
  test(`aggregate rejects ${name}`, () => {
    const { parts, expected, typesPart } = fixture();
    mutate(parts, expected);
    assert.throws(() => aggregate(parts, expected, typesPart));
  });
for (const result of ["failure", "cancelled", "skipped", undefined])
  test(`aggregate rejects matrix result ${result}`, () => {
    const { parts, expected, typesPart } = fixture();
    assert.throws(() => aggregate(parts, { ...expected, shardJobResult: result }, typesPart));
  });
test("aggregate rejects previous final-job failure and missing run identity", () => {
  const { parts, expected, typesPart } = fixture();
  assert.throws(() => aggregate(parts, { ...expected, priorStepsOk: "false" }, typesPart));
  assert.throws(() => aggregate(parts, { ...expected, runId: undefined }, typesPart));
});
test("global budget includes shard skew, artifact transport and aggregate-job startup", () => {
  const { parts, expected, typesPart } = fixture();
  assert.throws(() => aggregate(parts, { ...expected, now: expected.now + 50000 }, typesPart));
});
test("a separate full typecheck proof is mandatory even when every test passed", () => {
  const { parts, expected } = fixture();
  for (const proof of [undefined, null, {}, [], { verify: undefined }])
    assert.throws(() => aggregate(parts, expected, proof));
});
const typeNegatives = {
  "different SHA": (t) => (t.verify.commit = "c".repeat(40)),
  "different source hash": (t) => (t.verify.source_hash = "c".repeat(64)),
  "old run": (t) => (t.verify.run_id = "123455"),
  "old attempt": (t) => (t.verify.run_attempt = "2"),
  "missing absolute root": (t) => (t.verify.root = undefined),
  "different checkout root": (t) => (t.verify.root = "/other/checkout"),
  "partial marked complete": (t) => (t.verify.complete = true),
  "part incomplete": (t) => (t.verify.part_complete = false),
  "source changed": (t) => (t.verify.source_changed = true),
  interrupted: (t) => (t.verify.interrupted = "SIGTERM"),
  "wrong kind": (t) => (t.verify.part_kind = "tests"),
  "legacy missing kind": (t) => delete t.verify.part_kind,
  "test shard identity": (t) => (t.verify.shard = { index: 1, count: 4 }),
  "fabricated inventory": (t) => (t.inventory = []),
  "fabricated test results": (t) => (t.tests = { success: true }),
  "fabricated nested inventory": (t) => (t.verify.inventory = []),
  "fabricated nested test results": (t) => (t.verify.testResults = []),
  "fabricated test counts": (t) => (t.verify.test_files = 608),
  "fabricated assertion counts": (t) => (t.verify.passed_assertions = 6691),
  "missing full type step": (t) => t.verify.steps.pop(),
  "reordered steps": (t) => t.verify.steps.reverse(),
  "extra test step": (t) => t.verify.steps.push({ ...t.verify.steps[1], name: "test" }),
  "permission failed": (t) => (t.verify.steps[0].ok = false),
  "permission command replaced": (t) => (t.verify.steps[0].command = "echo permissions"),
  "typecheck failed": (t) => (t.verify.steps[1].exit_code = 1),
  "typecheck false result": (t) => (t.verify.steps[1].ok = false),
  "typecheck signalled": (t) => (t.verify.steps[1].signal = "SIGKILL"),
  "incomplete compiler command": (t) => (t.verify.steps[1].command = "tsgo --noEmit"),
  "wrong compiler": (t) => (t.verify.steps[1].command = "tsc --noEmit --incremental false"),
  "compiler outside checkout": (t) =>
    (t.verify.steps[1].command =
      "/tmp/forged/node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --incremental false"),
  "incremental cache": (t) =>
    (t.verify.steps[1].command = t.verify.steps[1].command.replace(
      "--incremental false",
      "--incremental true",
    )),
  "filtered source": (t) => (t.verify.steps[1].command += " src/only.ts"),
  "project filter": (t) => (t.verify.steps[1].command += " --project tsconfig.partial.json"),
  "future completion": (t, e) => (t.verify.finished_at = new Date(e.now + 1).toISOString()),
  "incorrect report duration": (t) => t.verify.duration_ms--,
  "incorrect type duration": (t) => t.verify.steps[1].duration_ms--,
  "types before permission": (t, e) => {
    t.verify.steps[1].started_at = new Date(e.now - 200000).toISOString();
    t.verify.steps[1].duration_ms = 198000;
  },
};
for (const [name, mutate] of Object.entries(typeNegatives))
  test(`aggregate rejects separate type proof: ${name}`, () => {
    const { parts, expected, typesPart } = fixture();
    mutate(typesPart, expected);
    assert.throws(() => aggregate(parts, expected, typesPart));
  });
for (const result of ["failure", "cancelled", "skipped", undefined])
  test(`aggregate rejects type job result ${result}`, () => {
    const { parts, expected, typesPart } = fixture();
    assert.throws(() => aggregate(parts, { ...expected, typesJobResult: result }, typesPart));
  });
function shiftReport(report, delta) {
  for (const key of ["started_at", "finished_at"])
    report[key] = new Date(Date.parse(report[key]) + delta).toISOString();
  for (const step of report.steps)
    for (const key of ["started_at", "finished_at"])
      step[key] = new Date(Date.parse(step[key]) + delta).toISOString();
}
test("global verification starts at the earliest permission scan across all five parts", () => {
  const { parts, expected, typesPart } = fixture();
  shiftReport(typesPart.verify, -20000);
  const report = aggregate(parts, expected, typesPart);
  assert.equal(report.started_at, typesPart.verify.steps[0].started_at);
  assert.equal(report.duration_ms, 220000);
  shiftReport(typesPart.verify, -30000);
  assert.throws(() => aggregate(parts, expected, typesPart), /exceeded 240 seconds/);
});
test("checkout must match the independent GitHub event SHA", () => {
  assert.equal(currentCiCommit("a".repeat(40), "a".repeat(40)), "a".repeat(40));
  assert.throws(() => currentCiCommit("a".repeat(40), "b".repeat(40)));
  assert.throws(() => currentCiCommit("a".repeat(40), undefined));
  assert.throws(() => currentCiCommit("a".repeat(40), "invalid"));
});

// Disposable subprocesses verify orchestration only; these substitutes do not
// claim to test permission decisions, database policies or the product cases.
async function runVerify(mode, execution = "shard", aggregateExit = 0, extraEnv = {}) {
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
      `import fs from 'node:fs';fs.appendFileSync('events',JSON.stringify({name:'orchestration',shard:process.env.VERIFY_SHARD,aggregate:process.env.VERIFY_AGGREGATE,types:process.env.VERIFY_TYPES,go:process.env.GOMAXPROCS})+'\\n');`,
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
        `#!${process.execPath}\nconst fs=require('node:fs');const name=${JSON.stringify(name)};fs.appendFileSync('events',JSON.stringify({name,args:process.argv.slice(2),shard:process.env.VERIFY_SHARD,aggregate:process.env.VERIFY_AGGREGATE,types:process.env.VERIFY_TYPES,go:process.env.GOMAXPROCS})+'\\n');process.exit(process.env.MODE==='permission-failure'&&name==='bun'?7:process.env.MODE==='typecheck-failure'&&name==='typecheck'?8:0);`,
      );
    if (execution === "aggregate")
      put(
        "scripts/verify-shards.mjs",
        // This subprocess tests wrapper ordering, never certifies real shard evidence.
        `import fs from 'node:fs';fs.appendFileSync('events',JSON.stringify({name:'aggregate',go:process.env.GOMAXPROCS})+'\\n');fs.writeFileSync('.verification/verify.json',JSON.stringify({complete:false,fixture_aggregate:true}));process.exit(${aggregateExit});`,
      );
    const child = spawn(process.execPath, ["scripts/verify.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        // Emulate CI's ordinary wrapper process, not this outer node --test worker.
        NODE_TEST_CONTEXT: undefined,
        PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH}`,
        MODE: mode,
        VERIFY_SHARD: execution === "shard" ? "1/4" : undefined,
        VERIFY_AGGREGATE: execution === "aggregate" ? "1" : undefined,
        VERIFY_TYPES: execution === "types" ? "1" : undefined,
        GOMAXPROCS: "2",
        GITHUB_SHA: "a".repeat(40),
        GITHUB_RUN_ID: "123456",
        GITHUB_RUN_ATTEMPT: "1",
        ...extraEnv,
      },
      stdio: "ignore",
    });
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    return {
      code,
      report: existsSync(join(root, ".verification/verify.json"))
        ? JSON.parse(readFileSync(join(root, ".verification/verify.json"), "utf8"))
        : null,
      events: existsSync(join(root, "events"))
        ? readFileSync(join(root, "events"), "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
        : [],
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
  assert.equal(result.report.part_kind, "tests");
  assert.equal(
    result.events.some((event) => event.name === "typecheck"),
    false,
  );
  assert.deepEqual(
    result.report.steps.map((step) => step.name),
    ["permissions", "orchestration", "lint", "test"],
  );
  assert.equal(result.events[0].name, "bun");
  assert(
    result.events.every(
      (event) =>
        event.shard === undefined && event.aggregate === undefined && event.types === undefined,
    ),
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
test("aggregate wrapper runs exactly one fresh permission command before aggregation", async () => {
  const result = await runVerify("allowed", "aggregate");
  assert.equal(result.code, 0);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun", "aggregate"],
  );
  assert.deepEqual(result.events[0].args, ["scripts/check-permissions.ts"]);
  assert.equal(result.report.fixture_aggregate, true);
  assert.equal(
    result.report.complete,
    false,
    "An orchestration substitute cannot certify product evidence",
  );
});
test("aggregate permission failure prevents aggregation and leaves the proof incomplete", async () => {
  const result = await runVerify("permission-failure", "aggregate");
  assert.equal(result.code, 7);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun"],
  );
  assert.equal(result.report.complete, false);
});
test("aggregate failure propagates without converting partial evidence into a complete proof", async () => {
  const result = await runVerify("allowed", "aggregate", 9);
  assert.equal(result.code, 9);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun", "aggregate"],
  );
  assert.equal(result.report.complete, false);
});
test("test shards do not execute a compiler and preserve the caller Go budget", async () => {
  const result = await runVerify("allowed");
  assert.equal(result.code, 0);
  assert.equal(
    result.events.some((event) => event.name === "typecheck"),
    false,
  );
  for (const name of ["bun", "orchestration", "eslint", "vitest"]) {
    const child = result.events.find((event) => event.name === name);
    assert.ok(child, JSON.stringify(result.events));
    assert.equal(child.go, "2");
  }
});
test("types subprocess emits only its full native check after a fresh permission scan", async () => {
  const result = await runVerify("allowed", "types");
  assert.equal(result.code, 0);
  assert.equal(result.report.complete, false);
  assert.equal(result.report.part_complete, true);
  assert.equal(result.report.part_kind, "types");
  assert.equal(result.report.shard, undefined);
  assert(isAbsolute(result.report.root));
  assert(result.report.root.includes("verify-shards-orchestration-"));
  assert.equal(result.report.commit, "a".repeat(40));
  assert.equal(result.report.run_id, "123456");
  assert.equal(result.report.run_attempt, "1");
  assert.match(result.report.source_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    result.report.steps.map((step) => step.name),
    ["permissions", "typecheck"],
  );
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun", "typecheck"],
  );
  assert.deepEqual(result.events[0].args, ["scripts/check-permissions.ts"]);
  assert.deepEqual(result.events[1].args, ["--noEmit", "--incremental", "false"]);
  assert.equal(result.events[1].go, "2");
  assert(
    result.events.every(
      (event) =>
        event.shard === undefined && event.aggregate === undefined && event.types === undefined,
    ),
  );
  for (const key of ["inventory", "tests", "test_files", "passed_assertions"])
    assert.equal(result.report[key], undefined);
});
test("types permission failure prevents the compiler and never certifies completeness", async () => {
  const result = await runVerify("permission-failure", "types");
  assert.equal(result.code, 7);
  assert.equal(result.report.complete, false);
  assert.equal(result.report.part_complete, false);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun"],
  );
});
test("failed full typecheck remains a failed partial proof and propagates its exit code", async () => {
  const result = await runVerify("typecheck-failure", "types");
  assert.equal(result.code, 8);
  assert.equal(result.report.complete, false);
  assert.equal(result.report.part_complete, false);
  assert.equal(result.report.steps[1].exit_code, 8);
  assert.deepEqual(
    result.events.map((event) => event.name),
    ["bun", "typecheck"],
  );
});
for (const flags of [
  { VERIFY_TYPES: "0" },
  { VERIFY_TYPES: "" },
  { VERIFY_TYPES: "1", VERIFY_SHARD: "1/4" },
  { VERIFY_TYPES: "1", VERIFY_AGGREGATE: "1" },
  { VERIFY_AGGREGATE: "1", VERIFY_SHARD: "1/4" },
])
  test(`invalid or mixed verification modes fail before producing evidence: ${JSON.stringify(flags)}`, async () => {
    const result = await runVerify("allowed", "full", 0, flags);
    assert.equal(result.code, 1);
    assert.equal(result.report, null);
    assert.deepEqual(result.events, []);
  });
test("unsharded verification preserves the caller's Go budget and complete validator set", async () => {
  const result = await runVerify("allowed", "full");
  assert.equal(result.code, 0);
  assert.equal(result.report.complete, true);
  assert.deepEqual(
    result.report.steps.map((step) => step.name),
    ["permissions", "typecheck", "lint", "test"],
  );
  assert.equal(result.events.find((event) => event.name === "typecheck").go, "2");
});
