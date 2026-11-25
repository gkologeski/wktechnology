import { describe, expect, it } from "vitest";
import {
  computeBuildHeapMb,
  detectAvailableMemoryBytes,
  readCgroupMemoryLimitBytes,
  sanitizeNodeOptions,
} from "../../../scripts/perf/build-heap.mjs";

const GiB = 1024 * 1024 * 1024;

describe("build heap sizing", () => {
  it("scales heap safely for sandbox, CI and smaller hosts", () => {
    expect(computeBuildHeapMb(31 * GiB, "")).toBe(16384);
    expect(computeBuildHeapMb(16 * GiB, "")).toBe(10649);
    expect(computeBuildHeapMb(12 * GiB, "")).toBe(8192);
    expect(computeBuildHeapMb(8 * GiB, "")).toBe(6144);
  });

  it("honors explicit TECHERP_BUILD_HEAP_MB override within safe bounds", () => {
    expect(computeBuildHeapMb(31 * GiB, "12288")).toBe(12288);
    expect(computeBuildHeapMb(31 * GiB, "2048")).toBe(4096);
    expect(computeBuildHeapMb(31 * GiB, "65536")).toBe(24576);
  });

  it("respects cgroup limits when tighter than host RAM", () => {
    const cgroupV2 = readCgroupMemoryLimitBytes((p) =>
      p === "/sys/fs/cgroup/memory.max" ? String(16 * GiB) : "",
    );
    expect(cgroupV2).toBe(16 * GiB);
    expect(detectAvailableMemoryBytes(31 * GiB, cgroupV2)).toBe(16 * GiB);

    const unlimited = readCgroupMemoryLimitBytes((p) =>
      p === "/sys/fs/cgroup/memory.max" ? "max\n" : "9223372036854771712\n",
    );
    expect(unlimited).toBeNull();
    expect(detectAvailableMemoryBytes(31 * GiB, unlimited)).toBe(31 * GiB);
  });

  it("replaces inherited --max-old-space-size in NODE_OPTIONS without dropping other flags", () => {
    const sanitized = sanitizeNodeOptions(
      "--dns-result-order=ipv4first --max-old-space-size=3072 --max-semi-space-size=64 --expose-gc --use-openssl-ca",
      16384,
    );
    expect(sanitized).toBe(
      "--dns-result-order=ipv4first --max-semi-space-size=64 --use-openssl-ca --max-old-space-size=16384 --expose-gc",
    );

    const spaceForm = sanitizeNodeOptions("--max-old-space-size 3072 --use-openssl-ca", 12288);
    expect(spaceForm).toBe("--use-openssl-ca --max-old-space-size=12288 --expose-gc");
  });
});
