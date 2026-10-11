// A report is successful only after Vite itself exits successfully, including finalization.
import { sourceFingerprint } from "./source-fingerprint.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const path = ".verification/build.json";
const started = Date.now();
const sourceHash = sourceFingerprint();
mkdirSync(".verification", { recursive: true });
writeFileSync(path, JSON.stringify({ complete: false, phases: {}, duration_ms: 0 }));
let interrupted = null;
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TECHERP_BUILD_SOURCE_HASH: sourceHash,
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=8192",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = signal;
    child.kill(signal);
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 3000).unref();
  });
let spawnError = null;
child.on("error", (error) => {
  spawnError = error.message;
});
child.on("close", (code, signal) => {
  let report;
  try {
    report = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    report = { phases: {} };
  }
  report.duration_ms = Date.now() - started;
  report.exit_code = code;
  report.signal = interrupted || signal || null;
  report.finalized = true;
  report.source_hash = sourceHash;
  report.source_changed = sourceHash !== sourceFingerprint();
  report.complete =
    !report.source_changed &&
    code === 0 &&
    !report.signal &&
    !spawnError &&
    ["client", "ssr", "nitro"].every((name) => report.phases[name]?.complete);
  if (spawnError) report.error = spawnError;
  writeFileSync(path, JSON.stringify(report, null, 2));
  process.exitCode = report.complete ? 0 : interrupted === "SIGINT" ? 130 : code || 1;
});
