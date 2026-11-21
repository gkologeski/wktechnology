import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";

/**
 * Recursos pagos são conferidos no servidor pelo plano do workspace
 * (`has_entitlement`, mesma fonte da tela de planos). Falha fecha.
 */
export async function assertWorkspaceEntitlement(
  supabase: SupabaseClient,
  workspaceId: string,
  key: string,
): Promise<void> {
  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .maybeSingle();
  const owner = (ws as { created_by?: string | null } | null)?.created_by;
  if (wsError || !owner) throw new Error("Não foi possível confirmar o plano do workspace.");
  let enabled: boolean;
  try {
    enabled = await workRpc<boolean>(supabase, "has_entitlement", { _workspace: owner, _key: key });
  } catch {
    throw new Error("Não foi possível confirmar o plano do workspace.");
  }
  if (enabled !== true)
    throw new Error("Seu plano não inclui este recurso. Faça upgrade para usá-lo.");
}
