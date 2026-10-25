import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "./work-core.server";
export type SalesWorkerSource =
  | "scoring_rules"
  | "report_schedules"
  | "workflow_subscriptions"
  | "prospecting_campaigns"
  | "whatsapp_campaigns"
  | "email_broadcasts"
  | "sequence_enrollments"
  | "prospecting_enrollments"
  | "sdr_enrollments"
  | "enrichment_jobs"
  | "workflows";
/** Recheck current permissions immediately before every background effect. */
export async function assertSalesWorker(
  client: SupabaseClient,
  source: SalesWorkerSource,
  id: string,
  references: Array<
    | { workflow_version: number }
    | { agent_version_id: string }
    | { member_id: string }
    | { record_table: string; id: string }
    | {
        table: string;
        id: string;
        action?: "view" | "update" | "delete" | "assign" | "manage" | "export";
      }
    | {
        resource: string;
        action: "view" | "create" | "update" | "delete" | "assign" | "manage";
        subject_id?: string;
      }
  > = [],
) {
  if (
    !(await workRpc<boolean>(client, "sales_worker_authorize", {
      p_source: source,
      p_id: id,
      p_refs: references,
    }))
  )
    throw new Error(
      "Execução suspensa: responsável inativo ou sem permissão atual para a origem/destinatário.",
    );
}
