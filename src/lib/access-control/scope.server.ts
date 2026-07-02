// TechERP Access Control — Fase 5: helpers de escopo para uso interno em server functions.
// Aplica filtros de escopo (own/team/workspace) sobre queries do Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DataScope = "own" | "team" | "workspace" | "custom";

export async function getEffectiveScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  workspaceId: string,
): Promise<DataScope> {
  const { data, error } = await supabase.rpc("user_data_scope", {
    _user_id: userId,
    _workspace_id: workspaceId,
  });
  if (error) return "own";
  return (data as DataScope) ?? "own";
}

export async function assertCanViewOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  workspaceId: string,
  ownerId: string,
): Promise<void> {
  if (userId === ownerId) return;
  const { data, error } = await supabase.rpc("user_can_view_owner", {
    _user_id: userId,
    _workspace_id: workspaceId,
    _owner_id: ownerId,
  });
  if (error || !data) {
    throw new Error("Acesso negado pelo escopo de dados.");
  }
}

// Returns the list of user_ids that the current user is allowed to see
// (used to constrain queries with .in("owner_id", allowedIds)).
// Returns null when scope is 'workspace' or 'custom' (no filter needed).
export async function getAllowedOwnerIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  workspaceId: string,
): Promise<string[] | null> {
  const scope = await getEffectiveScope(supabase, userId, workspaceId);
  if (scope === "workspace" || scope === "custom") return null;
  if (scope === "own") return [userId];
  // team: union of members from user's groups
  const { data: myGroups } = await supabase
    .from("user_group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = ((myGroups ?? []) as Array<{ group_id: string }>).map((g) => g.group_id);
  if (groupIds.length === 0) return [userId];
  const { data: peers } = await supabase
    .from("user_group_members")
    .select("user_id")
    .in("group_id", groupIds);
  const ids = new Set<string>([userId]);
  for (const p of (peers ?? []) as Array<{ user_id: string }>) ids.add(p.user_id);
  return Array.from(ids);
}
