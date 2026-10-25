import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertCiWiring,
  baselineMatches,
  BASELINE_PATH,
  CATALOG_PATH,
  checkCoverage,
  CONTRACTS_PATH,
  hash,
  isProductionPath,
  projectRoot,
  readSource,
  type Contract,
  type Finding,
  type Snapshot,
} from "./security/permission-gate";

const root = projectRoot;
const reportPath = join(root, ".verification/permissions.json");
const bootstrap = "faca56d27e3e60bc7609208f97704e3e571abb98";
const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const previous = (base: string, file: string) => {
  try {
    return git("show", `${base}:${file}`);
  } catch {
    return undefined;
  }
};
let report: Record<string, unknown>;
try {
  const at = process.argv.indexOf("--base");
  let base: string | undefined = at >= 0 ? process.argv[at + 1] : undefined;
  if (!base && process.env.CI) {
    if (!process.env.GITHUB_EVENT_PATH)
      throw Error("CI needs its trusted GitHub event/base, not HEAD fallback");
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    base =
      process.env.GITHUB_EVENT_NAME === "pull_request"
        ? event.pull_request?.base?.sha
        : event.before;
  }
  if (!base && !process.env.CI) base = git("rev-parse", "HEAD");
  if (!base || !/^[a-f0-9]{40}$/.test(base) || /^0+$/.test(base))
    throw Error("Invalid/missing comparison SHA; fetch the real base");
  git("cat-file", "-e", `${base}^{commit}`);
  const baselineText = readSource(root, BASELINE_PATH).trim(),
    oldBaseline = previous(base, BASELINE_PATH);
  if (!baselineMatches(baselineText, oldBaseline, base, bootstrap))
    throw Error(
      "Immutable baseline changed or unavailable; new sources need contracts, never rebaseline",
    );
  const baseline = JSON.parse(baselineText) as Snapshot;
  if (baseline.source_commit !== bootstrap) throw Error("Unexpected baseline origin");
  if (!oldBaseline) {
    const original = new Map(
      git(
        "ls-tree",
        "-r",
        "--full-tree",
        base,
        "--",
        "src",
        "drizzle/migrations",
        "supabase/migrations",
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [meta, file] = line.split("\t");
          return [file, meta.split(" ")[2]] as const;
        })
        .filter(([file]) => isProductionPath(file)),
    );
    if (
      original.size !== Object.keys(baseline.files).length ||
      Object.keys(baseline.files).some((file) => !original.has(file))
    )
      throw Error("Bootstrap baseline does not match the trusted source tree");
    for (const [file, digest] of Object.entries(baseline.files)) {
      let source: string;
      try {
        source = readSource(root, file);
      } catch {
        source = git("show", `${base}:${file}`) + "\n";
      }
      if (hash(source) !== digest) {
        source = execFileSync("git", ["show", `${base}:${file}`], {
          cwd: root,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        });
        if (hash(source) !== digest)
          throw Error(`Bootstrap hash differs from trusted history: ${file}`);
      }
      const blob = createHash("sha1")
        .update(`blob ${Buffer.byteLength(source)}\0`)
        .update(source)
        .digest("hex");
      if (blob !== original.get(file))
        throw Error(`Bootstrap source is not from the declared commit: ${file}`);
    }
  }

  const manifest = JSON.parse(readSource(root, CONTRACTS_PATH)) as {
    schema_version: number;
    contracts: Contract[];
    retired: Record<string, { sha256: string; rationale: string }>;
  };
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.contracts))
    throw Error("Invalid permission contract manifest");
  const catalog = JSON.parse(readSource(root, CATALOG_PATH)) as {
    schema_version: number;
    keys: string[];
    additions?: Record<string, { migration: string }>;
  };
  if (
    catalog.schema_version !== 1 ||
    !Array.isArray(catalog.keys) ||
    new Set(catalog.keys).size !== catalog.keys.length
  )
    throw Error("Invalid/duplicate catalog keys");
  const oldCatalogText = previous(base, CATALOG_PATH);
  if (!oldCatalogText && base !== bootstrap) throw Error("Catalog baseline unavailable");
  const oldKeys = new Set<string>(oldCatalogText ? JSON.parse(oldCatalogText).keys : catalog.keys);
  const extra: Finding[] = [];
  for (const key of oldKeys)
    if (!catalog.keys.includes(key))
      extra.push({
        code: "catalog_removal",
        message: `Catalog key removal needs a separate compatibility migration: ${key}`,
      });
  for (const key of catalog.keys.filter((k) => !oldKeys.has(k))) {
    const file = catalog.additions?.[key]?.migration;
    if (
      !file ||
      baseline.files[file] ||
      !file.endsWith(".sql") ||
      !readSource(root, file)
        .replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g, " ")
        .includes(`'${key}'`)
    )
      extra.push({
        code: "catalog_addition",
        file,
        message: `New key needs literal registration in a new migration: ${key}`,
      });
  }
  const result = checkCoverage(
    root,
    baseline,
    manifest.contracts,
    new Set(catalog.keys),
    new Date(),
    manifest.retired,
  );
  const findings = [...result.findings, ...extra, ...assertCiWiring(root)];
  report = {
    complete: findings.length === 0,
    checked_at: new Date().toISOString(),
    comparison_base: base,
    baseline_origin: bootstrap,
    counts: result.counts,
    changed: result.changed,
    findings,
    limitations: [
      "Historical baseline is an inventory, not proof of enforcement.",
      "Static control bindings and executed unit scenarios do not formally prove SQL security or UI behavior.",
      "GitHub branch rules determine whether a failed check blocks merging; this job alone does not configure repository protection.",
    ],
  };
} catch (error) {
  report = {
    complete: false,
    checked_at: new Date().toISOString(),
    findings: [
      { code: "gate_failure", message: error instanceof Error ? error.message : String(error) },
    ],
  };
}
mkdirSync(join(root, ".verification"), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.complete) process.exitCode = 1;
