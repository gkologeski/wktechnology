// Server functions de gerenciamento da conta LinkedIn via Unipile.
// IMPORTANTE: import dinâmico de "*.server" dentro dos handlers para
// não vazar módulos server-only no bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAppUrl } from "@/lib/app-url";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const getLinkedinAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("unipile_accounts")
      .select(
        "id, status, unipile_account_id, display_name, connected_at, last_seen_at, daily_window, last_error",
      )
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { account: data ?? null };
  });

export const getRateUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: acc } = await supabase
      .from("unipile_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!acc) return { buckets: [] as Array<{ endpoint: string; count: number; day_utc: string }> };
    const day = new Date().toISOString().slice(0, 10);
    const { data: buckets } = await supabase
      .from("unipile_rate_buckets")
      .select("endpoint, count, day_utc, last_request_at")
      .eq("account_id", acc.id)
      .eq("day_utc", day);
    return { buckets: buckets ?? [] };
  });

/** Mensagens pt-BR para falhas de credencial/requisição da Unipile. */
const CREDENTIAL_MESSAGE: Record<string, string> = {
  missing_credentials:
    "Integração Unipile não configurada. Salve a chave da API (UNIPILE_API_KEY) nas configurações.",
  invalid_credentials:
    "Chave da API Unipile inválida ou expirada. Gere uma nova chave (API v2) no painel da Unipile e atualize nas configurações.",
  invalid_parameters:
    "A Unipile recusou os parâmetros da conexão. Tente novamente; se persistir, veja o detalhe técnico abaixo.",
  provider_error: "A Unipile recusou a requisição. Tente novamente em alguns minutos.",
  network_error: "Não foi possível falar com a Unipile. Verifique a conexão e tente novamente.",
};

/**
 * Testa as credenciais da API v2 sem expor a chave.
 */
export const checkUnipileCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { verifyApiKey } = await import("@/lib/unipile/client.server");
    const result = await verifyApiKey();
    if (result.ok) return { ok: true as const, message: "Chave da API Unipile válida." };
    return {
      ok: false as const,
      reason: result.reason,
      status: result.status ?? null,
      detail: result.detail ?? null,
      message: CREDENTIAL_MESSAGE[result.reason] ?? CREDENTIAL_MESSAGE.provider_error,
    };
  });

/**
 * Inicia o fluxo Hosted Auth: cria registro pending + retorna URL para o usuário.
 */
export const startLinkedinConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { verifyApiKey } = await import("@/lib/unipile/client.server");
    const check = await verifyApiKey();
    if (!check.ok) {
      throw new Error(CREDENTIAL_MESSAGE[check.reason] ?? CREDENTIAL_MESSAGE.provider_error);
    }
    const connectToken = `lvb_${randomBytes(16).toString("hex")}`;

    // Upsert pending account (mantém uma única linha por usuário)
    const { data: existing } = await supabase
      .from("unipile_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("unipile_accounts")
        .update({ status: "pending", connect_token: connectToken, last_error: null })
        .eq("id", existing.id);
    } else {
      await supabase.from("unipile_accounts").insert({
        owner_id: userId,
        workspace_id: workspaceId,
        provider: "linkedin",
        status: "pending",
        connect_token: connectToken,
      });
    }

    const baseUrl = getAppUrl();
    const { createHostedAuthLink, UnipileError } = await import("@/lib/unipile/client.server");
    try {
      const link = await createHostedAuthLink({
        ownerId: userId,
        notifyUrl: `${baseUrl}/api/public/unipile/webhook`,
        successRedirect: `${baseUrl}/unipile-connected?connected=1`,
        failureRedirect: `${baseUrl}/unipile-connected?connected=0`,
        connectToken,
      });
      return { url: link.url };
    } catch (e) {
      if (e instanceof UnipileError) {
        const friendly = CREDENTIAL_MESSAGE[e.code] ?? CREDENTIAL_MESSAGE.provider_error;
        throw new Error(`${friendly} (detalhe: ${e.message})`);
      }
      throw e;
    }
  });

export const disconnectLinkedinAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await supabase
      .from("unipile_accounts")
      .update({ status: "disconnected", unipile_account_id: null })
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin");
    return { ok: true };
  });

/**
 * Fallback de reconciliação após o retorno do Hosted Auth.
 *
 * v1: o webhook pode não ter chegado ainda; procuramos na API Unipile uma conta
 * cujo `name` bate com o `connect_token` salvo.
 * v2: o hosted auth não aceita mais `name` nem `notify_url`, então o
 * `connect_token` volta como `state` na URL de retorno. Validamos esse `state`
 * contra o token salvo e adotamos a conta LinkedIn mais recente de
 * `GET /v2/accounts`.
 */
export const reconcileLinkedinAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ state: z.string().trim().min(1).max(128).optional() })
      .partial()
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row } = await supabase
      .from("unipile_accounts")
      .select("id, status, connect_token, unipile_account_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return { ok: false, reason: "no_account" };
    if (row.status === "connected" && row.unipile_account_id) {
      return { ok: true, already: true };
    }

    const { listUnipileAccounts } = await import("@/lib/unipile/client.server");

    // Na v2 o `state` é a única correlação disponível: se veio e não bate com o
    // token emitido por nós, não adotamos nenhuma conta.
    if (data.state && data.state !== row.connect_token) {
      return { ok: false, reason: "state_mismatch" };
    }

    const listed = await listUnipileAccounts(50);
    if (!listed.ok) return { ok: false, reason: listed.reason };

    let match: (typeof listed.items)[number] | undefined;
    {
      match = listed.items
        .filter((a) => a.provider.includes("LINKEDIN"))
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    }
    if (!match?.id) return { ok: false, reason: "no_match" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("unipile_accounts")
      .update({
        status: "connected",
        unipile_account_id: match.id,
        connected_at: nowIso,
        last_seen_at: nowIso,
        last_error: null,
        display_name: match.name,
      })
      .eq("id", row.id);
    return { ok: true, account_id: match.id };
  });

export const updateDailyWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tz?: string; start_hour: number; end_hour: number }) =>
    z
      .object({
        tz: z.string().min(1).max(64).default("America/Sao_Paulo"),
        start_hour: z.number().int().min(0).max(23),
        end_hour: z.number().int().min(1).max(24),
      })
      .refine((v) => v.end_hour > v.start_hour, {
        message: "end_hour deve ser maior que start_hour",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await supabase
      .from("unipile_accounts")
      .update({ daily_window: data })
      .eq("workspace_id", workspaceId)
      .eq("provider", "linkedin");
    return { ok: true };
  });
