import { readFileSync } from "node:fs";
import { totalmem } from "node:os";

const CGROUP_V1_UNLIMITED_THRESHOLD = 1e15;
const MIN_HEAP_MB = 4096;
const DEFAULT_MIN_HEAP_MB = 8192;
const MAX_AUTO_HEAP_MB = 16384;
const MAX_OVERRIDE_HEAP_MB = 24576;

export function readCgroupMemoryLimitBytes(readText = (p) => readFileSync(p, "utf8")) {
  try {
    const raw = readText("/sys/fs/cgroup/memory.max").trim();
    if (/^\d+$/.test(raw)) {
      const bytes = Number(raw);
      if (Number.isFinite(bytes) && bytes > 0) return bytes;
    }
  } catch {
    // cgroup v2 unavailable
  }
  try {
    const raw = readText("/sys/fs/cgroup/memory/memory.limit_in_bytes").trim();
    if (/^\d+$/.test(raw)) {
      const bytes = Number(raw);
      if (Number.isFinite(bytes) && bytes > 0 && bytes < CGROUP_V1_UNLIMITED_THRESHOLD) {
        return bytes;
      }
    }
  } catch {
    // cgroup v1 unavailable
  }
  return null;
}

export function detectAvailableMemoryBytes(
  hostBytes = totalmem(),
  cgroupBytes = readCgroupMemoryLimitBytes(),
) {
  if (typeof cgroupBytes === "number" && Number.isFinite(cgroupBytes) && cgroupBytes > 0) {
    return Math.min(hostBytes, cgroupBytes);
  }
  return hostBytes;
}

export function computeBuildHeapMb(
  totalMemoryBytes,
  overrideRaw = process.env["TECHERP_BUILD_HEAP_MB"],
) {
  if (typeof overrideRaw === "string" && /^\d+$/.test(overrideRaw.trim())) {
    const parsed = Number(overrideRaw.trim());
    if (Number.isFinite(parsed) && parsed >= 1024) {
      return Math.min(MAX_OVERRIDE_HEAP_MB, Math.max(MIN_HEAP_MB, Math.floor(parsed)));
    }
  }
  const totalMiB = Math.floor(totalMemoryBytes / (1024 * 1024));
  if (!Number.isFinite(totalMiB) || totalMiB <= 0) return DEFAULT_MIN_HEAP_MB;
  if (totalMiB < 10240) return Math.max(MIN_HEAP_MB, Math.floor(totalMiB * 0.75));
  return Math.min(MAX_AUTO_HEAP_MB, Math.max(DEFAULT_MIN_HEAP_MB, Math.floor(totalMiB * 0.65)));
}

export function sanitizeNodeOptions(rawNodeOptions, heapMb) {
  const tokens =
    typeof rawNodeOptions === "string" ? rawNodeOptions.trim().split(/\s+/).filter(Boolean) : [];
  const kept = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "--max-old-space-size") {
      i += 1;
      continue;
    }
    if (token.startsWith("--max-old-space-size=")) continue;
    if (token === "--expose-gc") continue;
    kept.push(token);
  }
  kept.push(`--max-old-space-size=${heapMb}`, "--expose-gc");
  return kept.join(" ");
}
