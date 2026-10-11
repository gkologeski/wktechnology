import { sourceFingerprint } from "./source-fingerprint.mjs";
import { readFileSync } from "node:fs";
import { checkBuild, budgets } from "../../src/lib/performance/budgets";
const read = (name: string) => JSON.parse(readFileSync(name, "utf8"));
const build = read(".verification/build.json");
const failures = checkBuild(build);
const verify = read(".verification/verify.json");
const currentHash = sourceFingerprint();
if (build.source_hash !== currentHash || verify.source_hash !== currentHash)
  failures.push("stale source verification/build");
if (
  !verify.complete ||
  !Number.isFinite(verify.duration_ms) ||
  verify.duration_ms < 0 ||
  verify.duration_ms > budgets.verify_ms
)
  failures.push("verification incomplete or slow");
if (failures.length) {
  console.error(`Performance gate failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else
  console.log("Performance budgets approved: complete verification/build, Nitro and client entry.");
