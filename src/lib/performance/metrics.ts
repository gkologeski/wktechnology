// Somente nomes técnicos aprovados; nunca IDs, valores de filtros, URLs ou mensagens.
const families: Record<string, string> = {
  "sdr-overview": "agents",
  "sdr-agents": "agents",
  leads: "details",
  deals: "details",
  contacts: "details",
  companies: "details",
  "sdr-agent-versions": "agents",
  prospecting: "prospecting",
  sdr: "agents",
  ats: "hire",
  "projects-dashboard": "projects",
  "project-space-tree": "projects",
  "my-time-summary": "projects",
  "my-work": "projects",
  timesheet: "projects",
  project: "projects",
  "project-financials": "projects",
  "project-tasks": "projects",
  "project-delivery": "projects",
  projects: "projects",
  "project-list": "projects",
  "my-hours": "projects",
  "my-month-calendar": "projects",
  "project-dashboard": "projects",
  "ats-jobs": "hire",
  "ats-candidates": "hire",
  "techhire-dashboard": "hire",
  "prospecting-queues": "prospecting",
  "prospecting-base": "prospecting",
  "ai-agents": "agents",
  agents: "agents",
  deal: "details",
  lead: "details",
  contact: "details",
  company: "details",
};
export function metricFamily(key: unknown): string {
  const head = Array.isArray(key) ? key[0] : null;
  return typeof head === "string" ? (families[head] ?? "other") : "other";
}
export function routeFamily(path: string): string {
  if (/^\/projects(?:\/|$)/.test(path)) return "projects";
  if (/^\/(?:ats|techhire|jobs|candidates)(?:\/|$)/.test(path)) return "hire";
  if (/^\/prospecting(?:\/|$)/.test(path)) return "prospecting";
  if (/^\/agents(?:\/|$)/.test(path)) return "agents";
  if (/^\/(?:leads|deals|contacts|companies)\/[^/]+/.test(path)) return "details";
  return "other";
}
export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
};
