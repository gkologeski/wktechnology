// Server functions de gerenciamento da conta LinkedIn via Unipile.
// IMPORTANTE: import dinâmico de "*.server" dentro dos handlers para
// não vazar módulos server-only no bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { requireLinkedinPermission } from "./account-access.middleware";

export const getLinkedinAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("view")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("unipile_accounts")
      .select(
        "id, status, unipile_account_id, display_name, connected_at, last_seen_at, daily_window, last_error, operation_policy, paused_until",
      )
      .eq("workspace_id", workspaceId)
      .eq("owner_id", userId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a conta LinkedIn.");
    return { account: data ?? null };
  });

export const getRateUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("view")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: acc, error: accountError } = await supabase
      .from("unipile_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("owner_id", userId)
      .eq("provider", "linkedin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (accountError) throw new Error("Não foi possível consultar a conta LinkedIn.");
    if (!acc) return { buckets: [] as Array<{ endpoint: string; count: number; day_utc: string }> };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc(
      "unipile_usage_snapshot" as never,
      { p_account: acc.id } as never,
    );
    if (result.error) throw new Error("Não foi possível carregar o uso da conta.");
    return result.data as {
      buckets: Array<{ endpoint: string; count: number; day_utc: string; limit: number }>;
      timezone: string;
    };
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
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
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
 * Inicia Hosted Auth com estado privado e limitado; preserva a conta atual até confirmação.
 */
export const startLinkedinConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { beginPersonalLinkedin } = await import("./auth-flow.server");
    return beginPersonalLinkedin(supabaseAdmin, userId, workspaceId);
  });

export const disconnectLinkedinAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("unipile_accounts")
      .update({ status: "disconnected", last_error: "Disconnected by owner" })
      .eq("workspace_id", workspaceId)
      .eq("owner_id", userId)
      .eq("provider", "linkedin");
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

/** Confirma somente a conta exata no escopo pessoal e no fluxo de uso único. */
export const reconcileLinkedinAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
  .inputValidator((input: unknown) =>
    z
      .object({ state: z.string().min(32).max(128), accountId: z.string().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { finishPersonalLinkedin } = await import("./auth-flow.server");
    return finishPersonalLinkedin(
      supabaseAdmin,
      context.userId,
      workspaceId,
      data.state,
      data.accountId,
    );
  });

export const updateDailyWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
  .inputValidator((d: { tz?: string; start_hour: number; end_hour: number }) =>
    z
      .object({
        tz: z
          .string()
          .min(1)
          .max(64)
          .default("America/Sao_Paulo")
          .refine((value) => {
            try {
              new Intl.DateTimeFormat("pt-BR", { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, "Fuso horário inválido."),
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("unipile_accounts")
      .update({ daily_window: data })
      .eq("workspace_id", workspaceId)
      .eq("owner_id", userId)
      .eq("provider", "linkedin");
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const saveLinkedinOperationPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireLinkedinPermission("manage")])
  .inputValidator(async (input: unknown) =>
    (await import("./operation-policy")).linkedinPolicySchema.parse(input),
  )
  .handler(async ({ context, data }) => {
    const workspace = await resolveActiveWorkspace(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("unipile_accounts")
      .update({ operation_policy: data } as never)
      .eq("owner_id", context.userId)
      .eq("workspace_id", workspace)
      .eq("provider", "linkedin")
      .select("id");
    if (result.error || !result.data?.length)
      throw new Error("Conta indisponível para configurar limites.");
    return { ok: true };
  });
