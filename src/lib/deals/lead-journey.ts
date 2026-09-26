import type { PipelineStage } from "@/lib/pipelines";

export const LEAD_CHANNELS = [
  "prospecting",
  "website",
  "paid",
  "organic",
  "referral",
  "offline",
  "import",
  "other",
  "unknown",
] as const;

export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  prospecting: "Prospecção",
  website: "Site e formulários",
  paid: "Mídia paga",
  organic: "Orgânico",
  referral: "Indicação",
  offline: "Eventos e offline",
  import: "Importação",
  other: "Outros",
  unknown: "Sem origem",
};

const has = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

export function normalizeLeadChannel(source: string | null | undefined): LeadChannel {
  const value = (source ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!value) return "unknown";
  if (has(value, ["prospect", "apollo", "outbound", "cold_call", "cold_email", "linkedin"]))
    return "prospecting";
  if (has(value, ["paid", "cpc", "ppc", "google_ads", "facebook_ads", "meta_ads", "linkedin_ads"]))
    return "paid";
  if (has(value, ["organic", "seo", "busca_organica", "social_organic"])) return "organic";
  if (has(value, ["referr", "indic", "partner", "parceir"])) return "referral";
  if (has(value, ["form", "website", "site", "landing", "direct_traffic", "chat"]))
    return "website";
  if (has(value, ["offline", "event", "feira", "webinar", "conference"])) return "offline";
  if (has(value, ["import", "migration", "hubspot", "csv", "planilha"])) return "import";
  return "other";
}

export interface LeadJourneyRow {
  id: string;
  source: string | null;
  status: string | null;
  stage_id: string | null;
  converted_at: string | null;
  converted_deal_id: string | null;
}

export function resolveJourneyStage(
  lead: Pick<LeadJourneyRow, "stage_id" | "status">,
  stages: PipelineStage[],
): PipelineStage | undefined {
  const direct = lead.stage_id
    ? stages.find((stage) => stage.value === lead.stage_id)
    : stages.find((stage) => stage.value === lead.status);
  if (direct) return direct;
  if (lead.status === "qualified")
    return (
      stages.find((stage) => stage.type === "won") ??
      stages.filter((stage) => stage.type !== "lost").at(-1)
    );
  if (lead.status === "disqualified") return stages.find((stage) => stage.type === "lost");
  if (lead.status === "contacted" || lead.status === "nurturing")
    return stages.filter((stage) => (stage.type ?? "open") === "open")[1] ?? stages[0];
  return stages[0];
}
