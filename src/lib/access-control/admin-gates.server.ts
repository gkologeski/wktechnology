// Gates granulares (server-only) que substituem o modelo legado de "tool matrix"
// (`requireTool` de src/lib/permissions.server.ts).
// Resolve o workspace ativo do usuário e valida as chaves do catálogo
// `permissions` via `user_has_permission` (RBAC granular).
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

/** Valida que o usuário tem pelo menos uma das chaves no workspace ativo. */
export async function assertAnyPermissionInActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
  permissionKeys: string[],
): Promise<void> {
  const workspaceId = await getActiveWorkspaceId(supabase, userId);
  await assertAnyPermission(supabase, userId, workspaceId, permissionKeys);
}

/** Chaves que autorizam gerenciar (criar/editar/publicar/excluir) workflows. */
export const WORKFLOWS_MANAGE_KEYS = [
  "system.workflows.manage.workspace",
  "system.workflows.update.workspace",
  "system.workflows.create.workspace",
] as const;

export const WORKFLOWS_DELETE_KEYS = [
  "system.workflows.manage.workspace",
  "system.workflows.delete.workspace",
  "system.workflows.delete.own",
] as const;

/** Exportações agendadas de relatórios. */
export const REPORTS_EXPORT_KEYS = [
  "system.analytics.reports.export.workspace",
  "system.analytics.reports.manage.workspace",
] as const;

/** Importação em massa = criar registros da entidade alvo. */
export function importKeysFor(entity: "leads" | "contacts" | "companies"): string[] {
  return [`techsales.${entity}.create.workspace`, `techsales.${entity}.create.own`];
}

export async function assertWorkflowsManage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await assertAnyPermissionInActiveWorkspace(supabase, userId, [...WORKFLOWS_MANAGE_KEYS]);
}

export async function assertWorkflowsDelete(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await assertAnyPermissionInActiveWorkspace(supabase, userId, [...WORKFLOWS_DELETE_KEYS]);
}

export async function assertReportsExport(supabase: SupabaseClient, userId: string): Promise<void> {
  await assertAnyPermissionInActiveWorkspace(supabase, userId, [...REPORTS_EXPORT_KEYS]);
}

export async function assertImportEntity(
  supabase: SupabaseClient,
  userId: string,
  entity: "leads" | "contacts" | "companies",
): Promise<void> {
  await assertAnyPermissionInActiveWorkspace(supabase, userId, importKeysFor(entity));
}
