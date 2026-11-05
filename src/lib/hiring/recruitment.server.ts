import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { RecruitmentContext } from "./signature.types";
/** Recheck before external side effects; SQL triggers recheck at each write. */
export async function assertRecruitmentReady(
  client: SupabaseClient,
  workspaceId: string,
  jobId: string,
) {
  const result = await workRpc<RecruitmentContext>(client, "hiring_recruitment_preflight", {
    p_ws: workspaceId,
    p_job: jobId,
  });
  if (!result.ready) throw new Error(result.reason ?? "Recrutamento ainda não autorizado.");
  return result;
}
