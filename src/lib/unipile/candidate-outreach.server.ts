import type { SupabaseClient } from "@supabase/supabase-js";
import { assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
/** Candidate tokens are read through the caller's RLS, never the service role. */
export async function loadOutreachCandidate(
  client: SupabaseClient,
  workspace: string,
  id?: string,
) {
  if (!id) return null;
  await assertHrRecordAccess(client, "candidates", "view", id);
  const result = await client
    .from("ats_candidates")
    .select("full_name,current_company,headline,email")
    .eq("id", id)
    .eq("workspace_id", workspace)
    .maybeSingle();
  if (result.error || !result.data) throw new Error("Candidato indisponível no workspace ativo.");
  return result.data as {
    full_name: string | null;
    current_company: string | null;
    headline: string | null;
    email: string | null;
  };
}
