import type { QueryClient } from "@tanstack/react-query";
import { budgets } from "./budgets";
import { metricFamily } from "./metrics";
const samples: Array<{ name: string; duration_ms: number }> = [];
let pending: ReturnType<typeof setTimeout> | null = null;
function record(entry: PerformanceMeasure) {
  samples.push({ name: entry.name, duration_ms: entry.duration });
  if (samples.length > 200) samples.shift();
  // Local developer diagnostics only; hidden DOM output allows test tools to read safe metrics.
  if (!import.meta.env.DEV || typeof document === "undefined" || pending) return;
  pending = setTimeout(() => {
    pending = null;
    let output = document.getElementById("techerp-performance");
    if (!output) {
      output = document.createElement("output");
      output.id = "techerp-performance";
      output.hidden = true;
      document.body.appendChild(output);
    }
    output.textContent = JSON.stringify(samples);
  }, 50);
}
// Performance entries can be inspected by browser tooling. No remote transmission.
export function observeQueries(client: QueryClient) {
  const starts = new Map<string, number>();
  return client.getQueryCache().subscribe((event) => {
    const query = event.query;
    if (!query || typeof performance === "undefined") return;
    if (event.type === "removed") {
      starts.delete(query.queryHash);
      return;
    }
    if (query.state.fetchStatus === "fetching") {
      if (!starts.has(query.queryHash)) starts.set(query.queryHash, performance.now());
      return;
    }
    const start = starts.get(query.queryHash);
    if (start === undefined) return;
    starts.delete(query.queryHash);
    const name = `techerp:query:${metricFamily(query.queryKey)}:${query.state.status}`;
    record(performance.measure(name, { start, end: performance.now() }));
    const entries = performance.getEntriesByName(name);
    if (entries.length > 200) performance.clearMeasures(name);
  });
}
export function measureNavigation(family: string, start: number) {
  const name = `techerp:route:${family}`;
  const entry = performance.measure(name, { start, end: performance.now() });
  record(entry);
  if (import.meta.env.DEV && entry.duration > budgets.warm_route_p95_ms)
    console.warn("[performance] route budget exceeded", {
      family,
      duration_ms: Math.round(entry.duration),
      limit_ms: budgets.warm_route_p95_ms,
    });
  if (performance.getEntriesByName(name).length > 200) performance.clearMeasures(name);
}

export async function measureRequest<T>(key: unknown, request: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let status = "error";
  try {
    const result = await request();
    status = "success";
    return result;
  } finally {
    const name = `techerp:query:${metricFamily(key)}:${status}`;
    record(performance.measure(name, { start, end: performance.now() }));
    if (performance.getEntriesByName(name).length > 200) performance.clearMeasures(name);
  }
}
