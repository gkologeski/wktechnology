// Disposable application preparation: same versions/integrities as Lovable's bun.lock.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, lstatSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export function prepareLockedApp(repo, app) {
  mkdirSync(app, { recursive: true });
  if (lstatSync(app).isSymbolicLink()) throw new Error("Invalid application directory");
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repo, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const added = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z", "--", "src", "scripts", "drizzle"],
    { cwd: repo, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  for (const name of new Set([...tracked, ...added])) {
    if (basename(name).startsWith(".env") || [".dev.vars", ".npmrc"].includes(basename(name)))
      continue;
    const from = resolve(repo, name),
      to = resolve(app, name);
    if (!from.startsWith(repo + "/") || !to.startsWith(app + "/") || !lstatSync(from).isFile())
      throw new Error("Invalid source file");
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  // Only change the registry location. Package names, versions, dependencies and SRI stay intact.
  const original = readFileSync(resolve(repo, "bun.lock"), "utf8");
  const portable = original.replace(
    /https:\/\/europe-west\d-npm\.pkg\.dev\/lovable-core-prod\/sandbox-npm-cache\//g,
    "https://registry.npmjs.org/",
  );
  writeFileSync(resolve(app, "bun.lock"), portable);
  return createHash("sha256")
    .update(readFileSync(resolve(repo, "package.json")))
    .update(original)
    .digest("hex");
}
