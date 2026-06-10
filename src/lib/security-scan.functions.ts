// Server functions to expose security scan history to the admin UI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
) {
  // platform_admins is admin-only; use is_platform_admin RPC via a select
  // (we can read our own row).
  // Direct table read works because RLS lets users see their own row.
  const { data } = await (supabase as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const listSecurityScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: runs } = await supabaseAdmin
      .from("security_scan_runs")
      .select("id, started_at, finished_at, status, totals, duration_ms, error")
      .order("started_at", { ascending: false })
      .limit(30);
    return { runs: runs ?? [] };
  });

export const getSecurityScanFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ run_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: findings } = await supabaseAdmin
      .from("security_scan_findings")
      .select("id, scanner, severity, category, code, title, detail, ref, created_at")
      .eq("run_id", data.run_id)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });
    return { findings: findings ?? [] };
  });

export const runSecurityScanNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase as any, context.userId);
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error("CRON_SECRET não configurado");
    const url =
      "https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/security-scan-tick";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: "{}",
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Scan respondeu ${r.status}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true };
    }
  });
