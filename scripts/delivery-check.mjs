#!/usr/bin/env node
// Read-only release evidence. Authentication is delegated to Git/SSH, never tokens in files.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sourceFingerprint } from "./perf/source-fingerprint.mjs";

export const publishedUrls = [
  "https://app.wktechnology.com.br/build-info.json",
  "https://wktechnology.lovable.app/build-info.json",
];

export function validateLocalEvidence(verify, build, currentHash) {
  if (!verify?.complete || !build?.complete || build?.finalized !== true)
    throw new Error("Full verification and finalized build are required");
  if (
    !/^[a-f0-9]{64}$/.test(currentHash) ||
    verify.source_hash !== currentHash ||
    build.source_hash !== currentHash
  )
    throw new Error("Verification/build do not match the current source");
  return currentHash;
}

export function validatePublishedVersions(expectedHash, versions) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error("Invalid source hash");
  if (versions.length !== publishedUrls.length)
    throw new Error("Every published domain must be checked");
  for (let i = 0; i < versions.length; i++) {
    if (
      versions[i]?.url !== publishedUrls[i] ||
      versions[i]?.source_hash !== expectedHash ||
      !Number.isFinite(Date.parse(versions[i]?.built_at))
    )
      throw new Error(`Published version mismatch: ${publishedUrls[i]}`);
  }
  return true;
}

export async function readPublishedVersion(url, fetcher = fetch) {
  if (!publishedUrls.includes(url)) throw new Error("Unknown published endpoint");
  let current = url;
  const visited = new Set();
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (visited.has(current)) throw new Error("Published endpoint redirect loop");
    visited.add(current);
    const response = await fetcher(current, {
      signal: AbortSignal.timeout(20_000),
      redirect: "manual",
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Invalid published endpoint redirect");
      const next = new URL(location, current).href;
      if (!publishedUrls.includes(next))
        throw new Error("Published redirect outside known endpoints");
      await response.body?.cancel();
      current = next;
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${current}`);
    const body = await response.text();
    if (body.length > 4096) throw new Error("Unexpected build metadata size");
    const data = JSON.parse(body);
    return { url, resolved_url: current, source_hash: data.source_hash, built_at: data.built_at };
  }
  throw new Error("Too many published endpoint redirects");
}

export function parseDeliveryArgs(args) {
  let prepare = false;
  let expectedCommit;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prepare" && !prepare) prepare = true;
    else if (args[i] === "--expected-commit" && !expectedCommit) {
      expectedCommit = args[++i];
      if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? "")) throw new Error("Invalid expected commit");
    } else throw new Error("Use --prepare or --expected-commit <40-character SHA>");
  }
  return { prepare, expectedCommit };
}

async function main() {
  const args = parseDeliveryArgs(process.argv.slice(2));
  const git = (...argv) => execFileSync("git", argv, { encoding: "utf8", timeout: 30_000 }).trim();
  mkdirSync(".verification", { recursive: true });
  const result = {
    complete: false,
    published: false,
    mode: args.prepare ? "prepared" : "published",
    started_at: new Date().toISOString(),
  };
  const save = () => writeFileSync(".verification/delivery.json", JSON.stringify(result, null, 2));
  save();
  try {
    if (git("status", "--porcelain")) throw new Error("Commit or preserve uncommitted work first");
    const read = (name) => JSON.parse(readFileSync(`.verification/${name}.json`, "utf8"));
    result.source_hash = validateLocalEvidence(read("verify"), read("build"), sourceFingerprint());
    execFileSync("bun", ["run", "perf:check"], { encoding: "utf8", timeout: 30_000 });
    result.performance_verified = true;
    result.commit = args.expectedCommit ?? git("rev-parse", "HEAD");
    result.branch = git("branch", "--show-current");
    if (!result.branch) throw new Error("Use an attached branch for delivery");
    if (args.prepare) {
      // Checks the existing push transport without writing a branch or changing access.
      git("push", "--dry-run", "origin", `HEAD:refs/heads/${result.branch}`);
      result.transport_verified = true;
    } else {
      const remoteCommit = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
      if (remoteCommit !== result.commit)
        throw new Error("Remote main does not match the expected commit");
      git("fetch", "--no-tags", "origin", "main");
      if (git("rev-parse", "origin/main") !== result.commit)
        throw new Error("Remote main changed during verification");
      if (git("rev-parse", `${result.commit}^{tree}`) !== git("rev-parse", "HEAD^{tree}"))
        throw new Error("Expected commit has a different tree from the verified source");
      result.domains = [];
      for (const url of publishedUrls) result.domains.push(await readPublishedVersion(url));
      validatePublishedVersions(result.source_hash, result.domains);
    }
    result.complete = true;
    result.published = !args.prepare;
    console.log(`Delivery ${result.mode} verified: ${result.commit}`);
  } catch (error) {
    result.error = error.message;
    process.exitCode = 1;
    console.error(error.message);
  } finally {
    result.finished_at = new Date().toISOString();
    save();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
