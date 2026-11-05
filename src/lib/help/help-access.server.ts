// Monta o contexto de acesso da Ajuda no servidor (workspace ativo, vínculo,
// admin, licenças e chaves efetivas) e aplica as regras puras de help-access.ts.
// As consultas usam o cliente do usuário: o RLS de help_* é a fronteira final.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canReadHelpArticle,
  canReadHelpModule,
  HELP_MODULE_KEYS,
  type HelpAccessInput,
  type HelpModuleKey,
} from "./help-access";

export async function loadHelpAccessInput(
  supabase: SupabaseClient,
  userId: string,
): Promise<HelpAccessInput> {
  const empty: HelpAccessInput = {
    activeWorkspaceId: null,
    membershipStatus: null,
    isPlatformAdmin: false,
    isWorkspaceAdmin: false,
    licensedModules: null,
    grants: [],
  };
  const platform = await supabase.rpc("is_platform_admin", { _user: userId });
  const isPlatformAdmin = platform.data === true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  const ws =
    (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
  if (!ws) return { ...empty, isPlatformAdmin };

  const member = await supabase.rpc("is_workspace_member", { _workspace: ws, _user: userId });
  if (member.error || member.data !== true) {
    return { ...empty, isPlatformAdmin, activeWorkspaceId: ws, membershipStatus: "inactive" };
  }

  const admin = await supabase.rpc("is_workspace_admin_v2", { _workspace: ws, _user: userId });
  const { data: licenseRows } = await supabase
    .from("workspace_modules")
    .select("module_id, enabled")
    .eq("workspace_id", ws);
  const rows = (licenseRows ?? []) as Array<{ module_id: string; enabled: boolean }>;
  const licensedModules =
    rows.length > 0 ? rows.filter((r) => r.enabled).map((r) => r.module_id) : null;

  // Chaves já efetivas (deny aplicado no banco) do workspace ativo.
  const agg = await supabase.rpc("current_user_permissions_json", { _workspace_id: ws });
  const keys: string[] = Array.isArray(agg.data) ? (agg.data as string[]) : [];

  return {
    activeWorkspaceId: ws,
    membershipStatus: "active",
    isPlatformAdmin,
    isWorkspaceAdmin: admin.data === true,
    licensedModules,
    grants: keys.map((key) => ({ workspaceId: ws, key, effect: "allow" as const })),
  };
}

export function readableHelpModules(input: HelpAccessInput): HelpModuleKey[] {
  return HELP_MODULE_KEYS.filter((m) => canReadHelpModule(m, input));
}

export function filterReadableArticles<
  T extends {
    module_key: string;
    min_permission: string | null;
    is_published: boolean;
    audience: string;
  },
>(rows: T[], input: HelpAccessInput): T[] {
  return rows.filter((r) => canReadHelpArticle(r, input));
}
