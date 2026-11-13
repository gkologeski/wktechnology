// Server functions de observabilidade Unipile — F3.
// Devolve budgets, uso do dia, últimas requisições e agregados de 24h.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { requireLinkedinPermission } from "./account-access.middleware";

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
  "message.send": 50,
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
  .middleware([requireSupabaseAuth, requireLinkedinPermission("view")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: acc } = await supabase
      .from("unipile_accounts")
      .select(
        "id, status, display_name, unipile_account_id, daily_window, last_seen_at, last_error",
      )
      .eq("workspace_id", workspaceId)
      .eq("owner_id", userId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const emptyBudgets: ObservabilityBudget[] = (
      Object.keys(ENDPOINT_DAILY_LIMITS) as UnipileEndpointKey[]
    ).map((endpoint) => ({
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [snapshot, requestResult] = await Promise.all([
      supabaseAdmin.rpc("unipile_usage_snapshot" as never, { p_account: acc.id } as never),
      supabase
        .from("unipile_request_log")
        .select("id, endpoint, method, status, latency_ms, error, created_at")
        .eq("account_id", acc.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (snapshot.error || requestResult.error)
      throw new Error("Não foi possível carregar a observabilidade LinkedIn.");
    const requests = requestResult.data;
    const usage = snapshot.data as {
      buckets: Array<{ endpoint: UnipileEndpointKey; count: number; limit: number }>;
      aggregate: ObservabilityAggregate;
    };
    const budgets: ObservabilityBudget[] = usage.buckets.map((item) => ({
      endpoint: item.endpoint,
      label: ENDPOINT_LABELS[item.endpoint],
      used: item.count,
      limit: item.limit,
      remaining: Math.max(0, item.limit - item.count),
      last_request_at: null,
    }));

    return {
      account: acc,
      budgets,
      requests: (requests ?? []) as ObservabilityRequest[],
      aggregate: usage.aggregate,
    };
  });
