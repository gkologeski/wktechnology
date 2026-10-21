// Tipos serializáveis devolvidos pelas funções de tarifas, medições e rentabilidade (Ciclo 4).
import type { Json } from "@/integrations/supabase/types";
import type { BillingModel, MeasurementStatus } from "@/lib/projects/billing.shared";

export type IssueItem = { code: string; count: number; seconds?: number; entries?: string[] };

export type RateRow = {
  id: string;
  kind: "cost" | "price";
  scope: string;
  project_id: string | null;
  user_id: string | null;
  allocation_id: string | null;
  service_id: string | null;
  person_id: string | null;
  service_catalog_id: string | null;
  unit: "hour" | "month";
  proration: string | null;
  currency: string;
  amount: number;
  valid_from: string;
  valid_to: string | null;
  version: number;
  supersedes_id: string | null;
  status: string;
  reason: string;
  created_at: string;
  target_label: string;
};

export type RateImpact = {
  entries: number;
  seconds: number;
  measured_non_draft: number;
  measured_draft: number;
  retroactive: boolean;
};

export type LegacyRateCandidates = {
  project_members: Array<{
    project_id: string;
    project_name: string;
    user_id: string;
    user_name: string | null;
    cost_rate_hour: number | null;
    bill_rate_hour: number | null;
  }>;
  allocations: Array<{
    allocation_id: string;
    person_name: string;
    project_id: string | null;
    service_id: string | null;
    cost_rate: number | null;
    billable_rate: number | null;
    currency: string;
    starts_at: string;
    ends_at: string | null;
  }>;
  services: Array<{
    service_id: string;
    name: string;
    unit: string | null;
    billing_model: string | null;
    unit_price: number;
    quantity: number;
    currency: string;
    type: string;
    status: string;
  }>;
};

export type BillingConfigRow = {
  id: string;
  contract_id: string;
  service_id: string | null;
  service_name: string | null;
  model: BillingModel;
  currency: string;
  params: Record<string, string | number | boolean>;
  valid_from: string;
  valid_to: string | null;
  version: number;
  status: string;
  reason: string;
  created_at: string;
};

export type MeasurementRow = {
  id: string;
  config_id: string;
  contract_id: string;
  service_id: string | null;
  model: BillingModel;
  currency: string;
  period_from: string;
  period_to: string;
  kind: "regular" | "complement";
  status: MeasurementStatus;
  revision: number;
  lines_hash: string;
  total_amount: number | null;
  total_seconds: number;
  blockers: IssueItem[];
  gates: IssueItem[];
  warnings: IssueItem[];
  financial_entry_id: string | null;
  failure_reason: string | null;
  created_at: string;
  created_by: string;
  submitted_by: string | null;
  approved_by: string | null;
  closed_reason: string | null;
};

export type MeasurementLine = {
  id: string;
  line_no: number;
  source_type: string;
  source_id: string | null;
  project_id: string | null;
  user_id: string | null;
  work_date: string | null;
  seconds: number | null;
  billed_seconds: number | null;
  quantity: number | null;
  unit: string | null;
  rate_amount: number | null;
  amount: number | null;
  included: boolean;
  active: boolean;
  issue: string | null;
  description: string | null;
  package_seconds: number | null;
  reason: string | null;
};

export type MeasurementEvent = {
  id: string;
  action: string;
  actor: string | null;
  actor_name: string | null;
  reason: string | null;
  created_at: string;
};

export type MeasurementDetail = {
  measurement: MeasurementRow & { timezone: string; rules_snapshot: Json };
  lines: MeasurementLine[];
  events: MeasurementEvent[];
  names: Record<string, string>;
  financial: Array<{
    id: string;
    kind: string;
    active: boolean;
    amount: number | null;
    paid_amount: number | null;
    status: string | null;
    due_date: string | null;
  }>;
};

export type Profitability = {
  currency: string;
  period_from: string;
  period_to: string;
  scope: "project" | "contract";
  can_view_rates: boolean;
  effort: {
    total_seconds: number;
    approved_seconds: number;
    pending_seconds: number;
    imported_seconds: number;
    billable_seconds: number;
    cost_covered_seconds: number;
    cost_ambiguous_seconds: number;
    price_covered_seconds: number;
    person_linked_seconds: number;
    partial_seconds: number;
  };
  revenue: {
    forecast: number;
    approved: number;
    reversed: number;
    unknown_amount: number;
    unattributed_approved: number;
    count: number;
  };
  finance: { launched: number; received: number; shared_measurements: number };
  cost: {
    estimated: number;
    hourly: number;
    monthly_allocated: number;
    monthly_rates: number;
    actual_payables: number;
  };
  coverage: { cost_pct: number | null; price_pct: number | null; person_link_pct: number | null };
  margin: {
    estimated: number | null;
    estimated_pct: number | null;
    status: "complete" | "unknown";
    partial_hours: {
      seconds: number;
      price_value: number;
      cost: number;
      margin: number;
      margin_pct: number | null;
    };
    actual: number;
    actual_pct: number | null;
  };
  months: Array<{ month: string; seconds: number; cost_hourly: number }>;
  people: Array<{
    user_id: string;
    name: string | null;
    seconds: number;
    covered_seconds: number | null;
    cost_hourly: number;
  }> | null;
  projects: Array<{
    project_id: string;
    name: string;
    seconds: number;
    covered_seconds: number | null;
  }> | null;
  other_currencies: string[];
  reconciliation_open: number;
};
