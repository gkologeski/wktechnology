/** Conservative pause policy; uncertain sends are never blindly retried. */
export function unipileProtection(status: number, retryAfter: string | null, now = Date.now()) {
  if (![401, 403, 422, 429, 500, 502, 503, 504].includes(status)) return null;
  const delay = protectionDelay(status, retryAfter, now);
  return {
    until: new Date(now + delay).toISOString(),
    disconnected: [401, 403, 422].includes(status),
    reason:
      status === 429
        ? "provider_limit"
        : status === 422 || status === 403
          ? "provider_restriction"
          : "provider_unavailable",
  };
}

function protectionDelay(status: number, retryAfter: string | null, now: number) {
  const seconds =
    retryAfter !== null && /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter || "") - now;
  const delay =
    Number.isFinite(seconds) && seconds > 0
      ? Math.min(seconds, 253402300799000 - now)
      : status === 429
        ? 3600000
        : 900000;
  return delay;
}
