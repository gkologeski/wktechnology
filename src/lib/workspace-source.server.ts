import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve only the source record through the caller's RLS/service context. No owner fallback. */
export async function workspaceOfSource(
  client: SupabaseClient,
  table: string,
  id: string,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const workspace = (data as { workspace_id?: string | null } | null)?.workspace_id;
  if (!workspace) throw new Error("Registro de origem indisponível ou sem workspace.");
  return workspace;
}

/** Revalidate a workspace captured by a signed flow, even if the active workspace changed. */
export async function requireSourceWorkspaceAccess(
  client: SupabaseClient,
  userId: string,
  workspaceId: string | undefined,
): Promise<string> {
  if (!userId || !workspaceId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(workspaceId))
    throw new Error("Reconecte a integração para identificar o workspace de origem.");
  const { data: admin, error: adminError } = await client
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminError) throw new Error(adminError.message);
  if (admin) return workspaceId;
  const { data: member, error } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Acesso ao workspace de origem indisponível.");
  return workspaceId;
}
