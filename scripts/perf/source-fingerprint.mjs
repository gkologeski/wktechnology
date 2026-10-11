import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";
export function sourceFingerprint(root = process.cwd()) {
  const files = [];
  const visit = (path) => {
    if (!existsSync(path)) return;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("Source symlink refused");
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
    else if (stat.isFile()) files.push(path);
  };
  for (const name of [
    "src",
    "scripts",
    "drizzle",
    ".github/workflows",
    "package.json",
    "bun.lock",
    "vite.config.ts",
    "tsconfig.json",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.typed.config.mjs",
    "vitest.config.ts",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "wrangler.jsonc",
  ])
    visit(join(root, name));
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    const name = relative(root, file);
    // The isolated harness changes only the registry mirror URL. Versions and SRI
    // remain locked; normalize that transport detail so identical sources match.
    const contents =
      name === "bun.lock"
        ? readFileSync(file, "utf8").replace(
            /https:\/\/europe-west\d-npm\.pkg\.dev\/lovable-core-prod\/sandbox-npm-cache\//g,
            "https://registry.npmjs.org/",
          )
        : readFileSync(file);
    hash.update(name).update("\0").update(contents).update("\0");
  }
  return hash.digest("hex");
}
