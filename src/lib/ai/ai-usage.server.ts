import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { AI_FEATURES } from "./features";
import type { AiUsageFilters } from "./ai-usage.functions";

async function ctxFor(supabase: SupabaseClient, userId: string) {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  return { workspaceId, isAdmin: Boolean(data) };
}

const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export async function loadUsageSummary(supabase: SupabaseClient, userId: string, days: number) {
  const { workspaceId, isAdmin } = await ctxFor(supabase, userId);
  const { data: s } = await supabase
    .from("workspace_ai_settings")
    .select("provider, model, status, last_error")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const active = {
    provider: s?.provider ?? "lovable",
    model: s?.model ?? null,
    status: s?.status ?? "connected",
    lastError: s?.last_error ?? null,
  };
  if (!isAdmin) return { isAdmin, active, metrics: null };

  const { data, error } = await supabase
    .from("ai_call_logs")
    .select("status, estimated_cost_usd, prompt_tokens, completion_tokens")
    .eq("workspace_id", workspaceId)
    .gte("created_at", since(days))
    .limit(50000);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const total = rows.length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const priced = rows.filter((r) => r.estimated_cost_usd != null);
  const cost = priced.reduce((a, r) => a + Number(r.estimated_cost_usd), 0);
  return {
    isAdmin,
    active,
    metrics: {
      total,
      failed,
      errorRate: total ? failed / total : 0,
      costUsd: cost,
      avgCostUsd: priced.length ? cost / priced.length : null,
      unpricedCalls: total - priced.length,
    },
  };
}

export async function loadCallLogs(supabase: SupabaseClient, userId: string, f: AiUsageFilters) {
  const { workspaceId, isAdmin } = await ctxFor(supabase, userId);
  if (!isAdmin) throw new Error("Apenas administradores veem o histórico de IA.");
  let q = supabase
    .from("ai_call_logs")
    .select(
      "id, created_at, feature, trigger_source, triggered_by, provider, model, prompt_tokens, completion_tokens, estimated_cost_usd, duration_ms, status, error",
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId)
    .gte("created_at", since(f.days))
    .order("created_at", { ascending: false })
    .range(f.page * f.pageSize, f.page * f.pageSize + f.pageSize - 1);
  if (f.feature) q = q.eq("feature", f.feature);
  if (f.triggerSource) q = q.eq("trigger_source", f.triggerSource);
  if (f.provider) q = q.eq("provider", f.provider);
  if (f.status) q = q.eq("status", f.status);
  if (f.search) {
    const s = f.search.toLowerCase();
    const feats = Object.entries(AI_FEATURES)
      .filter(([k, v]) => k.includes(s) || v.toLowerCase().includes(s))
      .map(([k]) => k);
    const safe = f.search.replace(/[,()%]/g, " ");
    q = q.or(
      [
        `model.ilike.%${safe}%`,
        `provider.ilike.%${safe}%`,
        ...(feats.length ? [`feature.in.(${feats.join(",")})`] : []),
      ].join(","),
    );
  }
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((r) => r.triggered_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of ps ?? []) names.set(p.id, p.full_name || "Usuário");
  }
  return {
    total: count ?? 0,
    rows: (data ?? []).map((r) => ({
      ...r,
      estimated_cost_usd: r.estimated_cost_usd == null ? null : Number(r.estimated_cost_usd),
      triggered_by_name: r.triggered_by ? (names.get(r.triggered_by) ?? "Usuário") : null,
    })),
  };
}
