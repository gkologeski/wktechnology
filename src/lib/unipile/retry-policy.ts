/** Backpressure never completes a sourcing step or silently skips a message. */
function isDeferredReason(code: string) {
  return ["rate_limited", "daily_budget_reached", "out_of_window"].includes(code);
}
export function linkedinRetryPolicy(error: { code?: string; retryAfterMs?: number }, now: number) {
  if (!isDeferredReason(error.code ?? "")) return { status: "paused" as const, nextRunAt: null };
  const wait =
    Number.isFinite(error.retryAfterMs) && (error.retryAfterMs ?? 0) > 0
      ? Math.max(1000, error.retryAfterMs!)
      : 3600000;
  return { status: "active" as const, nextRunAt: new Date(now + wait).toISOString() };
}
