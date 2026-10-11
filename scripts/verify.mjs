#!/usr/bin/env node
// Gate completo e SEQUENCIAL: typecheck → lint → testes. Não pula falhas:
// todas as etapas rodam e o código de saída é o da primeira que falhou.
// Grava .verification/verify.json; complete=true só se todas passarem.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const STEPS = [
  { name: "typecheck", cmd: "tsgo", args: ["--noEmit", "--incremental", "false"] },
  {
    name: "lint",
    cmd: "eslint",
    args: [".", "--cache", "--cache-location", ".eslintcache", "--cache-strategy", "content"],
  },
  { name: "test", cmd: "vitest", args: ["run"] },
];
const MAX_OUTPUT = 200_000; // caracteres guardados por etapa (fim da saída)

let child = null;
let interrupted = null;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    interrupted = sig;
    if (child && child.exitCode === null) child.kill(sig);
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
    child = spawn(step.cmd, step.args, {
      env: { ...process.env, PATH: `node_modules/.bin:${process.env.PATH}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (b) => keep(b, process.stdout));
    child.stderr.on("data", (b) => keep(b, process.stderr));
    const done = (code, signal) => {
      const finished = new Date();
      resolve({
        name: step.name,
        command: [step.cmd, ...step.args].join(" "),
        started_at: started.toISOString(),
        finished_at: finished.toISOString(),
        duration_ms: finished - started,
        exit_code: code,
        signal: signal ?? null,
        ok: code === 0,
        output,
      });
    };
    child.on("error", (e) => done(127, null, (output += String(e))));
    child.on("close", done);
  });
}

const startedAt = new Date();
const results = [];
for (const step of STEPS) {
  if (interrupted) break;
  console.log(`\n[verify] ▶ ${step.name}`);
  const r = await run(step);
  results.push(r);
  console.log(`[verify] ${r.ok ? "OK" : "FALHOU"} ${step.name} em ${(r.duration_ms / 1000).toFixed(1)}s`);
}
const finishedAt = new Date();
const complete = !interrupted && results.length === STEPS.length && results.every((r) => r.ok);
mkdirSync(".verification", { recursive: true });
writeFileSync(
  ".verification/verify.json",
  JSON.stringify(
    {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt - startedAt,
      interrupted,
      complete,
      steps: results,
    },
    null,
    2,
  ),
);
console.log(`\n[verify] complete=${complete} total ${((finishedAt - startedAt) / 1000).toFixed(1)}s`);
const firstFail = results.find((r) => !r.ok);
process.exit(complete ? 0 : interrupted ? 130 : (firstFail?.exit_code || 1));
