// Tipos do painel de campanhas (WhatsApp + e-mail) do TechSales.
export type CampaignChannel = "whatsapp" | "email";
export type Coverage = "ok" | "partial" | "none";

export interface FunnelStep {
  key: string;
  label: string;
  /** `null` = etapa não rastreada para o canal (nunca vira zero). */
  value: number | null;
  coverage: Coverage;
}

export interface CampaignRank {
  id: string;
  name: string;
  channel: CampaignChannel;
  sent: number;
  replied: number | null;
  meetings: number | null;
  failed: number;
}

export interface CampaignDay {
  day: string;
  label: string;
  whatsapp: number;
  email: number;
  replies: number;
}

export interface BlockReason {
  key: string;
  label: string;
  value: number;
}

export interface CampaignFunnelData {
  funnel: Record<"all" | CampaignChannel, FunnelStep[]>;
  daily: CampaignDay[];
  ranking: CampaignRank[];
  blocks: BlockReason[];
  aiVsHuman: { ai: number; human: number };
  previousSent: number;
}
