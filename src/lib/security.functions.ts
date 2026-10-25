import { requireSharedPermission } from "@/lib/access-control/shared-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
// Configurações de segurança do workspace (IP allow-list, timeout, MFA, força SSO, região).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SecuritySchema = z.object({
  ip_allowlist: z.array(z.string().min(1).max(64)).max(50).optional(),
  ip_allowlist_enabled: z.boolean().optional(),
  session_timeout_minutes: z.number().int().min(15).max(1440).optional(),
  require_mfa: z.boolean().optional(),
  force_sso: z.boolean().optional(),
});

export type SecuritySettings = {
  ip_allowlist?: string[];
  ip_allowlist_enabled?: boolean;
  session_timeout_minutes?: number;
  require_mfa?: boolean;
  force_sso?: boolean;
};

export const getWorkspaceSecurity = createServerFn({ method: "GET" })
  .middleware([requireSharedPermission("system.settings", "view")])
  .handler(async ({ context }) => {
    return workRpc<{
      workspaceId: string;
      security: SecuritySettings;
      dataRegion: "BR" | "US" | "EU";
    }>(context.supabase, "shared_security_settings", { p: null });
  });

export const updateWorkspaceSecurity = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.settings", "view")])
  .inputValidator((d: unknown) => SecuritySchema.parse(d))
  .handler(async ({ data, context }) => {
    const result = await workRpc<{ security: SecuritySettings }>(
      context.supabase,
      "shared_security_settings",
      { p: { security: data } },
    );
    return { ok: true, security: result.security };
  });

export const updateDataRegion = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.settings", "view")])
  .inputValidator((d: { region: "BR" | "US" | "EU" }) =>
    z.object({ region: z.enum(["BR", "US", "EU"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await workRpc(context.supabase, "shared_security_settings", { p: { region: data.region } });
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
  .middleware([requireSharedPermission("system.settings", "view")])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const ws = context.sharedWorkspaceId;
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
