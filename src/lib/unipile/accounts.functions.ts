// Server functions de gerenciamento da conta LinkedIn via Unipile.
// IMPORTANTE: import dinâmico de "*.server" dentro dos handlers para
// não vazar módulos server-only no bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAppUrl } from "@/lib/app-url";

export const getLinkedinAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("unipile_accounts")
      .select(
        "id, status, unipile_account_id, display_name, connected_at, last_seen_at, daily_window, last_error",
      )
      .eq("owner_id", userId)
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
    const { data: acc } = await supabase
      .from("unipile_accounts")
      .select("id")
      .eq("owner_id", userId)
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

/**
 * Inicia o fluxo Hosted Auth: cria registro pending + retorna URL para o usuário.
 */
export const startLinkedinConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const connectToken = `lvb_${randomBytes(16).toString("hex")}`;

    // Upsert pending account (mantém uma única linha por usuário)
    const { data: existing } = await supabase
      .from("unipile_accounts")
      .select("id")
      .eq("owner_id", userId)
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
        provider: "linkedin",
        status: "pending",
        connect_token: connectToken,
      });
    }

    const baseUrl = getAppUrl();
    const { createHostedAuthLink } = await import("@/lib/unipile/client.server");
    const link = await createHostedAuthLink({
      ownerId: userId,
      notifyUrl: `${baseUrl}/api/public/unipile/webhook`,
      successRedirect: `${baseUrl}/unipile-connected?connected=1`,
      failureRedirect: `${baseUrl}/unipile-connected?connected=0`,
      connectToken,
    });
    return { url: link.url };
  });

export const disconnectLinkedinAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("unipile_accounts")
      .update({ status: "disconnected", unipile_account_id: null })
      .eq("owner_id", userId)
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
    const { data: row } = await supabase
      .from("unipile_accounts")
      .select("id, status, connect_token, unipile_account_id")
      .eq("owner_id", userId)
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
      .refine((v) => v.end_hour > v.start_hour, { message: "end_hour deve ser maior que start_hour" })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("unipile_accounts")
      .update({ daily_window: data })
      .eq("owner_id", userId)
      .eq("provider", "linkedin");
    return { ok: true };
  });
