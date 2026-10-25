// Autorização server-side do Agente SDR: resolve o workspace do usuário e
// exige a permissão RBAC da ação. A UI apenas espelha estas regras.
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";

const P = "techsales.marketing.sdr_agent";

export const SDR_PERMISSIONS = {
  view: [`${P}.view.workspace`, `${P}.view.team`, `${P}.view.own`],
  create: [`${P}.create.workspace`, `${P}.create.own`],
  update: [`${P}.update.workspace`, `${P}.update.team`, `${P}.update.own`],
  delete: [`${P}.delete.workspace`, `${P}.delete.own`],
  /** Aprovar rascunho, assumir conversa, reenviar agenda: ação de supervisão. */
  supervise: [`${P}.update.workspace`, `${P}.update.team`],
  manage: [`${P}.manage.workspace`],
} as const;

export type SdrAction = keyof typeof SDR_PERMISSIONS;

export async function resolveSdrWorkspace(supabase: SupabaseClient, userId: string) {
  const scope = await workRpc<{ workspace?: string; actor?: string }>(
    supabase,
    "sales_access_context",
    {},
  );
  if (!scope.workspace || scope.actor !== userId) throw new Error("Workspace ativo indisponível.");
  return scope.workspace;
}

export async function assertSdr(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  action: SdrAction,
): Promise<void> {
  if (workspaceId !== (await resolveSdrWorkspace(supabase, userId)))
    throw new Error("Workspace inválido.");
  await assertSalesArea(supabase, P, action === "supervise" ? "update" : action);
  if (action === "supervise") {
    const context = await workRpc<{ keys?: Record<string, boolean> }>(
      supabase,
      "sales_access_context",
      {},
    );
    if (!SDR_PERMISSIONS.supervise.some((key) => context.keys?.[key]))
      throw new Error("Sem permissão de supervisão.");
  }
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
