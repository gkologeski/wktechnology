// Tipos compartilhados dos passos de importação do HubSpot.
// Extraído de hubspot-steps.server.ts para reduzir o tamanho do módulo.
import type { SupabaseClient } from "@supabase/supabase-js";

export type HsTable = "companies" | "contacts" | "deals" | "leads" | "tickets";
export type HsUpsertTable = HsTable | "activities";

export type StepName =
  | "compare"
  | "companies"
  | "contacts"
  | "deals"
  | "leads"
  | "tickets"
  | "activities-notes"
  | "activities-calls"
  | "activities-meetings"
  | "activities-tasks"
  | "activities-emails";

export type Scope = {
  companies: boolean;
  contacts: boolean;
  deals: boolean;
  leads: boolean;
  tickets: boolean;
  activities: boolean;
  maxCompanies: number;
};

export type StepCtx = {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  jobId: string;
  step: StepName;
  itemId: string;
  scope: Scope;
  /** Absolute epoch ms after which the step must checkpoint and return partial=true */
  deadlineAt?: number;
};

export type StepResult = {
  succeeded: number;
  failed: number;
  importedHsIds: string[];
  /** true means the step persisted a cursor and is waiting to be re-queued */
  partial?: boolean;
};

export type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  step: string;
  message: string;
  count?: number;
};

type ItemRow = {
  id: string;
  status: string;
  before: { step?: string; order?: number; depends_on?: string[]; [k: string]: unknown } | null;
  after: {
    succeeded?: number;
    failed?: number;
    imported_hs_ids?: string[];
    [k: string]: unknown;
  } | null;
};

export type UpsertResult = {
  status: "inserted" | "updated" | "unchanged" | "failed";
  localId?: string;
  error?: string;
};
type UpsertTask = { hsId: string; payload: Record<string, unknown> };

export type ResumeState = {
  started_at?: string;
  cursor?: string;
  read_index?: number;
  assoc_index?: number;
  deal_contacts_index?: number;
  discovery_entity_index?: number;
  discovery_id_index?: number;
  discovery_complete?: boolean;
  running_succeeded?: number;
  running_failed?: number;
  discovered?: number;
  imported_hs_ids?: string[];
  target_ids?: string[];
  parent_map?: Record<string, string>;
  deal_contacts_map?: Record<string, string[]>;
  parents_map?: Record<string, { contactId?: string; companyId?: string; dealId?: string }>;
  step?: string;
  order?: number;
  depends_on?: string[];
  [k: string]: unknown;
};
