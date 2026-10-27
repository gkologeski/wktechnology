import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";

export async function requireChannelAccess(
  client: SupabaseClient,
  userId: string,
  action: "view" | "manage",
) {
  const access = await workRpc<{ workspace: string; actor: string; keys: Record<string, boolean> }>(
    client,
    "service_channel_authorize",
    { p_action: action },
  );
  if (!access.workspace || access.actor !== userId) throw new Error("Sessão de canais inválida.");
  return access;
}
