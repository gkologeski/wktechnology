// Tipos do painel inicial do TechSales (client-safe: sem imports de servidor).

export type LeadChannel =
  | "prospecting"
  | "website"
  | "paid"
  | "organic"
  | "referral"
  | "offline"
  | "import"
  | "other"
  | "unknown";

export interface SalesDashboardInput {
  /** Início do período (ISO) */
  from: string;
  /** Fim do período (ISO) */
  to: string;
  /** null = pipeline padrão do workspace */
  pipelineId: string | null;
  /** null = funil de Leads padrão do workspace */
  leadPipelineId: string | null;
  /** null = todos os canais agrupados */
  channel: LeadChannel | null;
  /** "__all__" | "__me__" | "__none__" | uuid do responsável */
  assignee: string;
}

export interface PipelineOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface DealListItem {
  id: string;
  name: string;
  value: number;
  stageLabel: string;
  stageColor: string | null;
  probability: number;
  ownerName: string | null;
  companyName: string | null;
  expectedCloseDate: string | null;
  hotScore: number;
  risk: "overdue_close" | "no_recent_activity" | null;
}

export interface MeetingItem {
  id: string;
  kind: "meeting" | "booking";
  title: string;
  startAt: string;
  /** URL da videoconferência (Google Meet ou sala interna), quando existir */
  link: string | null;
  subtitle: string | null;
}

export interface TaskItem {
  id: string;
  subject: string;
  dueDate: string;
  overdue: boolean;
  type: string;
}

export interface ContactsByDay {
  /** ISO date (yyyy-mm-dd) */
  day: string;
  label: string;
  calls: number;
  emails: number;
  whatsapp: number;
  meetings: number;
  other: number;
  total: number;
}

export interface FunnelStageRow {
  value: string;
  label: string;
  color: string | null;
  probability: number;
  count: number;
  valueSum: number;
}

export interface SalesDashboardKpis {
  pipelineValue: number;
  openDeals: number;
  forecastValue: number;
  forecastDeals: number;
  wonValue: number;
  wonCount: number;
  goalValue: number | null;
  conversionRate: number;
  /** variação em pontos percentuais vs. período anterior (null = sem base) */
  conversionDelta: number | null;
  wonDeltaPct: number | null;
  avgTicket: number | null;
}

export interface LeadChannelRow {
  key: LeadChannel;
  label: string;
  leads: number;
  share: number;
  qualified: number;
  opportunities: number;
  sales: number;
  revenue: number;
  sources: string[];
}

export interface LeadStageRow {
  value: string;
  label: string;
  color: string | null;
  type: "open" | "won" | "lost";
  count: number;
  share: number;
}

export interface LeadJourneyData {
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
  selectedChannel: LeadChannel | null;
  leadPipelineName: string | null;
  channels: LeadChannelRow[];
  stages: LeadStageRow[];
}

export interface SalesDashboardData {
  pipelines: PipelineOption[];
  leadPipelines: PipelineOption[];
  selectedPipelineId: string | null;
  selectedPipelineName: string | null;
  canViewTeam: boolean;
  /** Responsável efetivamente aplicado (forçado ao próprio usuário sem permissão de equipe). */
  effectiveAssignee: string;
  kpis: SalesDashboardKpis;
  leadJourney: LeadJourneyData;
  advancedDeals: DealListItem[];
  attentionDeals: DealListItem[];
  meetings: MeetingItem[];
  tasks: TaskItem[];
  contactsByDay: ContactsByDay[];
  funnel: FunnelStageRow[];
  leadsToWork: {
    count: number;
    sample: { id: string; name: string; status: string }[];
  };
}
