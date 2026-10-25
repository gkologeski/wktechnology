import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "./work-core.server";
export type SalesWorkerSource =
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
  references: Array<{ table: string; id: string }> = [],
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
