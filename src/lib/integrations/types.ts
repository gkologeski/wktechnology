import type { Database } from "@/integrations/supabase/types";

export type Integration = Database["public"]["Tables"]["integrations"]["Row"];
export type EnrichmentJob = Database["public"]["Tables"]["enrichment_jobs"]["Row"];
export type CreditLedger = Database["public"]["Tables"]["credit_ledger"]["Row"];
export type CreditLimit = Database["public"]["Tables"]["credit_limits"]["Row"];

export type EnrichResultDelta = Record<string, { before: unknown; after: unknown }>;
