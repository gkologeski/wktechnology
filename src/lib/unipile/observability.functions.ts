// Server functions de observabilidade Unipile — F3.
// Devolve budgets, uso do dia, últimas requisições e agregados de 24h.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export type UnipileEndpointKey =
  | "profile.fetch"
  | "profile.search"
  | "message.send"
  | "invite.send"
  | "chat.list"
  | "hosted.link";

// Espelho dos limites diários definidos em client.server.ts (BUDGETS).
// Mantido em módulo client-safe apenas para exibição — nunca usado
// para autorizar chamadas.
export const ENDPOINT_DAILY_LIMITS: Record<UnipileEndpointKey, number> = {
  "profile.fetch": 80,
  "profile.search": 20,
  "message.send": 40,
  "invite.send": 15,
  "chat.list": 200,
  "hosted.link": 50,
};

export const ENDPOINT_LABELS: Record<UnipileEndpointKey, string> = {
  "profile.fetch": "Perfil (fetch)",
  "profile.search": "Busca de perfis",
  "message.send": "Mensagens enviadas",
  "invite.send": "Convites enviados",
  "chat.list": "Sincronização de chats",
  "hosted.link": "Hosted Auth links",
};

export interface ObservabilityBudget {
  endpoint: UnipileEndpointKey;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  last_request_at: string | null;
}

export interface ObservabilityRequest {
  id: number;
  endpoint: string;
  method: string;
  status: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface ObservabilityAggregate {
  window_hours: number;
  total: number;
  success: number;
  errors: number;
  success_rate: number; // 0-1
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
}

export const getObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: acc } = await supabase
      .from("unipile_accounts")
      .select("id, status, display_name, unipile_account_id, daily_window, last_seen_at, last_error")
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const emptyBudgets: ObservabilityBudget[] = (Object.keys(ENDPOINT_DAILY_LIMITS) as UnipileEndpointKey[])
      .map((endpoint) => ({
        endpoint,
        label: ENDPOINT_LABELS[endpoint],
        used: 0,
        limit: ENDPOINT_DAILY_LIMITS[endpoint],
        remaining: ENDPOINT_DAILY_LIMITS[endpoint],
        last_request_at: null,
      }));

    if (!acc) {
      return {
        account: null,
        budgets: emptyBudgets,
        requests: [] as ObservabilityRequest[],
        aggregate: {
          window_hours: 24,
          total: 0,
          success: 0,
          errors: 0,
          success_rate: 0,
          avg_latency_ms: null,
          p95_latency_ms: null,
        } as ObservabilityAggregate,
      };
    }

    const day = new Date().toISOString().slice(0, 10);
    const [{ data: buckets }, { data: requests }] = await Promise.all([
      supabase
        .from("unipile_rate_buckets")
        .select("endpoint, count, last_request_at")
        .eq("account_id", acc.id)
        .eq("day_utc", day),
      supabase
        .from("unipile_request_log")
        .select("id, endpoint, method, status, latency_ms, error, created_at")
        .eq("account_id", acc.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const byEndpoint = new Map<string, { count: number; last_request_at: string | null }>();
    for (const b of buckets ?? []) {
      byEndpoint.set(b.endpoint as string, {
        count: (b as { count: number }).count ?? 0,
        last_request_at: (b as { last_request_at: string | null }).last_request_at ?? null,
      });
    }
    const budgets: ObservabilityBudget[] = (Object.keys(ENDPOINT_DAILY_LIMITS) as UnipileEndpointKey[]).map(
      (endpoint) => {
        const b = byEndpoint.get(endpoint);
        const used = b?.count ?? 0;
        const limit = ENDPOINT_DAILY_LIMITS[endpoint];
        return {
          endpoint,
          label: ENDPOINT_LABELS[endpoint],
          used,
          limit,
          remaining: Math.max(0, limit - used),
          last_request_at: b?.last_request_at ?? null,
        };
      },
    );

    // Agregado 24h a partir dos requests trazidos
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const win = (requests ?? []).filter((r) => new Date(r.created_at as string).getTime() >= cutoff);
    const total = win.length;
    const success = win.filter((r) => {
      const s = (r.status ?? 0) as number;
      return s >= 200 && s < 300;
    }).length;
    const errors = total - success;
    const lats = win
      .map((r) => r.latency_ms as number | null)
      .filter((v): v is number => typeof v === "number" && v >= 0)
      .sort((a, b) => a - b);
    const avg = lats.length
      ? Math.round(lats.reduce((s, v) => s + v, 0) / lats.length)
      : null;
    const p95 = lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))] : null;

    return {
      account: acc,
      budgets,
      requests: (requests ?? []) as ObservabilityRequest[],
      aggregate: {
        window_hours: 24,
        total,
        success,
        errors,
        success_rate: total ? success / total : 0,
        avg_latency_ms: avg,
        p95_latency_ms: p95,
      } as ObservabilityAggregate,
    };
  });
