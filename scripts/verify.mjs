#!/usr/bin/env node
// Permissões primeiro; tipos, lint e testes independentes em paralelo. Não pula falhas:
// todas as etapas rodam e o código de saída é o da primeira que falhou.
// Grava .verification/verify.json; complete=true só se todas passarem.
import { spawn, execFileSync } from "node:child_process";
import { sourceFingerprint } from "./perf/source-fingerprint.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
// O wrapper do tsgo usa execFileSync e não repassa sinais: chama o binário nativo.
import getTsgoExe from "../node_modules/@typescript/native-preview/lib/getExePath.js";

const STEPS = [
  { name: "permissions", cmd: "bun", args: ["scripts/check-permissions.ts"] },
  { name: "typecheck", cmd: getTsgoExe(), args: ["--noEmit", "--incremental", "false"] },
  {
    name: "lint",
    cmd: "eslint",
    args: [".", "--cache", "--cache-location", ".eslintcache", "--cache-strategy", "content"],
  },
  { name: "test", cmd: "vitest", args: ["run"] },
];
// Shards validate all standard steps; only the final aggregator may certify complete.
const shardInput = process.env.VERIFY_SHARD;
const aggregateInput = process.env.VERIFY_AGGREGATE;
if (shardInput !== undefined && !/^[1-4]\/4$/.test(shardInput))
  throw new Error("VERIFY_SHARD must be 1/4, 2/4, 3/4 or 4/4");
if (aggregateInput !== undefined && aggregateInput !== "1")
  throw new Error("VERIFY_AGGREGATE must be 1");
if (shardInput && aggregateInput) throw new Error("Shard and aggregate modes are exclusive");
const shard = shardInput ? { index: Number(shardInput[0]), count: 4 } : null;
const identity = shard
  ? {
      shard,
      root: process.cwd(),
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      run_id: process.env.GITHUB_RUN_ID,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    }
  : {};
if (
  shard &&
  process.env.GITHUB_ACTIONS === "true" &&
  (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ||
    identity.commit !== process.env.GITHUB_SHA)
)
  throw new Error("Shard checkout must match the GitHub event SHA");
if (shard) {
  const { shardTestArgs } = await import("./verify-shards.mjs");
  STEPS[3].args = shardTestArgs(shard.index);
}
if (shard)
  STEPS.splice(1, 0, {
    name: "orchestration",
    cmd: process.execPath,
    args: ["--test", "scripts/testing/verify-shards.test.mjs"],
  });

const MAX_OUTPUT = 200_000; // caracteres guardados por etapa (fim da saída)

const children = new Set();
let interrupted = null;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    interrupted = sig;
    for (const child of children) {
      if (child.exitCode !== null) continue;
      child.kill(sig);
      // O tsgo ignora SIGTERM (medido: termina a checagem e sai 0). Após 3 s, força.
      const c = child;
      setTimeout(
        () => c.exitCode === null && c.signalCode === null && c.kill("SIGKILL"),
        3000,
      ).unref();
    }
  });
}

function run(step) {
  return new Promise((resolve) => {
    const started = new Date();
    let output = "";
    const keep = (buf, stream) => {
      stream.write(buf);
      output = (output + buf.toString()).slice(-MAX_OUTPUT);
    };
    const childEnv = { ...process.env, PATH: `node_modules/.bin:${process.env.PATH}` };
    // Nested orchestration fixtures must retain the default full-verification
    // mode. Vitest receives its shard through argv, not inherited control flags.
    delete childEnv.VERIFY_SHARD;
    delete childEnv.VERIFY_AGGREGATE;
    const child = spawn(step.cmd, step.args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    child.stdout.on("data", (b) => keep(b, process.stdout));
    child.stderr.on("data", (b) => keep(b, process.stderr));
    const done = (code, signal) => {
      children.delete(child);
      const finished = new Date();
      resolve({
        name: step.name,
        command: [step.cmd, ...step.args].join(" "),
        started_at: started.toISOString(),
        finished_at: finished.toISOString(),
        duration_ms: finished - started,
        exit_code: code,
        signal: signal ?? null,
        ok: code === 0 && !interrupted,
        output,
      });
    };
    child.on("error", (e) => {
      output += String(e);
      done(127, null);
    });
    child.on("close", done);
  });
}

const sourceHash = sourceFingerprint();
const startedAt = new Date();
mkdirSync(".verification", { recursive: true });
writeFileSync(
  ".verification/verify.json",
  JSON.stringify({
    complete: false,
    ...identity,
    source_hash: sourceHash,
    started_at: startedAt.toISOString(),
    steps: [],
  }),
);
async function runLogged(step) {
  console.log(`\n[verify] ▶ ${step.name}`);
  const r = await run(step);
  console.log(
    `[verify] ${r.ok ? "OK" : "FALHOU"} ${step.name} em ${(r.duration_ms / 1000).toFixed(1)}s`,
  );
  return r;
}
const results = [await runLogged(STEPS[0])];
if (aggregateInput && results[0].ok && !interrupted) {
  const combined = await runLogged({
    name: "aggregate",
    cmd: process.execPath,
    args: ["scripts/verify-shards.mjs", ".verification-parts"],
  });
  // The aggregator alone writes the complete proof. Do not overwrite it with
  // a local report that has not independently executed the product suite.
  process.exit(combined.ok ? 0 : interrupted ? 130 : combined.exit_code || 1);
}
// Authorization evidence must succeed before starting any dependent validation.
if (results[0].ok && !interrupted)
  results.push(...(await Promise.all(STEPS.slice(1).map(runLogged))));
const sourceChanged = sourceHash !== sourceFingerprint();
const finishedAt = new Date();
const complete =
  !sourceChanged && !interrupted && results.length === STEPS.length && results.every((r) => r.ok);
mkdirSync(".verification", { recursive: true });
writeFileSync(
  ".verification/verify.json",
  JSON.stringify(
    {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt - startedAt,
      interrupted,
      source_hash: sourceHash,
      source_changed: sourceChanged,
      complete: complete && !shard,
      part_complete: shard ? complete : undefined,
      ...identity,
      steps: results,
    },
    null,
    2,
  ),
);
console.log(
  `\n[verify] complete=${complete && !shard} part_complete=${shard ? complete : "n/a"} total ${((finishedAt - startedAt) / 1000).toFixed(1)}s`,
);
const firstFail = results.find((r) => !r.ok);
process.exit(complete ? 0 : interrupted ? 130 : firstFail?.exit_code || 1);
