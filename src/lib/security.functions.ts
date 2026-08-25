// Configurações de segurança do workspace (IP allow-list, timeout, MFA, força SSO, região).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/access-control/enforce.server";

const SecuritySchema = z.object({
  ip_allowlist: z.array(z.string().min(1).max(64)).max(50).optional(),
  ip_allowlist_enabled: z.boolean().optional(),
  session_timeout_minutes: z.number().int().min(15).max(1440).optional(),
  require_mfa: z.boolean().optional(),
  force_sso: z.boolean().optional(),
});

async function activeWorkspace(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("Workspace ativo não encontrado");
  return data.active_workspace_id as string;
}

export type SecuritySettings = {
  ip_allowlist?: string[];
  ip_allowlist_enabled?: boolean;
  session_timeout_minutes?: number;
  require_mfa?: boolean;
  force_sso?: boolean;
};

export const getWorkspaceSecurity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { data } = await supabase
      .from("workspaces")
      .select("id, security_settings, data_region")
      .eq("id", ws)
      .maybeSingle();
    const sec = (data?.security_settings ?? {}) as SecuritySettings;
    return {
      workspaceId: ws,
      security: sec,
      dataRegion: (data?.data_region ?? "BR") as "BR" | "US" | "EU",
    };
  });

export const updateWorkspaceSecurity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SecuritySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    await assertPermission(supabase, userId, ws, "system.settings.manage.workspace");

    const { data: current } = await supabase
      .from("workspaces")
      .select("security_settings")
      .eq("id", ws)
      .maybeSingle();
    const prev = (current?.security_settings ?? {}) as SecuritySettings;
    const next: SecuritySettings = { ...prev, ...data };
    const { error } = await (supabase.from("workspaces") as any)
      .update({ security_settings: next })
      .eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true, security: next };
  });

export const updateDataRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { region: "BR" | "US" | "EU" }) =>
    z.object({ region: z.enum(["BR", "US", "EU"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    await assertPermission(supabase, userId, ws, "system.settings.manage.workspace");

    const { error } = await (supabase.from("workspaces") as any)
      .update({ data_region: data.region })
      .eq("id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Verifica se um IP está na allow-list ativa do workspace. Quando a lista
 * está desativada, retorna sempre true.
 */
export function isIpAllowed(
  ip: string,
  settings: { ip_allowlist?: string[]; ip_allowlist_enabled?: boolean },
): boolean {
  if (!settings.ip_allowlist_enabled) return true;
  const list = settings.ip_allowlist ?? [];
  if (list.length === 0) return true;
  // Suporte simples: exact match ou prefixo CIDR /24 ("192.168.1.").
  return list.some((entry) => {
    if (entry.includes("/")) {
      const [base] = entry.split("/");
      const prefix = base.split(".").slice(0, 3).join(".") + ".";
      return ip.startsWith(prefix);
    }
    return ip === entry;
  });
}

export const listIpAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await activeWorkspace(supabase, userId);
    const { data } = await supabase
      .from("ip_access_log")
      .select("id, ip_address, user_agent, blocked, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(100);
    const items = (data ?? []).map((r: any) => ({
      id: r.id as string,
      ip_address: String(r.ip_address ?? ""),
      user_agent: (r.user_agent as string | null) ?? null,
      blocked: r.blocked as boolean,
      created_at: r.created_at as string,
    }));
    return { items };
  });
