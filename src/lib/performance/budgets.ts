// Baseline local cycle14 + headroom. Change limits only after a reviewed new baseline.
export const budgets = {
  build_ms: 240_000,
  verify_ms: 240_000,
  nitro_ms: 120_000,
  entry_gzip_bytes: 280_000,
  warm_route_p95_ms: 3_000,
  local_read_p95_ms: 500,
};
export type BuildReport = {
  complete: boolean;
  finalized?: boolean;
  duration_ms: number;
  phases: Record<string, { complete: boolean; duration_ms: number; entry_gzip_bytes: number }>;
};
export function checkBuild(report: BuildReport): string[] {
  const failures: string[] = [];
  if (!report?.complete || report.finalized !== true) failures.push("incomplete build");
  if (
    !Number.isFinite(report?.duration_ms) ||
    report.duration_ms < 0 ||
    report.duration_ms > budgets.build_ms
  )
    failures.push("build time");
  for (const phase of ["client", "ssr", "nitro"])
    if (!report?.phases?.[phase]?.complete) failures.push(`missing phase ${phase}`);
  if (
    !Number.isFinite(report?.phases?.nitro?.duration_ms) ||
    report.phases.nitro.duration_ms < 0 ||
    report.phases.nitro.duration_ms > budgets.nitro_ms
  )
    failures.push("nitro time");
  if (
    !Number.isFinite(report?.phases?.client?.entry_gzip_bytes) ||
    report.phases.client.entry_gzip_bytes < 0 ||
    report.phases.client.entry_gzip_bytes > budgets.entry_gzip_bytes
  )
    failures.push("client entry size");
  return failures;
}
