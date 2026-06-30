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
      successRedirect: `${baseUrl}/settings/integrations/linkedin?connected=1`,
      failureRedirect: `${baseUrl}/settings/integrations/linkedin?connected=0`,
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
