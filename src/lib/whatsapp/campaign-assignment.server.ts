import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAssignment, type AssignmentConfig } from "./campaign-assignment";

/** Valida a regra e garante que todos os membros são ativos no workspace. */
export async function resolveAssignment(
  supabase: SupabaseClient,
  workspaceId: string,
  cfg: AssignmentConfig,
): Promise<AssignmentConfig> {
  const norm = normalizeAssignment(cfg);
  if (norm.assignment_member_ids.length === 0) return norm;
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .in("user_id", norm.assignment_member_ids);
  if (error) throw error;
  const ok = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
  if (norm.assignment_member_ids.some((id) => !ok.has(id)))
    throw new Error("Só membros ativos deste workspace podem receber conversas.");
  return norm;
}
