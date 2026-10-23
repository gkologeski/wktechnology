import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

export type WorkspaceSettingsSection = "payments" | "nfse" | "meeting";
type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
type SettingsRpc = (
  name: "get_workspace_sensitive_settings" | "save_workspace_sensitive_settings",
  args: Record<string, unknown>,
) => Promise<RpcResult>;

async function callSettingsRpc(
  supabase: SupabaseClient,
  userId: string,
  section: WorkspaceSettingsSection,
  value?: Record<string, unknown>,
): Promise<unknown> {
  // Workspace comes from the authenticated profile, never the form payload.
  const workspaceId = await getActiveWorkspaceId(supabase, userId);
  const rpc = supabase.rpc as unknown as SettingsRpc;
  const { data, error } = await rpc.call(
    supabase,
    value === undefined ? "get_workspace_sensitive_settings" : "save_workspace_sensitive_settings",
    {
      _workspace: workspaceId,
      _section: section,
      ...(value === undefined ? {} : { _value: value }),
    },
  );
  if (error) {
    if (error.code === "42501")
      throw new Error("Você não tem permissão para acessar estas configurações.");
    throw new Error(error.message);
  }
  return data;
}

export async function readWorkspaceSettings(
  supabase: SupabaseClient,
  userId: string,
  section: WorkspaceSettingsSection,
): Promise<Record<string, unknown>> {
  const value = await callSettingsRpc(supabase, userId, section);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Não foi possível carregar as configurações.");
  }
  return value as Record<string, unknown>;
}

export async function writeWorkspaceSettings(
  supabase: SupabaseClient,
  userId: string,
  section: WorkspaceSettingsSection,
  value: Record<string, unknown>,
): Promise<void> {
  const result = await callSettingsRpc(supabase, userId, section, value);
  if (typeof result !== "boolean") throw new Error("Não foi possível confirmar o salvamento.");
}
