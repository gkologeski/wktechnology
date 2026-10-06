// Autorização server-side do Agente SDR: resolve o workspace do usuário e
// exige a permissão RBAC da ação. A UI apenas espelha estas regras.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

const P = "techsales.marketing.sdr_agent";

export const SDR_PERMISSIONS = {
  view: [`${P}.view.workspace`, `${P}.view.team`, `${P}.view.own`, `${P}.manage.workspace`],
  create: [`${P}.create.workspace`, `${P}.create.own`, `${P}.manage.workspace`],
  update: [`${P}.update.workspace`, `${P}.update.team`, `${P}.update.own`, `${P}.manage.workspace`],
  delete: [`${P}.delete.workspace`, `${P}.delete.own`, `${P}.manage.workspace`],
  /** Aprovar rascunho, assumir conversa, reenviar agenda: ação de supervisão. */
  supervise: [`${P}.update.workspace`, `${P}.update.team`, `${P}.manage.workspace`],
  manage: [`${P}.manage.workspace`],
} as const;

export type SdrAction = keyof typeof SDR_PERMISSIONS;

export async function resolveSdrWorkspace(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("default_workspace_for_user", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workspace não identificado.");
  return data as string;
}

export async function assertSdr(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  action: SdrAction,
): Promise<void> {
  await assertAnyPermission(supabase, userId, workspaceId, [...SDR_PERMISSIONS[action]]);
}

/** Atalho: resolve o workspace e verifica a ação; devolve o workspace. */
export async function requireSdr(
  supabase: SupabaseClient,
  userId: string,
  action: SdrAction,
): Promise<string> {
  const ws = await resolveSdrWorkspace(supabase, userId);
  await assertSdr(supabase, userId, ws, action);
  return ws;
}
