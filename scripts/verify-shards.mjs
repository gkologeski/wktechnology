#!/usr/bin/env node
// No partial shard can certify a complete release.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { budgets } from "../src/lib/performance/budgets.ts";

const VERIFY_BUDGET_MS = budgets.verify_ms;
const EXPECTED_STEPS = ["permissions", "orchestration", "typecheck", "lint", "test"];
const normalize = (root, file) => {
  assert.equal(typeof file, "string");
  const path = relative(root, isAbsolute(file) ? file : join(root, file)).replaceAll("\\", "/");
  assert(path.startsWith("src/") && !path.split("/").includes(".."), "Unexpected test path");
  return path;
};
const inventory = (root, input) => {
  assert(Array.isArray(input));
  const files = input.map((item) => ({
    file: normalize(root, item.file),
    project: item.projectName ?? "",
  }));
  assert(files.length > 0, "The independently collected test inventory cannot be empty");
  // Vitest's JSON reporter does not include projectName. Fail closed if a
  // future config executes one physical file in multiple projects.
  assert.equal(new Set(files.map((item) => item.file)).size, files.length);
  return files.sort((a, b) => a.file.localeCompare(b.file));
};
const timestamp = (input) => {
  const value = Date.parse(input);
  assert(Number.isFinite(value), "Missing/invalid timestamp");
  return value;
};
export function currentCiCommit(head, eventSha) {
  assert(/^[a-f0-9]{40}$/.test(eventSha ?? ""), "Require the GitHub event SHA");
  assert.equal(head, eventSha, "Checkout does not match the GitHub event SHA");
  return eventSha;
}
export function shardTestArgs(index) {
  assert([1, 2].includes(index), "Expected shard 1 or 2");
  return [
    "run",
    `--shard=${index}/2`,
    "--reporter=default",
    "--reporter=json",
    "--outputFile=.verification/test-results.json",
  ];
}
export function discoverTestFiles(root) {
  const files = [];
  const visit = (path) => {
    const stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), "Test inventory refuses source symlinks");
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
    else if (stat.isFile() && path.endsWith(".test.ts")) files.push(normalize(root, path));
  };
  visit(join(root, "src"));
  return files.sort();
}

export function aggregate(parts, expected) {
  assert.equal(expected.shardJobResult, "success", "Every matrix job must succeed");
  assert.equal(expected.priorStepsOk, "true", "Every preceding final-job gate must succeed");
  assert.equal(parts.length, 2, "Need both shard artifacts");
  assert(/^[a-f0-9]{40}$/.test(expected.commit));
  assert(/^[a-f0-9]{64}$/.test(expected.sourceHash));
  assert(
    /^\d+$/.test(expected.runId ?? "") && /^[1-9]\d*$/.test(expected.runAttempt ?? ""),
    "Require the current CI run and attempt",
  );
  const expectedInventory = inventory(expected.root, expected.inventory);
  assert.deepEqual(
    expectedInventory.map((item) => item.file).sort(),
    expected.physicalFiles.map((file) => normalize(expected.root, file)).sort(),
    "Configured inventory omits/adds a mandatory physical test file",
  );
  const seenShards = new Set(),
    seenFiles = new Set();
  const allAssertions = [];
  let firstPermission = Infinity;
  for (const part of parts) {
    const report = part.verify;
    assert.equal(report.complete, false, "Partial evidence must never be complete");
    assert.equal(report.part_complete, true);
    assert.equal(report.source_changed, false);
    assert.equal(report.interrupted, null);
    assert.equal(report.commit, expected.commit, "Stale/different SHA");
    assert.equal(report.source_hash, expected.sourceHash, "Stale/different source hash");
    assert.equal(report.run_id, expected.runId);
    assert.equal(report.run_attempt, expected.runAttempt);
    assert.equal(report.shard?.count, 2);
    assert([1, 2].includes(report.shard?.index));
    assert(!seenShards.has(report.shard.index), "Duplicate shard");
    seenShards.add(report.shard.index);
    assert.deepEqual(inventory(report.root, part.inventory), expectedInventory);
    assert.deepEqual(
      report.steps.map((step) => step.name),
      EXPECTED_STEPS,
    );
    const reportStarted = timestamp(report.started_at),
      reportFinished = timestamp(report.finished_at);
    assert(reportFinished >= reportStarted && reportFinished <= expected.now);
    assert.equal(report.duration_ms, reportFinished - reportStarted);
    const permissionFinished = timestamp(report.steps[0].finished_at);
    for (const step of report.steps) {
      assert.equal(step.ok, true);
      assert.equal(step.exit_code, 0);
      assert.equal(step.signal, null);
      const started = timestamp(step.started_at),
        finished = timestamp(step.finished_at);
      assert(finished >= started && finished <= expected.now);
      assert.equal(step.duration_ms, finished - started);
      assert(reportStarted <= started && reportFinished >= finished);
      if (step.name !== "permissions")
        assert(started >= permissionFinished, "Dependent checks started before permissions passed");
    }
    firstPermission = Math.min(firstPermission, timestamp(report.steps[0].started_at));
    assert.equal(
      report.steps[4].command,
      ["vitest", ...shardTestArgs(report.shard.index)].join(" "),
      "Vitest must execute the exact unfiltered canonical shard command",
    );
    assert(report.steps[1].command.endsWith("--test scripts/testing/verify-shards.test.mjs"));
    const result = part.tests;
    assert.equal(result.success, true);
    for (const key of [
      "numFailedTests",
      "numPendingTests",
      "numTodoTests",
      "numFailedTestSuites",
      "numPendingTestSuites",
    ])
      assert.equal(result[key], 0, `Rejected ${key}`);
    const assertions = [];
    assert(Array.isArray(result.testResults) && result.testResults.length > 0);
    for (const module of result.testResults) {
      assert.equal(module.status, "passed");
      assert.equal(module.message, "");
      const file = normalize(report.root, module.name);
      assert(!seenFiles.has(file), `Duplicate executed test file: ${file}`);
      seenFiles.add(file);
      assert(Array.isArray(module.assertionResults));
      assert(module.assertionResults.length > 0, "Executed test file contains no assertions");
      for (const assertion of module.assertionResults) {
        assert.equal(assertion.status, "passed", "Skipped/todo/failed assertion");
        assert.deepEqual(assertion.failureMessages, []);
        assertions.push(assertion);
      }
    }
    assert.equal(result.numTotalTests, assertions.length);
    assert.equal(result.numPassedTests, assertions.length);
    allAssertions.push(...assertions);
  }
  assert.deepEqual([...seenShards].sort(), [1, 2]);
  assert.deepEqual(
    [...seenFiles].sort(),
    expectedInventory.map((item) => item.file).sort(),
    "Missing/extra test files",
  );
  assert(allAssertions.length > 0, "No passed assertions");
  // Includes runner skew, artifact transport and this job's startup. Never use
  // max(duration), a sum, or averages to conceal real global elapsed time.
  const duration = expected.now - firstPermission;
  assert(
    Number.isFinite(duration) && duration >= 0 && duration <= VERIFY_BUDGET_MS,
    "Global verification exceeded 240 seconds",
  );
  return {
    complete: true,
    commit: expected.commit,
    source_hash: expected.sourceHash,
    started_at: new Date(firstPermission).toISOString(),
    finished_at: new Date(expected.now).toISOString(),
    duration_ms: duration,
    interrupted: null,
    source_changed: false,
    run_id: expected.runId,
    run_attempt: expected.runAttempt,
    shard_count: 2,
    test_files: seenFiles.size,
    passed_assertions: allAssertions.length,
    steps: parts.flatMap((part) =>
      part.verify.steps.map((step) => ({ ...step, shard: part.verify.shard.index })),
    ),
  };
}

async function main() {
  mkdirSync(".verification", { recursive: true });
  const reportPath = ".verification/verify.json";
  writeFileSync(reportPath, JSON.stringify({ complete: false }));
  try {
    const { sourceFingerprint } = await import("./perf/source-fingerprint.mjs");
    const read = (path) => JSON.parse(readFileSync(path, "utf8"));
    const root = process.argv[2] ?? ".verification-parts";
    const dirs = readdirSync(root);
    assert.equal(dirs.length, 2);
    const parts = dirs.map((dir) => ({
      verify: read(join(root, dir, "verify.json")),
      inventory: read(join(root, dir, "test-inventory.json")),
      tests: read(join(root, dir, "test-results.json")),
    }));
    const currentHash = sourceFingerprint();
    const result = aggregate(parts, {
      commit: currentCiCommit(
        execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        process.env.GITHUB_SHA,
      ),
      sourceHash: currentHash,
      root: process.cwd(),
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      shardJobResult: process.env.SHARD_JOB_RESULT,
      priorStepsOk: process.env.VERIFY_PREVIOUS_STEPS_OK,
      inventory: read(".verification/test-inventory.json"),
      physicalFiles: discoverTestFiles(process.cwd()),
      now: Date.now(),
    });
    assert.equal(currentHash, sourceFingerprint(), "Sources changed during aggregation");
    result.finished_at = new Date().toISOString();
    result.duration_ms = Date.parse(result.finished_at) - Date.parse(result.started_at);
    assert(
      result.duration_ms >= 0 && result.duration_ms <= VERIFY_BUDGET_MS,
      "Global verification exceeded 240 seconds during finalization",
    );
    writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(
      `Full verification: ${result.test_files} files, ${result.passed_assertions} assertions, ${result.duration_ms}ms`,
    );
  } catch (error) {
    writeFileSync(
      reportPath,
      JSON.stringify(
        { complete: false, error: String(error), finished_at: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.error(error);
    process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
