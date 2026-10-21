// Formato do jsonb devolvido pelas funções do painel por perfil (Ciclo 5).

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type DashCount = { n: number; secs?: number };
export type DashCountMap = Record<string, DashCount>;

export type DashScope = {
  workspace_id: string;
  user_id: string;
  read_only: boolean;
  views: Record<"me" | "team" | "commercial" | "finance" | "quality", boolean>;
  team_scope: "workspace" | "led" | "none";
  led_projects: number;
  can_cost: boolean;
  can_profitability: boolean;
  can_manage_alerts: boolean;
  can_view_all_alerts: boolean;
  can_manage_rules: boolean;
  can_export: boolean;
  can_received: boolean;
  can_open_center: boolean;
};

export type DashPeopleAgg = Record<
  string,
  {
    n: number;
    contracted: number | null;
    allocated_total: number | null;
    allocated_scope: number | null;
    registered: number | null;
    submitted: number | null;
    gap: number | null;
    known: number;
  }
>;

export type DashMoney = { currency: string; n: number; amount: number; received: number };

export type DashMyAllocation = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  role_title: string | null;
  allocation_pct: number | null;
  hours_per_week: number | null;
  starts_at: string | null;
  ends_at: string | null;
  can_track_time: boolean | null;
};

export type DashSummary = {
  view: string;
  generated_at: string;
  filters: {
    from: string;
    to: string;
    tz: string;
    today: string;
    compare: boolean;
    [k: string]: Json;
  };
  scope: DashScope;
  entries?: DashCountMap;
  entries_prev?: DashCountMap;
  projects?: DashCountMap;
  tasks?: DashCountMap;
  milestones?: DashCountMap;
  people?: DashPeopleAgg;
  my_allocations?: DashMyAllocation[];
  pending_approvals?: number;
  forecast?: DashCountMap;
  deals?: Record<string, { n: number; transition_median_s: number | null }>;
  policy?: { enabled: boolean; activated_at: string | null } | null;
  measurements?: Record<string, DashMoney[]>;
  cost?: DashCountMap;
  cost_currency?: string;
  quality?: {
    issues: Record<string, { alerts: number; entries: number }>;
    issues_total: { alerts: number; entries: number; without_entry: number };
    last_refresh: { finished_at: string; counts: Record<string, Json> } | null;
    links: {
      entries: number;
      with_person: number;
      with_allocation: number;
      without_people_record: number;
    };
  };
  alerts?: DashCountMap;
  alert_last_run: {
    finished_at: string;
    evaluated_on: string;
    counts: Record<string, Json>;
  } | null;
};

export type DashDrillPage = {
  total: number;
  seconds: number | null;
  limit: number;
  offset: number;
  rows: Array<Record<string, Json>>;
  generated_at: string;
};

export type DashFilterOption = { id: string; label: string; hint?: string | null };

export type DashRuleConfig = {
  enabled?: boolean;
  severity?: "low" | "medium" | "high";
  warn_pct?: number;
  critical_pct?: number;
  horizon_days?: number;
  days?: number;
  grace_days?: number;
  tz?: string;
};

export type DashRiskRules = {
  defaults: Record<string, DashRuleConfig>;
  effective: Record<string, DashRuleConfig>;
  workspace_version: {
    version: number;
    note: string;
    created_at: string;
    rules: Record<string, DashRuleConfig>;
  } | null;
  project_version: {
    version: number;
    note: string;
    created_at: string;
    rules: Record<string, DashRuleConfig>;
  } | null;
  can_manage: boolean;
};
