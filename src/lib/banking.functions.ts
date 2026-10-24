import { bankingContext, validateBankEntry } from "@/lib/banking/access.server";
import { openBankToken, sealBankToken } from "@/lib/banking/tokens.server";
import { financeRpc } from "@/lib/access-control/finance-records.server";
import { normalizeEmailAddress } from "@/lib/email-address";
// Sprint G — Fase 1: fluxo OAuth Open Finance (provider abstrato).
// Estado persiste por workspace em `bank_connections`. Tokens ficam em
// `bank_connection_tokens` (RLS admin-only). Trilha em `bank_connection_events`.
//
// Toda ação exige a permissão específica no workspace selecionado; tokens são server-only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------------------------------------------------------------------
// GET status
// -------------------------------------------------------------------
export const getBankConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider?: string }) =>
    z.object({ provider: z.string().default("inter") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    const { data: conn, error } = await supabase
      .from("bank_connections")
      .select(
        "id, provider, status, mode, display_name, scopes, external_account_id, last_sync_at, last_error, current_balance, balance_synced_at, last_statement_sync_at, created_at, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("provider", data.provider)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const { data: events } = await supabase
      .from("bank_connection_events")
      .select("id, event_type, payload, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { internalMocksEnabled } = await import("./runtime-config.server");
    return {
      connection: conn,
      events: events ?? [],
      workspaceId,
      mockEnabled: internalMocksEnabled(),
    };
  });

// -------------------------------------------------------------------
// START authorization (cria connection em 'connecting' + state)
// -------------------------------------------------------------------
export const startBankAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider?: string; mode?: string; scopes?: string[] }) =>
    z
      .object({
        provider: z.string().default("inter"),
        mode: z.enum(["mock", "sandbox", "production"]).default("mock"),
        scopes: z.array(z.string()).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "connect", true);

    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(data.provider, data.mode);
    const scopes = data.scopes && data.scopes.length ? data.scopes : provider.defaultScopes;

    // upsert connection (uma por workspace+provider)
    const { data: upserted, error: upErr } = await supabase
      .from("bank_connections")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: provider.id,
          mode: provider.mode,
          status: "connecting",
          scopes,
          created_by: userId,
          last_error: null,
        },
        { onConflict: "workspace_id,provider" },
      )
      .select("id")
      .single();
    if (upErr) throw new Error(upErr.message);

    const init = await provider.initiateAuthorization({
      workspaceId,
      connectionId: upserted.id,
      scopes,
    });

    // persiste state em metadata para validar no complete
    const { error: metaErr } = await supabase
      .from("bank_connections")
      .update({
        metadata: {
          pending_state: init.state,
          pending_at: new Date().toISOString(),
          pending_actor: userId,
        },
      })
      .eq("id", upserted.id);
    if (metaErr) throw new Error(metaErr.message);

    await supabase.from("bank_connection_events").insert({
      connection_id: upserted.id,
      workspace_id: workspaceId,
      event_type: "initiate",
      actor_id: userId,
      payload: { provider: provider.id, mode: provider.mode, scopes },
    });

    return {
      connection_id: upserted.id,
      state: init.state,
      authorize_url: init.authorize_url,
      requires_external_redirect: init.requires_external_redirect,
      message: init.message,
      mode: provider.mode,
    };
  });

// -------------------------------------------------------------------
// COMPLETE authorization (recebe code+state e persiste tokens)
// -------------------------------------------------------------------
export const completeBankAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string; state: string; code: string }) =>
    z
      .object({
        connection_id: z.string().uuid(),
        state: z.string().min(4),
        code: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "connect", true);

    const { data: conn, error: cErr } = await supabase
      .from("bank_connections")
      .select("id, provider, mode, metadata, scopes")
      .eq("id", data.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn) throw new Error("Conexão não encontrada");

    const pendingState = (conn.metadata as Record<string, unknown> | null)?.pending_state;
    if (!pendingState || pendingState !== data.state) {
      throw new Error("state inválido — reinicie a autorização");
    }

    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);

    try {
      const tokens = await provider.exchangeCode({ code: data.code, state: data.state });
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const { data: stored, error: tErr } = await supabase.rpc("banking_store_tokens", {
        _connection: conn.id,
        _workspace: workspaceId,
        _state: data.state,
        _actor: userId,
        _tokens: {
          access_token: await sealBankToken(tokens.access_token),
          refresh_token: await sealBankToken(tokens.refresh_token),
          token_type: tokens.token_type,
          scope: tokens.scope,
          expires_at: expiresAt,
          display_name: tokens.display_name ?? "Banco Inter",
          external_account_id: tokens.external_account_id ?? null,
        },
      });
      if (tErr || stored !== true)
        throw new Error("Não foi possível concluir a autorização bancária.");

      await supabase.from("bank_connection_events").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "authorize",
        actor_id: userId,
        payload: { scope: tokens.scope, external_account_id: tokens.external_account_id },
      });

      return { ok: true, connection_id: conn.id };
    } catch {
      throw new Error("Autorização bancária não concluída. Reinicie a conexão.");
    }
  });

// -------------------------------------------------------------------
// DISCONNECT
// -------------------------------------------------------------------
export const disconnectBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string }) =>
    z.object({ connection_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "connect", true);

    const { data: conn } = await supabase
      .from("bank_connections")
      .select("id, provider, mode")
      .eq("id", data.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!conn) throw new Error("Conexão não encontrada");

    const { data: activeToken } = await supabase
      .from("bank_connection_tokens")
      .select("access_token, refresh_token")
      .eq("connection_id", conn.id)
      .is("rotated_at", null)
      .maybeSingle();

    try {
      if (activeToken) {
        const { resolveBankProvider } = await import("./banking/providers");
        const provider = resolveBankProvider(conn.provider, conn.mode);
        await provider.revoke({
          access_token: await openBankToken(activeToken.access_token),
          refresh_token: activeToken.refresh_token
            ? await openBankToken(activeToken.refresh_token)
            : null,
        });
      }
    } catch {
      // ignora falha de revoke — seguimos com desconexão local
    }

    await financeRpc(supabase, "banking_disconnect", {
      _id: conn.id,
      _workspace: workspaceId,
      _actor: userId,
    });

    return { ok: true };
  });

// -------------------------------------------------------------------
// Helper: obtém token ativo (Fase 2 ainda sem refresh automático)
// -------------------------------------------------------------------
async function getActiveToken(supabase: any, connectionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("bank_connection_tokens")
    .select("access_token,expires_at")
    .eq("connection_id", connectionId)
    .is("rotated_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem token ativo — reautorize a conexão");
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())
    throw new Error("Credencial expirada: reautorize a conexão.");
  return openBankToken(data.access_token);
}

// -------------------------------------------------------------------
// SYNC statement (saldo + extrato)
// -------------------------------------------------------------------
export const syncBankStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string; from?: string; to?: string }) =>
    z
      .object({
        connection_id: z.string().uuid(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "sync", true);

    const { data: conn, error: cErr } = await supabase
      .from("bank_connections")
      .select("id, provider, mode, status, last_statement_sync_at, external_account_id")
      .eq("id", data.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn) throw new Error("Conexão não encontrada");
    if (conn.status !== "connected") throw new Error("Conexão inativa — reautorize");

    const to = data.to ?? new Date().toISOString();
    const from =
      data.from ??
      conn.last_statement_sync_at ??
      new Date(Date.now() - 30 * 86_400_000).toISOString();

    const accessToken = await getActiveToken(supabase, conn.id);
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);

    try {
      const [{ balance }, statement] = await Promise.all([
        provider.fetchBalance({ access_token: accessToken }),
        provider.fetchStatement({ access_token: accessToken, from, to }),
      ]);

      // resolve conta interna vinculada (se houver)
      const { data: linkedAccount } = await supabase
        .from("financial_bank_accounts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("bank_connection_id", conn.id)
        .maybeSingle();

      const rows = statement.transactions.map((t) => ({
        workspace_id: workspaceId,
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

      let inserted = 0;
      if (rows.length) {
        const { error: upErr, count } = await supabase
          .from("bank_statement_transactions")
          .upsert(rows, { onConflict: "connection_id,external_id", count: "exact" });
        if (upErr) throw new Error(upErr.message);
        inserted = count ?? rows.length;
      }

      const now = new Date().toISOString();
      await supabase
        .from("bank_connections")
        .update({
          current_balance: balance,
          balance_synced_at: now,
          last_statement_sync_at: now,
          last_sync_at: now,
          last_error: null,
        })
        .eq("id", conn.id);

      await supabase.from("bank_connection_events").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "sync",
        actor_id: userId,
        payload: { from, to, count: rows.length, balance },
      });

      return { ok: true, count: rows.length, inserted, balance };
    } catch (e) {
      const msg = "Falha na operação bancária. Consulte a conexão.";
      await supabase.from("bank_connections").update({ last_error: msg }).eq("id", conn.id);
      await supabase.from("bank_connection_events").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "error",
        actor_id: userId,
        payload: { stage: "sync_statement", message: msg },
      });
      throw e;
    }
  });

// -------------------------------------------------------------------
// LIST statement transactions (extrato paginado)
// -------------------------------------------------------------------
export const listBankStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      connection_id: string;
      from?: string;
      to?: string;
      status?: "pending" | "matched" | "ignored" | "all";
      limit?: number;
    }) =>
      z
        .object({
          connection_id: z.string().uuid(),
          from: z.string().optional(),
          to: z.string().optional(),
          status: z.enum(["pending", "matched", "ignored", "all"]).default("all"),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    let q = supabase
      .from("bank_statement_transactions")
      .select(
        "id, posted_at, amount, direction, description, counterparty, category, balance_after, reconciliation_status, matched_payment_id",
      )
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .order("posted_at", { ascending: false })
      .limit(data.limit);

    if (data.from) q = q.gte("posted_at", data.from);
    if (data.to) q = q.lte("posted_at", data.to);
    if (data.status !== "all") q = q.eq("reconciliation_status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------------------------------------------------------------------
// UPDATE reconciliation status (marcar como ignorado / manual)
// -------------------------------------------------------------------
export const setStatementReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      transaction_id: string;
      status: "pending" | "matched" | "ignored";
      matched_payment_id?: string | null;
    }) =>
      z
        .object({
          transaction_id: z.string().uuid(),
          status: z.enum(["pending", "matched", "ignored"]),
          matched_payment_id: z.string().uuid().nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "reconcile", false);

    const { data: updated, error } = await supabase
      .from("bank_statement_transactions")
      .update({
        reconciliation_status: data.status,
        matched_payment_id: data.matched_payment_id ?? null,
      })
      .eq("id", data.transaction_id)
      .eq("workspace_id", workspaceId)
      .select("id")
      .maybeSingle();
    if (error || !updated)
      throw new Error("Transação indisponível ou sem permissão para conciliar.");
    return { ok: true };
  });

// -------------------------------------------------------------------
// SUGGEST reconciliation matches
// Para cada transação (padrão: pendentes), busca financial_payments
// com mesmo valor absoluto e paid_at dentro de ±windowDays de posted_at.
// -------------------------------------------------------------------
export const suggestReconciliationMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string; window_days?: number; limit?: number }) =>
    z
      .object({
        connection_id: z.string().uuid(),
        window_days: z.number().int().min(0).max(30).default(5),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    const { data: txs, error: tErr } = await supabase
      .from("bank_statement_transactions")
      .select("id, posted_at, amount, direction, description, counterparty")
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .eq("reconciliation_status", "pending")
      .order("posted_at", { ascending: false })
      .limit(data.limit);
    if (tErr) throw new Error(tErr.message);
    const txList = txs ?? [];
    if (txList.length === 0) return { items: [] };

    // Janela global para reduzir consultas: min-max posted_at ± window_days
    const dates = txList.map((t: any) => new Date(t.posted_at).getTime());
    const minMs = Math.min(...dates) - data.window_days * 86400000;
    const maxMs = Math.max(...dates) + data.window_days * 86400000;
    const fromIso = new Date(minMs).toISOString().slice(0, 10);
    const toIso = new Date(maxMs).toISOString().slice(0, 10);

    // Já usados em matches vigentes — excluir
    const { data: usedRows } = await supabase
      .from("bank_statement_transactions")
      .select("matched_payment_id")
      .eq("workspace_id", workspaceId)
      .eq("reconciliation_status", "matched")
      .not("matched_payment_id", "is", null);
    const usedIds = new Set((usedRows ?? []).map((r: any) => r.matched_payment_id).filter(Boolean));

    const { data: pays, error: pErr } = await supabase
      .from("financial_payments")
      .select("id, entry_id, paid_at, amount, method, reference, notes")
      .eq("workspace_id", workspaceId)
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso);
    if (pErr) throw new Error(pErr.message);
    const payments = (pays ?? []).filter((p: any) => !usedIds.has(p.id));

    const windowMs = data.window_days * 86400000;
    const items = txList.map((t: any) => {
      const postedMs = new Date(t.posted_at).getTime();
      const amt = Math.abs(Number(t.amount));
      const candidates = payments
        .map((p: any) => {
          const payMs = new Date(p.paid_at).getTime();
          const diff = Math.abs(payMs - postedMs);
          const amountOk = Math.abs(Math.abs(Number(p.amount)) - amt) < 0.01;
          return { p, diff, amountOk };
        })
        .filter((c: any) => c.amountOk && c.diff <= windowMs)
        .sort((a: any, b: any) => a.diff - b.diff)
        .slice(0, 3)
        .map((c: any) => ({
          payment_id: c.p.id,
          entry_id: c.p.entry_id,
          paid_at: c.p.paid_at,
          amount: c.p.amount,
          method: c.p.method,
          reference: c.p.reference,
          notes: c.p.notes,
          days_diff: Math.round(c.diff / 86400000),
        }));
      return { transaction: t, candidates };
    });

    return { items };
  });

// -------------------------------------------------------------------
// LIST reconciliation history (matched + ignored)
// -------------------------------------------------------------------
export const listReconciliationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { connection_id: string; status?: "matched" | "ignored" | "all"; limit?: number }) =>
      z
        .object({
          connection_id: z.string().uuid(),
          status: z.enum(["matched", "ignored", "all"]).default("all"),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    const q = supabase
      .from("bank_statement_transactions")
      .select(
        "id, posted_at, amount, direction, description, counterparty, reconciliation_status, matched_payment_id, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .in("reconciliation_status", data.status === "all" ? ["matched", "ignored"] : [data.status])
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const paymentIds = (rows ?? []).map((r: any) => r.matched_payment_id).filter(Boolean);
    let paymentsById: Record<string, any> = {};
    if (paymentIds.length) {
      const { data: pays } = await supabase
        .from("financial_payments")
        .select("id, paid_at, amount, method, reference")
        .in("id", paymentIds);
      paymentsById = Object.fromEntries((pays ?? []).map((p: any) => [p.id, p]));
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      matched_payment: r.matched_payment_id ? (paymentsById[r.matched_payment_id] ?? null) : null,
    }));
  });

// -------------------------------------------------------------------
// Sprint H — Fase 3: Conciliação bancária em massa
// -------------------------------------------------------------------

export const bulkIgnoreTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transaction_ids: string[] }) =>
    z
      .object({
        transaction_ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "reconcile", false);

    const { error, count } = await supabase
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "ignored", matched_payment_id: null }, { count: "exact" })
      .in("id", data.transaction_ids)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true, updated: count ?? 0 };
  });

export const bulkLinkBestMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { connection_id: string; window_days?: number; transaction_ids?: string[] }) =>
      z
        .object({
          connection_id: z.string().uuid(),
          window_days: z.number().int().min(0).max(30).default(5),
          transaction_ids: z.array(z.string().uuid()).max(500).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "reconcile", false);

    let txQ = supabase
      .from("bank_statement_transactions")
      .select("id, posted_at, amount, direction")
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .eq("reconciliation_status", "pending");
    if (data.transaction_ids && data.transaction_ids.length > 0) {
      txQ = txQ.in("id", data.transaction_ids);
    }
    const { data: txs, error: tErr } = await txQ.limit(500);
    if (tErr) throw new Error(tErr.message);
    const txList = txs ?? [];
    if (txList.length === 0) return { ok: true, linked: 0, skipped: 0 };

    const dates = txList.map((t: any) => new Date(t.posted_at).getTime());
    const minMs = Math.min(...dates) - data.window_days * 86400000;
    const maxMs = Math.max(...dates) + data.window_days * 86400000;
    const fromIso = new Date(minMs).toISOString().slice(0, 10);
    const toIso = new Date(maxMs).toISOString().slice(0, 10);

    const { data: usedRows } = await supabase
      .from("bank_statement_transactions")
      .select("matched_payment_id")
      .eq("workspace_id", workspaceId)
      .eq("reconciliation_status", "matched")
      .not("matched_payment_id", "is", null);
    const used = new Set((usedRows ?? []).map((r: any) => r.matched_payment_id).filter(Boolean));

    const { data: pays, error: pErr } = await supabase
      .from("financial_payments")
      .select("id, paid_at, amount")
      .eq("workspace_id", workspaceId)
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso);
    if (pErr) throw new Error(pErr.message);
    const payments = (pays ?? []).filter((p: any) => !used.has(p.id));

    const windowMs = data.window_days * 86400000;
    let linked = 0;
    let skipped = 0;
    for (const t of txList) {
      const postedMs = new Date(t.posted_at).getTime();
      const amt = Math.abs(Number(t.amount));
      const best = payments
        .map((p: any) => {
          const diff = Math.abs(new Date(p.paid_at).getTime() - postedMs);
          const amountOk = Math.abs(Math.abs(Number(p.amount)) - amt) < 0.01;
          return { p, diff, amountOk };
        })
        .filter((c: any) => c.amountOk && c.diff <= windowMs)
        .sort((a: any, b: any) => a.diff - b.diff)[0];
      if (!best) {
        skipped++;
        continue;
      }
      const { error: uErr } = await supabase
        .from("bank_statement_transactions")
        .update({
          reconciliation_status: "matched",
          matched_payment_id: best.p.id,
        })
        .eq("id", t.id)
        .eq("workspace_id", workspaceId);
      if (uErr) {
        skipped++;
        continue;
      }
      used.add(best.p.id);
      const idx = payments.findIndex((p: any) => p.id === best.p.id);
      if (idx >= 0) payments.splice(idx, 1);
      linked++;
    }
    return { ok: true, linked, skipped };
  });

export const bulkCreateEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      transaction_ids: string[];
      category_id?: string | null;
      bank_account_id?: string | null;
    }) =>
      z
        .object({
          transaction_ids: z.array(z.string().uuid()).min(1).max(200),
          category_id: z.string().uuid().nullable().optional(),
          bank_account_id: z.string().uuid().nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "reconcile", false);

    let created = 0;
    const errors: string[] = [];
    for (const id of data.transaction_ids) {
      try {
        const result = await financeRpc<{ created: boolean }>(
          supabase,
          "finance_reconcile_transaction",
          {
            _transaction: id,
            _category: data.category_id ?? null,
            _bank: data.bank_account_id ?? null,
          },
        );
        if (result.created) created++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Falha ao conciliar transação.");
      }
    }

    return { ok: true, created, errors };
  });

// -------------------------------------------------------------------
// Sprint G — Fase 4: Cobranças (Pix + Boleto)
// -------------------------------------------------------------------

export const listBankCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string; status?: string; limit?: number }) =>
    z
      .object({
        connection_id: z.string().uuid(),
        status: z.enum(["pending", "paid", "canceled", "expired", "all"]).default("all"),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    let q = supabase
      .from("bank_charges")
      .select(
        "id, type, amount, due_date, status, payer_name, payer_document, description, pix_qr_code, pix_copy_paste, boleto_barcode, boleto_digitable_line, boleto_url, external_id, paid_at, canceled_at, financial_entry_id, created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBankCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      connection_id: string;
      type: "pix" | "boleto";
      amount: number;
      due_date: string;
      description?: string | null;
      payer_name?: string | null;
      payer_document?: string | null;
      financial_entry_id?: string | null;
    }) =>
      z
        .object({
          connection_id: z.string().uuid(),
          type: z.enum(["pix", "boleto"]),
          amount: z.number().finite().positive(),
          due_date: z.string().date(),
          description: z.string().max(500).nullable().optional(),
          payer_name: z.string().max(200).nullable().optional(),
          payer_document: z.string().max(32).nullable().optional(),
          financial_entry_id: z.string().uuid().nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "create_charge", true);

    await validateBankEntry(
      caller,
      workspaceId,
      data.financial_entry_id,
      "receivable",
      data.amount,
    );
    const { data: conn, error: cErr } = await supabase
      .from("bank_connections")
      .select("id, provider, mode, status")
      .eq("id", data.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn) throw new Error("Conexão não encontrada");
    if (conn.status !== "connected") throw new Error("Conexão inativa — reautorize");

    const accessToken = await getActiveToken(supabase, conn.id);
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);
    const fn = data.type === "pix" ? provider.createPixCharge : provider.createBoletoCharge;
    if (!fn) throw new Error(`Provider não suporta ${data.type}`);

    const { data: inserted, error: iErr } = await supabase
      .from("bank_charges")
      .insert({
        workspace_id: workspaceId,
        connection_id: conn.id,
        financial_entry_id: data.financial_entry_id ?? null,
        type: data.type,
        amount: data.amount,
        due_date: data.due_date,
        description: data.description ?? null,
        payer_name: data.payer_name ?? null,
        payer_document: data.payer_document ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    try {
      const res = await fn.call(provider, {
        access_token: accessToken,
        charge_id: inserted.id,
        amount: data.amount,
        due_date: data.due_date,
        description: data.description ?? null,
        payer_name: data.payer_name ?? null,
        payer_document: data.payer_document ?? null,
      });

      const { error: uErr } = await supabase
        .from("bank_charges")
        .update({
          external_id: res.external_id,
          pix_qr_code: res.pix_qr_code,
          pix_copy_paste: res.pix_copy_paste,
          boleto_barcode: res.boleto_barcode,
          boleto_digitable_line: res.boleto_digitable_line,
          boleto_url: res.boleto_url,
          metadata: (res.raw ?? {}) as any,
        })
        .eq("id", inserted.id);
      if (uErr) throw new Error(uErr.message);

      return { ok: true, charge_id: inserted.id };
    } catch {
      // Preserve the source id after an uncertain external result. No blind retry.
      await supabase
        .from("bank_charges")
        .update({ metadata: { issuance_unconfirmed: true } })
        .eq("id", inserted.id)
        .eq("workspace_id", workspaceId);
      throw new Error("Emissão não confirmada. Consulte a cobrança antes de emitir novamente.");
    }
  });

export const cancelBankCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { charge_id: string }) =>
    z.object({ charge_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "cancel_charge", true);

    const { data: charge } = await supabase
      .from("bank_charges")
      .select("id,status,connection_id,external_id")
      .eq("id", data.charge_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (!charge || charge.status !== "pending" || !charge.external_id)
      throw new Error("Cobrança pendente indisponível.");
    const { data: conn } = await supabase
      .from("bank_connections")
      .select("id,provider,mode,status")
      .eq("id", charge.connection_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (!conn || conn.status !== "connected") throw new Error("Conexão inativa.");
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);
    if (!provider.cancelCharge)
      throw new Error("O provedor não suporta cancelamento. Nenhuma alteração foi feita.");
    const token = await getActiveToken(supabase, conn.id);
    await provider.cancelCharge({ access_token: token, external_id: charge.external_id });
    return financeRpc<{ ok: boolean; payment_id?: string; already?: boolean }>(
      supabase,
      "banking_apply_event",
      {
        _kind: "charge",
        _id: charge.id,
        _status: "canceled",
        _external: charge.external_id,
        _actor: userId,
      },
    );
  });

export const simulateChargePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { charge_id: string }) =>
    z.object({ charge_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { internalMocksEnabled } = await import("./runtime-config.server");
    if (!internalMocksEnabled()) {
      throw new Error("A simulação bancária está desativada neste ambiente.");
    }
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "simulate", false);
    const { data: charge } = await caller
      .from("bank_charges")
      .select("id,connection_id")
      .eq("workspace_id", workspaceId)
      .eq("id", data.charge_id)
      .single();
    const { data: conn } = await caller
      .from("bank_connections")
      .select("mode")
      .eq("id", charge?.connection_id ?? "")
      .eq("workspace_id", workspaceId)
      .single();
    if (!charge || conn?.mode !== "mock")
      throw new Error("Somente cobranças de simulação podem ser liquidadas manualmente.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return financeRpc<{ ok: boolean; payment_id?: string; already?: boolean }>(
      supabaseAdmin,
      "banking_apply_event",
      { _kind: "charge", _id: charge.id, _status: "paid", _actor: userId },
    );
  });

// -------------------------------------------------------------------
// Sprint G — Fase 5: Pagamentos a fornecedores (AP)
// -------------------------------------------------------------------

export const listBankPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string; status?: string; limit?: number }) =>
    z
      .object({
        connection_id: z.string().uuid(),
        status: z
          .enum(["draft", "approved", "processing", "paid", "failed", "canceled", "all"])
          .default("all"),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    let q = supabase
      .from("bank_payments")
      .select(
        "id, type, amount, scheduled_for, status, favored_name, favored_document, pix_key, pix_key_type, boleto_digitable_line, description, external_id, paid_at, failure_reason, financial_entry_id, approved_at, created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      connection_id: string;
      type: "pix" | "ted" | "boleto";
      amount: number;
      scheduled_for?: string | null;
      favored_name?: string | null;
      favored_document?: string | null;
      pix_key?: string | null;
      pix_key_type?: "cpf" | "cnpj" | "email" | "phone" | "random" | null;
      boleto_barcode?: string | null;
      boleto_digitable_line?: string | null;
      description?: string | null;
      financial_entry_id?: string | null;
    }) =>
      z
        .object({
          connection_id: z.string().uuid(),
          type: z.enum(["pix", "ted", "boleto"]),
          amount: z.number().finite().positive(),
          scheduled_for: z.string().nullable().optional(),
          favored_name: z.string().max(200).nullable().optional(),
          favored_document: z.string().max(32).nullable().optional(),
          pix_key: z.string().max(200).nullable().optional(),
          pix_key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]).nullable().optional(),
          boleto_barcode: z.string().max(64).nullable().optional(),
          boleto_digitable_line: z.string().max(64).nullable().optional(),
          description: z.string().max(500).nullable().optional(),
          financial_entry_id: z.string().uuid().nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "create_payment", false);

    if (data.type === "pix" && data.pix_key_type === "email") {
      data.pix_key = normalizeEmailAddress(data.pix_key);
    }
    if (data.type === "pix" && (!data.pix_key || !data.pix_key_type)) {
      throw new Error("Chave Pix e tipo de chave são obrigatórios para pagamentos Pix");
    }
    if (data.type === "boleto" && !data.boleto_barcode && !data.boleto_digitable_line) {
      throw new Error("Código de barras ou linha digitável obrigatórios para boleto");
    }

    const paymentId = await financeRpc<string>(caller, "banking_create_payment", { _data: data });
    return { ok: true, payment_id: paymentId };
  });

export const approveBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await financeRpc<any>(context.supabase, "banking_payment_transition", {
      _id: data.payment_id,
      _action: "approve",
    });
    return { ok: true, status: result.status };
  });

export const executeBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "execute", true);
    // Resolve provider/token before claiming; then exactly one caller can claim approved -> processing.
    const { data: preview, error } = await caller
      .from("bank_payments")
      .select("connection_id")
      .eq("workspace_id", workspaceId)
      .eq("id", data.payment_id)
      .single();
    if (error || !preview) throw new Error("Pagamento indisponível.");
    const { data: conn } = await supabase
      .from("bank_connections")
      .select("id,provider,mode,status")
      .eq("id", preview.connection_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (!conn || conn.status !== "connected") throw new Error("Conexão inativa.");
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);
    const accessToken = await getActiveToken(supabase, conn.id);
    const p = await financeRpc<any>(caller, "banking_payment_transition", {
      _id: data.payment_id,
      _action: "execute",
    });
    // Keep processing after uncertain provider errors. Never retry a possible debit blindly.
    try {
      const result =
        p.type === "pix"
          ? await provider.createPixPayment!({
              access_token: accessToken,
              payment_id: p.id,
              amount: Number(p.amount),
              favored_name: p.favored_name ?? "",
              favored_document: p.favored_document ?? "",
              pix_key: p.pix_key ?? "",
              pix_key_type: p.pix_key_type ?? "random",
              description: p.description,
            })
          : await provider.createBoletoPayment!({
              access_token: accessToken,
              payment_id: p.id,
              amount: Number(p.amount),
              barcode: p.boleto_barcode ?? p.boleto_digitable_line ?? "",
              favored_name: p.favored_name,
              description: p.description,
            });
      const { error: savedError } = await supabase
        .from("bank_payments")
        .update({
          external_id: result.external_id,
          metadata: { ...p.metadata, provider_result: result.raw ?? {} },
        })
        .eq("id", p.id)
        .eq("workspace_id", workspaceId)
        .eq("status", "processing");
      if (savedError) throw new Error("Falha ao registrar resposta bancária.");
      if (result.status !== "processing")
        await financeRpc(supabase, "banking_apply_event", {
          _kind: "payment",
          _id: p.id,
          _status: result.status,
          _external: result.external_id,
          _reason: result.failure_reason ?? null,
          _actor: context.userId,
        });
      return { ok: true, status: result.status, external_id: result.external_id };
    } catch {
      throw new Error(
        "Execução com resultado não confirmado. Consulte o status antes de qualquer nova tentativa.",
      );
    }
  });

export const cancelBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "cancel_payment", false);

    await financeRpc(caller, "banking_payment_transition", {
      _id: data.payment_id,
      _action: "cancel_payment",
    });
    return { ok: true };
  });

export const simulatePaymentSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { internalMocksEnabled } = await import("./runtime-config.server");
    if (!internalMocksEnabled()) {
      throw new Error("A simulação bancária está desativada neste ambiente.");
    }
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "simulate", false);

    const { data: p } = await caller
      .from("bank_payments")
      .select("id,connection_id")
      .eq("workspace_id", workspaceId)
      .eq("id", data.payment_id)
      .single();
    const { data: conn } = await caller
      .from("bank_connections")
      .select("mode")
      .eq("id", p?.connection_id ?? "")
      .eq("workspace_id", workspaceId)
      .single();
    if (!p || conn?.mode !== "mock")
      throw new Error("Somente pagamentos de simulação podem ser liquidados manualmente.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return financeRpc<{ ok: boolean; payment_id?: string; already?: boolean }>(
      supabaseAdmin,
      "banking_apply_event",
      { _kind: "payment", _id: p.id, _status: "paid", _actor: userId },
    );
  });

// -------------------------------------------------------------------
// KPIs: resumo de pagamentos (a pagar hoje / próximos 7 dias / atrasados)
// -------------------------------------------------------------------
export const getPaymentsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { connection_id: string }) =>
    z.object({ connection_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("bank_payments")
      .select("amount, scheduled_for, status")
      .eq("workspace_id", workspaceId)
      .eq("connection_id", data.connection_id)
      .in("status", ["draft", "approved", "processing"]);
    if (error) throw new Error(error.message);

    let dueToday = 0;
    let next7 = 0;
    let overdue = 0;
    (rows ?? []).forEach((r: any) => {
      const s = r.scheduled_for as string | null;
      const amt = Number(r.amount);
      if (!s) return;
      if (s < today) overdue += amt;
      else if (s === today) dueToday += amt;
      else if (s <= in7) next7 += amt;
    });
    return { due_today: dueToday, next_7_days: next7, overdue };
  });

// -------------------------------------------------------------------
// GET banking health (Fase 6 — observabilidade)
// -------------------------------------------------------------------
export const getBankingHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider?: string }) =>
    z.object({ provider: z.string().default("inter") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase: caller, userId } = context;
    const { supabase, workspaceId } = await bankingContext(caller, "view", false);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: conn } = await admin
      .from("bank_connections")
      .select("id, status, last_sync_at, last_error")
      .eq("workspace_id", workspaceId)
      .eq("provider", data.provider)
      .maybeSingle();

    // Global cron logs are platform diagnostics, not tenant banking data.
    const lastRun = null;
    const runsOk = null;
    const runsFailed = null;
    const { data: alerts } = await admin
      .from("platform_alert_events")
      .select("id, severity, message, context, fired_at")
      .is("resolved_at", null)
      .contains("context", { workspace_id: workspaceId })
      .order("fired_at", { ascending: false })
      .limit(10);

    let stuckPayments = 0;
    let tokenExpiresAt: string | null = null;
    let tokenExpiresSoon = false;
    let tokenHasRefresh = true;
    if (conn?.id) {
      const cutoff6h = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { count } = await admin
        .from("bank_payments")
        .select("id", { count: "exact", head: true })
        .eq("connection_id", conn.id)
        .eq("status", "processing")
        .lt("approved_at", cutoff6h);
      stuckPayments = count ?? 0;

      const { data: tk } = await admin
        .from("bank_connection_tokens")
        .select("expires_at, refresh_token")
        .eq("connection_id", conn.id)
        .is("rotated_at", null)
        .maybeSingle();
      if (tk?.expires_at) {
        tokenExpiresAt = tk.expires_at;
        tokenExpiresSoon = new Date(tk.expires_at).getTime() - Date.now() < 24 * 3600 * 1000;
        tokenHasRefresh = !!tk.refresh_token;
      }
    }

    return {
      connection_status: conn?.status ?? "disconnected",
      last_sync_at: conn?.last_sync_at ?? null,
      last_error: conn?.last_error ?? null,
      last_run: lastRun ?? null,
      runs_ok: runsOk,
      runs_failed: runsFailed,
      alerts: alerts ?? [],
      stuck_payments: stuckPayments,
      token_expires_at: tokenExpiresAt,
      token_expires_soon: tokenExpiresSoon,
      token_has_refresh: tokenHasRefresh,
    };
  });
