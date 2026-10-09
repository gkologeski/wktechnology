// Parser puro da RPC `get_sales_dashboard_secondary` (listas, contatos e jornada sem tetos).
import type { PipelineStage } from "@/lib/pipelines";
import type { LeadStageRow } from "@/lib/deals/sales-dashboard.types";
import {
  LEAD_CHANNEL_LABELS,
  LEAD_CHANNELS,
  normalizeLeadChannel,
  resolveJourneyStage,
  type LeadChannel,
} from "@/lib/deals/lead-journey";

export type SecondaryDealRow = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  stage_id: string | null;
  pipeline_id: string | null;
  owner_id: string | null;
  assigned_to: string | null;
  company_id: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  updated_at: string | null;
  has_recent_activity: boolean;
};

export type ContactGroup = { day: string; type: string; n: number };

export type JourneyGroup = {
  source: string | null;
  status: string | null;
  stage_id: string | null;
  converted: boolean;
  has_deal_ref: boolean;
  linked: boolean;
  deal_stage: string | null;
  deal_stage_id: string | null;
  n: number;
  deal_value: number;
};

export type DashboardSecondary = {
  advanced: SecondaryDealRow[];
  overdue: SecondaryDealRow[];
  stale: SecondaryDealRow[];
  contacts: ContactGroup[];
  journey: JourneyGroup[];
};

const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function deal(r: Record<string, unknown>): SecondaryDealRow {
  return {
    id: String(r.id),
    name: str(r.name) ?? "",
    value: r.value == null ? null : num(r.value),
    stage: str(r.stage) ?? "",
    stage_id: str(r.stage_id),
    pipeline_id: str(r.pipeline_id),
    owner_id: str(r.owner_id),
    assigned_to: str(r.assigned_to),
    company_id: str(r.company_id),
    expected_close_date: str(r.expected_close_date),
    closed_at: str(r.closed_at),
    updated_at: str(r.updated_at),
    has_recent_activity: r.has_recent_activity === true,
  };
}

export function parseDashboardSecondary(value: unknown): DashboardSecondary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    advanced: arr(raw.advanced).map(deal),
    overdue: arr(raw.overdue).map(deal),
    stale: arr(raw.stale).map(deal),
    contacts: arr(raw.contacts).map((c) => ({
      day: str(c.day) ?? "",
      type: str(c.type) ?? "",
      n: num(c.n),
    })),
    journey: arr(raw.journey).map((j) => ({
      source: str(j.source),
      status: str(j.status),
      stage_id: str(j.stage_id),
      converted: j.converted === true,
      has_deal_ref: j.has_deal_ref === true,
      linked: j.linked === true,
      deal_stage: str(j.deal_stage),
      deal_stage_id: str(j.deal_stage_id),
      n: num(j.n),
      deal_value: num(j.deal_value),
    })),
  };
}

/** Etapas abertas com probabilidade >= 60% (critério de "fase avançada"). */
export function advancedStageIds(stages: PipelineStage[]): string[] {
  return stages
    .filter((s) => s.type === "open" && (s.probability ?? 0) >= 60)
    .map((s) => s.value);
}

function dealStageOf(
  g: Pick<JourneyGroup, "deal_stage" | "deal_stage_id">,
  stages: PipelineStage[],
): PipelineStage | null {
  const key = g.deal_stage_id || g.deal_stage;
  return (
    stages.find((s) => s.value === key) ?? stages.find((s) => s.value === g.deal_stage) ?? null
  );
}

function groupIsWon(g: JourneyGroup, stages: PipelineStage[]): boolean {
  const st = dealStageOf(g, stages);
  if (st) return st.type === "won";
  return g.deal_stage === "won";
}

export type LeadJourneySummary = {
  totalLeads: number;
  qualified: number;
  opportunities: number;
  sales: number;
  revenue: number;
  leadToQualifiedRate: number;
  qualifiedToOpportunityRate: number;
  opportunityToSaleRate: number;
  attributionCoverage: number;
  linkedOpportunities: number;
  channels: Array<{
    key: LeadChannel;
    label: string;
    leads: number;
    share: number;
    qualified: number;
    opportunities: number;
    sales: number;
    revenue: number;
    sources: string[];
  }>;
  stages: LeadStageRow[];
};

/**
 * Jornada de leads calculada sobre grupos já agregados no banco (sem teto de linhas).
 * Mantém as mesmas regras do cálculo anterior por lead.
 */
export function summarizeLeadJourney(
  groups: JourneyGroup[],
  leadStages: PipelineStage[],
  dealStages: PipelineStage[],
  channel: LeadChannel | null | undefined,
): LeadJourneySummary {
  const rate = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
  const sumN = (rows: JourneyGroup[]) => rows.reduce((t, g) => t + g.n, 0);
  const asLead = (g: JourneyGroup) => ({ stage_id: g.stage_id, status: g.status });
  const all = groups.filter((g) => g.n > 0);
  const scoped = channel ? all.filter((g) => normalizeLeadChannel(g.source) === channel) : all;

  const qualifiedRows = scoped.filter(
    (g) =>
      g.converted ||
      resolveJourneyStage(asLead(g), leadStages)?.type === "won" ||
      g.status === "qualified",
  );
  const opportunityRows = scoped.filter((g) => g.has_deal_ref && g.linked);
  const salesRows = opportunityRows.filter((g) => groupIsWon(g, dealStages));
  const convertedRows = scoped.filter((g) => g.converted || g.has_deal_ref);
  const total = sumN(scoped);
  const qualified = sumN(qualifiedRows);
  const opportunities = sumN(opportunityRows);
  const sales = sumN(salesRows);
  const allTotal = sumN(all);

  const channels = LEAD_CHANNELS.map((key) => {
    const rows = all.filter((g) => normalizeLeadChannel(g.source) === key);
    const opp = rows.filter((g) => g.has_deal_ref && g.linked);
    const won = opp.filter((g) => groupIsWon(g, dealStages));
    const leads = sumN(rows);
    return {
      key,
      label: LEAD_CHANNEL_LABELS[key],
      leads,
      share: rate(leads, allTotal),
      qualified: sumN(rows.filter((g) => g.converted || g.status === "qualified")),
      opportunities: sumN(opp),
      sales: sumN(won),
      revenue: won.reduce((t, g) => t + g.deal_value, 0),
      sources: Array.from(new Set(rows.map((g) => g.source).filter(Boolean) as string[])).sort(),
    };
  })
    .filter((row) => row.leads > 0)
    .sort((a, b) => b.leads - a.leads);

  const stages = leadStages.map((stage) => {
    const count = sumN(
      scoped.filter((g) => resolveJourneyStage(asLead(g), leadStages)?.value === stage.value),
    );
    return {
      value: stage.value,
      label: stage.label,
      color: stage.color ?? null,
      type: (stage.type ?? "open") as LeadStageRow["type"],
      count,
      share: rate(count, total),
    };
  });

  return {
    totalLeads: total,
    qualified,
    opportunities,
    sales,
    revenue: salesRows.reduce((t, g) => t + g.deal_value, 0),
    leadToQualifiedRate: rate(qualified, total),
    qualifiedToOpportunityRate: rate(opportunities, qualified),
    opportunityToSaleRate: rate(sales, opportunities),
    attributionCoverage: rate(opportunities, sumN(convertedRows)),
    linkedOpportunities: opportunities,
    channels,
    stages,
  };
}
