export function readCgroupMemoryLimitBytes(readText?: (path: string) => string): number | null;
export function detectAvailableMemoryBytes(hostBytes?: number, cgroupBytes?: number | null): number;
export function computeBuildHeapMb(totalMemoryBytes: number, overrideRaw?: string): number;
export function sanitizeNodeOptions(rawNodeOptions: string | undefined, heapMb: number): string;