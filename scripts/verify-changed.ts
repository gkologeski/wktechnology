#!/usr/bin/env bun
/**
 * Feedback incremental de desenvolvimento — NÃO substitui `bun run verify`.
 *
 * - Typecheck: sempre completo (tsgo). Não há project references válidas, então
 *   checagem parcial de tipos não seria segura.
 * - Lint: só os arquivos alterados (ESLint com cache por conteúdo).
 * - Testes: `vitest related`, que segue o grafo real de imports dos testes até os
 *   arquivos alterados (inclui testes de outros módulos que importam o arquivo).
 * - Fallback total (lint . + vitest run) quando muda algo compartilhado, de
 *   configuração, gerado, lockfile, ou quando não há como saber o que mudou.
 *
 * Uso: bun scripts/verify-changed.ts [--base <ref>] [--dry-run] [arquivos...]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { classifyChanges } from "./verify-changed/select";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const baseIdx = args.indexOf("--base");
if (
  args.some((a) => a.startsWith("--") && a !== "--base" && a !== "--dry-run") ||
  (baseIdx >= 0 && (!args[baseIdx + 1] || args[baseIdx + 1].startsWith("--")))
) {
  console.error("Uso: bun run verify:changed [--base <ref>] [--dry-run] [arquivos...]");
  process.exit(2);
}
const base = baseIdx >= 0 ? args[baseIdx + 1] : "HEAD";
const explicit = args.filter((a, i) => !a.startsWith("--") && (baseIdx < 0 || i !== baseIdx + 1));

function git(cmd: string[]): string[] | null {
  const r = spawnSync("git", cmd, { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.split("\0").filter(Boolean);
}

let changed: string[] | null = explicit.length ? explicit : null;
if (!changed) {
  const diff = git(["diff", "--name-only", "-z", base, "--"]);
  const untracked = git(["ls-files", "-z", "--others", "--exclude-standard"]);
  changed = diff && untracked ? [...new Set([...diff, ...untracked])] : null;
}

const plan = classifyChanges(changed, (f) => existsSync(f));
console.log(`[verify-changed] modo: ${plan.mode}${plan.reason ? ` (${plan.reason})` : ""}`);
if (plan.modules.length)
  console.log(`[verify-changed] módulos tocados: ${plan.modules.join(", ")}`);

const steps: { name: string; cmd: string[] }[] = [
  { name: "typecheck (completo)", cmd: ["bunx", "tsgo", "--noEmit"] },
];
if (plan.mode === "full") {
  steps.push({ name: "lint (completo)", cmd: ["bun", "run", "lint"] });
  steps.push({ name: "testes (completo)", cmd: ["bunx", "vitest", "run"] });
} else if (plan.mode === "incremental") {
  if (plan.lintFiles.length)
    steps.push({
      name: `lint (${plan.lintFiles.length} arquivos)`,
      cmd: [
        "bunx",
        "eslint",
        "--cache",
        "--cache-location",
        ".eslintcache",
        "--cache-strategy",
        "content",
        ...plan.lintFiles,
      ],
    });
  if (plan.testTargets.length)
    steps.push({
      name: `testes relacionados (${plan.testTargets.length} alvos)`,
      cmd: ["bunx", "vitest", "related", "--run", "--passWithNoTests", ...plan.testTargets],
    });
}

if (dry) {
  for (const s of steps) console.log(`[dry-run] ${s.name}: ${s.cmd.join(" ")}`);
  process.exit(0);
}
let failed = 0;
const started = Date.now();
const results: { name: string; duration_ms: number; exit_code: number; ok: boolean }[] = [];
mkdirSync(".verification", { recursive: true });
const report = (finished: boolean) =>
  writeFileSync(
    ".verification/changed.json",
    JSON.stringify(
      {
        kind: "development-feedback",
        release_eligible: false,
        finished,
        ok: finished && failed === 0,
        started_at: new Date(started).toISOString(),
        duration_ms: Date.now() - started,
        base,
        plan,
        steps: results,
      },
      null,
      2,
    ),
  );
report(false);
for (const s of steps) {
  const t = Date.now();
  const r = spawnSync(s.cmd[0], s.cmd.slice(1), { stdio: "inherit" });
  const ok = r.status === 0;
  results.push({ name: s.name, duration_ms: Date.now() - t, exit_code: r.status ?? 1, ok });
  console.log(
    `[verify-changed] ${ok ? "OK" : "FALHOU"} ${s.name} em ${((Date.now() - t) / 1000).toFixed(1)}s`,
  );
  if (!ok) failed = r.status ?? 1;
  report(false);
}
report(true);
console.log(
  "[verify-changed] Lembrete: antes de entregar/publicar rode `bun run verify` e `bun run build`.",
);
process.exit(failed);
