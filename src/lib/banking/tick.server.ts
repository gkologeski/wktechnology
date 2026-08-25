// Fase 6 — Cron de observabilidade bancária.
// Para cada bank_connection ativa:
//   1. Sincroniza saldo + extrato (últimas 24h)
//   2. Refaz refresh do token quando vencendo em <24h
//   3. Reconcilia bank_payments presos em "processing" há >60min
// Registra eventos em bank_connection_events e alertas em platform_alert_events.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveBankProvider } from "@/lib/banking/providers";
import { settleBankPaymentAdmin } from "@/lib/banking/payments.server";

const STUCK_MS = 60 * 60 * 1000; // 60 min
const TOKEN_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

async function emitAlert(
  severity: "info" | "warning" | "error",
  message: string,
  context: Record<string, unknown>,
) {
  try {
    await (supabaseAdmin as any)
      .from("platform_alert_events")
      .insert({ severity, message, context });
  } catch (e) {
    console.warn("[banking-tick] alert insert failed", e);
  }
}

async function logEvent(
  connectionId: string,
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  try {
    await (supabaseAdmin as any).from("bank_connection_events").insert({
      connection_id: connectionId,
      workspace_id: workspaceId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.warn("[banking-tick] event insert failed", e);
  }
}

async function getActiveToken(connectionId: string) {
  const { data } = await (supabaseAdmin as any)
    .from("bank_connection_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .eq("connection_id", connectionId)
    .is("rotated_at", null)
    .maybeSingle();
  return data as {
    id: string;
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
  } | null;
}

async function maybeRefreshToken(
  conn: { id: string; provider: string; mode: string; workspace_id: string },
  tokenRow: {
    id: string;
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
  },
): Promise<string> {
  if (!tokenRow.expires_at) return tokenRow.access_token;
  const expMs = new Date(tokenRow.expires_at).getTime();
  const now = Date.now();
  if (expMs - now > TOKEN_REFRESH_WINDOW_MS) return tokenRow.access_token;
  if (!tokenRow.refresh_token) {
    await emitAlert(
      "warning",
      "Token bancário expirando sem refresh_token — reautorização necessária",
      {
        connection_id: conn.id,
        workspace_id: conn.workspace_id,
        expires_at: tokenRow.expires_at,
      },
    );
    return tokenRow.access_token;
  }

  try {
    const provider = resolveBankProvider(conn.provider, conn.mode);
    const fresh = await provider.refreshTokens({ refresh_token: tokenRow.refresh_token });
    const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
    await (supabaseAdmin as any)
      .from("bank_connection_tokens")
      .update({ rotated_at: new Date().toISOString() })
      .eq("id", tokenRow.id);
    await (supabaseAdmin as any).from("bank_connection_tokens").insert({
      connection_id: conn.id,
      workspace_id: conn.workspace_id,
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token,
      token_type: fresh.token_type,
      scope: fresh.scope,
      expires_at: newExpiresAt,
    });
    await logEvent(conn.id, conn.workspace_id, "token_refreshed", { expires_at: newExpiresAt });
    return fresh.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await emitAlert("error", `Falha ao renovar token bancário: ${msg}`, {
      connection_id: conn.id,
      workspace_id: conn.workspace_id,
    });
    await logEvent(conn.id, conn.workspace_id, "error", { stage: "refresh_token", message: msg });
    return tokenRow.access_token;
  }
}

async function syncOneConnection(conn: any): Promise<{ inserted: number; balance: number | null }> {
  const tokenRow = await getActiveToken(conn.id);
  if (!tokenRow) {
    await emitAlert("warning", "Conexão bancária sem token ativo — reautorizar", {
      connection_id: conn.id,
      workspace_id: conn.workspace_id,
    });
    return { inserted: 0, balance: null };
  }
  const accessToken = await maybeRefreshToken(conn, tokenRow);
  const provider = resolveBankProvider(conn.provider, conn.mode);

  const to = new Date().toISOString();
  const from = conn.last_statement_sync_at ?? new Date(Date.now() - 86_400_000).toISOString();

  const [{ balance }, statement] = await Promise.all([
    provider.fetchBalance({ access_token: accessToken }),
    provider.fetchStatement({ access_token: accessToken, from, to }),
  ]);

  const { data: linkedAccount } = await (supabaseAdmin as any)
    .from("financial_bank_accounts")
    .select("id")
    .eq("workspace_id", conn.workspace_id)
    .eq("bank_connection_id", conn.id)
    .maybeSingle();

  let inserted = 0;
  if (statement.transactions.length) {
    const rows = statement.transactions.map((t) => ({
      workspace_id: conn.workspace_id,
      connection_id: conn.id,
      bank_account_id: linkedAccount?.id ?? null,
      external_id: t.external_id,
      posted_at: t.posted_at,
      amount: t.amount,
      direction: t.direction,
      description: t.description,
      counterparty: t.counterparty,
      category: t.category,
      balance_after: t.balance_after,
      raw: (t.raw ?? {}) as any,
    }));
    const { count } = await (supabaseAdmin as any)
      .from("bank_statement_transactions")
      .upsert(rows, { onConflict: "connection_id,external_id", count: "exact" });
    inserted = count ?? rows.length;
  }

  const now = new Date().toISOString();
  await (supabaseAdmin as any)
    .from("bank_connections")
    .update({
      current_balance: balance,
      balance_synced_at: now,
      last_statement_sync_at: now,
      last_sync_at: now,
      last_error: null,
    })
    .eq("id", conn.id);

  await logEvent(conn.id, conn.workspace_id, "sync", {
    source: "cron",
    from,
    to,
    count: statement.transactions.length,
    balance,
  });

  return { inserted, balance };
}

async function reconcileStuckPayments(conn: any): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  const { data: stuck } = await (supabaseAdmin as any)
    .from("bank_payments")
    .select("id, external_id, approved_at, workspace_id")
    .eq("connection_id", conn.id)
    .eq("status", "processing")
    .not("external_id", "is", null)
    .lt("approved_at", cutoff)
    .limit(50);

  if (!stuck?.length) return 0;

  const tokenRow = await getActiveToken(conn.id);
  if (!tokenRow) return 0;
  const provider = resolveBankProvider(conn.provider, conn.mode);
  if (!provider.getPaymentStatus) return 0;

  let updated = 0;
  for (const p of stuck as any[]) {
    try {
      const status = await provider.getPaymentStatus({
        access_token: tokenRow.access_token,
        external_id: p.external_id,
      });
      if (status.status === "paid") {
        await settleBankPaymentAdmin(
          supabaseAdmin as any,
          p.id,
          status.paid_at ?? new Date().toISOString(),
        );
        updated++;
      } else if (status.status === "failed" || status.status === "canceled") {
        await (supabaseAdmin as any)
          .from("bank_payments")
          .update({ status: status.status, failure_reason: status.failure_reason ?? null })
          .eq("id", p.id);
        await logEvent(conn.id, conn.workspace_id, "payment_failed", {
          payment_id: p.id,
          reason: status.failure_reason,
        });
        updated++;
      } else {
        // Ainda em processamento — alerta se muito antigo (>6h)
        const ageMs = Date.now() - new Date(p.approved_at).getTime();
        if (ageMs > 6 * 60 * 60 * 1000) {
          await emitAlert("warning", "Pagamento bancário preso em processamento há mais de 6h", {
            payment_id: p.id,
            connection_id: conn.id,
            workspace_id: conn.workspace_id,
            age_hours: Math.round(ageMs / 3_600_000),
          });
        }
      }
    } catch (e) {
      console.warn("[banking-tick] payment status check failed", p.id, e);
    }
  }
  return updated;
}

export async function tickAllBankConnections(): Promise<Record<string, unknown>> {
  const { data: conns, error } = await (supabaseAdmin as any)
    .from("bank_connections")
    .select("id, workspace_id, provider, mode, status, last_statement_sync_at")
    .eq("status", "connected");
  if (error) throw new Error(error.message);

  let synced = 0;
  let inserted = 0;
  let paymentsReconciled = 0;
  let failed = 0;

  for (const c of conns ?? []) {
    try {
      const r = await syncOneConnection(c);
      inserted += r.inserted;
      synced++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await (supabaseAdmin as any)
        .from("bank_connections")
        .update({ last_error: msg })
        .eq("id", c.id);
      await logEvent(c.id, c.workspace_id, "error", { stage: "cron_sync", message: msg });
      await emitAlert("error", `Sync bancário falhou: ${msg}`, {
        connection_id: c.id,
        workspace_id: c.workspace_id,
      });
    }
    try {
      paymentsReconciled += await reconcileStuckPayments(c);
    } catch (e) {
      console.warn("[banking-tick] reconcile failed", c.id, e);
    }
  }

  return {
    connections_total: (conns ?? []).length,
    synced,
    failed,
    tx_inserted: inserted,
    payments_reconciled: paymentsReconciled,
  };
}
