// Sprint G — Fase 1: fluxo OAuth Open Finance (provider abstrato).
// Estado persiste por workspace em `bank_connections`. Tokens ficam em
// `bank_connection_tokens` (RLS admin-only). Trilha em `bank_connection_events`.
//
// Todas as fns exigem admin do workspace (RLS gate, reforçado no handler).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getCurrentWorkspace(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_workspaces");
  if (error) throw new Error(error.message);
  const list = (data as string[] | null) ?? [];
  if (list.length === 0) throw new Error("Usuário sem workspace ativo");
  return list[0];
}

async function assertAdmin(supabase: any, workspaceId: string, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace_id: workspaceId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Somente administradores podem gerenciar conexões bancárias");
}

// -------------------------------------------------------------------
// GET status
// -------------------------------------------------------------------
export const getBankConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider?: string }) =>
    z.object({ provider: z.string().default("inter") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);

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

    return {
      connection: conn,
      events: events ?? [],
      workspaceId,
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
        metadata: { pending_state: init.state, pending_at: new Date().toISOString() },
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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

      // aposenta tokens antigos
      await supabase
        .from("bank_connection_tokens")
        .update({ rotated_at: new Date().toISOString() })
        .eq("connection_id", conn.id)
        .is("rotated_at", null);

      const { error: tErr } = await supabase.from("bank_connection_tokens").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        scope: tokens.scope,
        expires_at: expiresAt,
      });
      if (tErr) throw new Error(tErr.message);

      const { error: uErr } = await supabase
        .from("bank_connections")
        .update({
          status: "connected",
          display_name: tokens.display_name ?? "Banco Inter",
          external_account_id: tokens.external_account_id ?? null,
          last_error: null,
          last_sync_at: new Date().toISOString(),
          metadata: { connected_at: new Date().toISOString() },
        })
        .eq("id", conn.id);
      if (uErr) throw new Error(uErr.message);

      await supabase.from("bank_connection_events").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "authorize",
        actor_id: userId,
        payload: { scope: tokens.scope, external_account_id: tokens.external_account_id },
      });

      return { ok: true, connection_id: conn.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("bank_connections")
        .update({ status: "error", last_error: msg })
        .eq("id", conn.id);
      await supabase.from("bank_connection_events").insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "error",
        actor_id: userId,
        payload: { stage: "exchange_code", message: msg },
      });
      throw e;
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
          access_token: activeToken.access_token,
          refresh_token: activeToken.refresh_token,
        });
      }
    } catch {
      // ignora falha de revoke — seguimos com desconexão local
    }

    await supabase
      .from("bank_connection_tokens")
      .update({ rotated_at: new Date().toISOString() })
      .eq("connection_id", conn.id)
      .is("rotated_at", null);

    await supabase
      .from("bank_connections")
      .update({
        status: "disconnected",
        display_name: null,
        external_account_id: null,
        last_sync_at: null,
        last_error: null,
        metadata: {},
      })
      .eq("id", conn.id);

    await supabase.from("bank_connection_events").insert({
      connection_id: conn.id,
      workspace_id: workspaceId,
      event_type: "disconnect",
      actor_id: userId,
      payload: {},
    });

    return { ok: true };
  });

// -------------------------------------------------------------------
// Helper: obtém token ativo (Fase 2 ainda sem refresh automático)
// -------------------------------------------------------------------
async function getActiveToken(supabase: any, connectionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("bank_connection_tokens")
    .select("access_token")
    .eq("connection_id", connectionId)
    .is("rotated_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem token ativo — reautorize a conexão");
  return data.access_token as string;
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
      const msg = e instanceof Error ? e.message : String(e);
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { error } = await supabase
      .from("bank_statement_transactions")
      .update({
        reconciliation_status: data.status,
        matched_payment_id: data.matched_payment_id ?? null,
      })
      .eq("id", data.transaction_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { data: txs, error: tErr } = await supabase
      .from("bank_statement_transactions")
      .select("id, posted_at, amount, direction, description, counterparty")
      .in("id", data.transaction_ids)
      .eq("workspace_id", workspaceId)
      .eq("reconciliation_status", "pending");
    if (tErr) throw new Error(tErr.message);
    const txList = txs ?? [];

    let created = 0;
    const errors: string[] = [];
    for (const t of txList) {
      const amount = Math.abs(Number(t.amount));
      const dir = t.direction === "credit" ? "receivable" : "payable";
      const dateIso = new Date(t.posted_at).toISOString().slice(0, 10);
      const description =
        (t.description && String(t.description).trim()) ||
        (t.counterparty && String(t.counterparty).trim()) ||
        "Movimentação bancária";

      const { data: entry, error: eErr } = await supabase
        .from("financial_entries")
        .insert({
          workspace_id: workspaceId,
          owner_id: userId,
          direction: dir,
          origin_type: "manual",
          description,
          amount,
          currency: "BRL",
          competence_date: dateIso,
          due_date: dateIso,
          paid_amount: amount,
          status: "paid",
          category_id: data.category_id ?? null,
          external_ref: `bank_tx:${t.id}`,
        })
        .select("id")
        .single();
      if (eErr || !entry) {
        errors.push(eErr?.message ?? "Falha ao criar lançamento");
        continue;
      }

      const { data: pay, error: pErr } = await supabase
        .from("financial_payments")
        .insert({
          workspace_id: workspaceId,
          entry_id: entry.id,
          bank_account_id: data.bank_account_id ?? null,
          paid_at: dateIso,
          amount,
          method: "bank",
          reference: description.slice(0, 120),
          created_by: userId,
        })
        .select("id")
        .single();
      if (pErr || !pay) {
        errors.push(pErr?.message ?? "Falha ao registrar pagamento");
        continue;
      }

      const { error: uErr } = await supabase
        .from("bank_statement_transactions")
        .update({
          reconciliation_status: "matched",
          matched_payment_id: pay.id,
        })
        .eq("id", t.id)
        .eq("workspace_id", workspaceId);
      if (uErr) {
        errors.push(uErr.message);
        continue;
      }
      created++;
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
          amount: z.number().positive(),
          due_date: z.string().min(10),
          description: z.string().max(500).nullable().optional(),
          payer_name: z.string().max(200).nullable().optional(),
          payer_document: z.string().max(32).nullable().optional(),
          financial_entry_id: z.string().uuid().nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { data: conn, error: cErr } = await supabase
      .from("bank_connections")
      .select("id, provider, mode, status")
      .eq("id", data.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn) throw new Error("Conexão não encontrada");
    if (conn.status !== "connected") throw new Error("Conexão inativa — reautorize");

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

    const accessToken = await getActiveToken(supabase, conn.id);
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);
    const fn = data.type === "pix" ? provider.createPixCharge : provider.createBoletoCharge;
    if (!fn) throw new Error(`Provider não suporta ${data.type}`);

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
    } catch (e) {
      await supabase.from("bank_charges").delete().eq("id", inserted.id);
      throw e;
    }
  });

export const cancelBankCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { charge_id: string }) =>
    z.object({ charge_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { data: charge } = await supabase
      .from("bank_charges")
      .select("id, status")
      .eq("id", data.charge_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada");
    if (charge.status !== "pending")
      throw new Error("Somente cobranças pendentes podem ser canceladas");

    const { error } = await supabase
      .from("bank_charges")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", data.charge_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Marca cobrança como paga e cria financial_payment + concilia extrato (idempotente por external_id).
async function settleChargePayment(
  supabase: any,
  workspaceId: string,
  chargeId: string,
  paidAtIso: string,
  actorId: string | null,
) {
  const { data: charge, error } = await supabase
    .from("bank_charges")
    .select("id, connection_id, financial_entry_id, amount, type, status, external_id, description")
    .eq("id", chargeId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!charge) throw new Error("Cobrança não encontrada");
  if (charge.status === "paid") return { ok: true, already: true };
  if (charge.status !== "pending") throw new Error(`Cobrança em status ${charge.status}`);

  const paidDate = paidAtIso.slice(0, 10);

  let paymentId: string | null = null;
  if (charge.financial_entry_id) {
    const { data: linkedAccount } = await supabase
      .from("financial_bank_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("bank_connection_id", charge.connection_id)
      .maybeSingle();

    const { data: pay, error: pErr } = await supabase
      .from("financial_payments")
      .insert({
        workspace_id: workspaceId,
        entry_id: charge.financial_entry_id,
        bank_account_id: linkedAccount?.id ?? null,
        paid_at: paidDate,
        amount: charge.amount,
        method: charge.type,
        reference: charge.external_id ?? charge.id,
        notes: `Liquidação automática — ${charge.type.toUpperCase()}`,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    paymentId = pay.id;

    const { data: entry } = await supabase
      .from("financial_entries")
      .select("amount, paid_amount, status")
      .eq("id", charge.financial_entry_id)
      .maybeSingle();
    if (entry) {
      const newPaid = Number(entry.paid_amount) + Number(charge.amount);
      const newStatus = newPaid + 0.001 >= Number(entry.amount) ? "paid" : "partially_paid";
      await supabase
        .from("financial_entries")
        .update({ paid_amount: newPaid, status: newStatus })
        .eq("id", charge.financial_entry_id);
    }
  }

  await supabase
    .from("bank_charges")
    .update({ status: "paid", paid_at: paidAtIso })
    .eq("id", chargeId);

  // tenta conciliar transação de extrato com mesmo external_id
  if (paymentId && charge.external_id) {
    await supabase
      .from("bank_statement_transactions")
      .update({ reconciliation_status: "matched", matched_payment_id: paymentId })
      .eq("workspace_id", workspaceId)
      .eq("connection_id", charge.connection_id)
      .eq("external_id", charge.external_id);
  }

  return { ok: true, payment_id: paymentId };
}

export const simulateChargePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { charge_id: string }) =>
    z.object({ charge_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);
    return settleChargePayment(
      supabase,
      workspaceId,
      data.charge_id,
      new Date().toISOString(),
      userId,
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
          amount: z.number().positive(),
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    if (data.type === "pix" && (!data.pix_key || !data.pix_key_type)) {
      throw new Error("Chave Pix e tipo de chave são obrigatórios para pagamentos Pix");
    }
    if (data.type === "boleto" && !data.boleto_barcode && !data.boleto_digitable_line) {
      throw new Error("Código de barras ou linha digitável obrigatórios para boleto");
    }

    const { data: inserted, error: iErr } = await supabase
      .from("bank_payments")
      .insert({
        workspace_id: workspaceId,
        connection_id: data.connection_id,
        financial_entry_id: data.financial_entry_id ?? null,
        type: data.type,
        amount: data.amount,
        scheduled_for: data.scheduled_for ?? null,
        status: "draft",
        favored_name: data.favored_name ?? null,
        favored_document: data.favored_document ?? null,
        pix_key: data.pix_key ?? null,
        pix_key_type: data.pix_key_type ?? null,
        boleto_barcode: data.boleto_barcode ?? null,
        boleto_digitable_line: data.boleto_digitable_line ?? null,
        description: data.description ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    await supabase.from("bank_connection_events").insert({
      connection_id: data.connection_id,
      workspace_id: workspaceId,
      event_type: "payment_created",
      actor_id: userId,
      payload: { payment_id: inserted.id, type: data.type, amount: data.amount },
    });

    return { ok: true, payment_id: inserted.id };
  });

export const approveBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { data: p, error: pErr } = await supabase
      .from("bank_payments")
      .select(
        "id, connection_id, type, amount, favored_name, favored_document, pix_key, pix_key_type, boleto_barcode, boleto_digitable_line, description, status, created_by",
      )
      .eq("id", data.payment_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!p) throw new Error("Pagamento não encontrado");
    if (p.status !== "draft")
      throw new Error(`Somente rascunhos podem ser aprovados (status: ${p.status})`);
    if (p.created_by && p.created_by === userId) {
      // Nota: dupla custódia opcional — permitir por enquanto, apenas registrar
    }

    const { data: conn, error: cErr } = await supabase
      .from("bank_connections")
      .select("id, provider, mode, status")
      .eq("id", p.connection_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!conn || conn.status !== "connected") throw new Error("Conexão inativa");

    const accessToken = await getActiveToken(supabase, conn.id);
    const { resolveBankProvider } = await import("./banking/providers");
    const provider = resolveBankProvider(conn.provider, conn.mode);

    let providerRes;
    try {
      if (p.type === "pix") {
        if (!provider.createPixPayment) throw new Error("Provider não suporta pagamento Pix");
        providerRes = await provider.createPixPayment({
          access_token: accessToken,
          payment_id: p.id,
          amount: Number(p.amount),
          favored_name: p.favored_name ?? "",
          favored_document: p.favored_document ?? "",
          pix_key: p.pix_key ?? "",
          pix_key_type: p.pix_key_type ?? "random",
          description: p.description,
        });
      } else if (p.type === "boleto") {
        if (!provider.createBoletoPayment) throw new Error("Provider não suporta pagamento boleto");
        providerRes = await provider.createBoletoPayment({
          access_token: accessToken,
          payment_id: p.id,
          amount: Number(p.amount),
          barcode: p.boleto_barcode ?? p.boleto_digitable_line ?? "",
          favored_name: p.favored_name,
          description: p.description,
        });
      } else {
        throw new Error("TED ainda não suportado no provider atual");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("bank_payments")
        .update({ status: "failed", failure_reason: msg })
        .eq("id", p.id);
      throw e;
    }

    const nextStatus =
      providerRes.status === "paid"
        ? "paid"
        : providerRes.status === "failed"
          ? "failed"
          : "processing";

    await supabase
      .from("bank_payments")
      .update({
        status: nextStatus,
        external_id: providerRes.external_id,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        failure_reason: providerRes.failure_reason ?? null,
        metadata: (providerRes.raw ?? {}) as any,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", p.id);

    await supabase.from("bank_connection_events").insert({
      connection_id: conn.id,
      workspace_id: workspaceId,
      event_type: "payment_approved",
      actor_id: userId,
      payload: { payment_id: p.id, external_id: providerRes.external_id, status: nextStatus },
    });

    return { ok: true, status: nextStatus, external_id: providerRes.external_id };
  });

export const cancelBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { data: p } = await supabase
      .from("bank_payments")
      .select("id, status")
      .eq("id", data.payment_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!p) throw new Error("Pagamento não encontrado");
    if (!["draft", "approved"].includes(p.status)) {
      throw new Error("Somente pagamentos em rascunho ou aprovados podem ser cancelados");
    }
    const { error } = await supabase
      .from("bank_payments")
      .update({ status: "canceled" })
      .eq("id", data.payment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const simulatePaymentSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payment_id: string }) =>
    z.object({ payment_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { settleBankPaymentAdmin } = await import("./banking/payments.server");
    // supabase (usuário admin) tem RLS admin_update — usar diretamente.
    return settleBankPaymentAdmin(supabase, data.payment_id, new Date().toISOString());
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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

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
    const { supabase, userId } = context;
    const workspaceId = await getCurrentWorkspace(supabase, userId);
    await assertAdmin(supabase, workspaceId, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: conn } = await admin
      .from("bank_connections")
      .select("id, status, last_sync_at, last_error")
      .eq("workspace_id", workspaceId)
      .eq("provider", data.provider)
      .maybeSingle();

    const { data: lastRun } = await admin
      .from("cron_run_logs")
      .select("job_name, started_at, finished_at, duration_ms, status, metrics, error")
      .eq("job_name", "banking-tick")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: recentRuns } = await admin
      .from("cron_run_logs")
      .select("status")
      .eq("job_name", "banking-tick")
      .order("started_at", { ascending: false })
      .limit(24);
    const runsOk = (recentRuns ?? []).filter((r: any) => r.status === "ok").length;
    const runsFailed = (recentRuns ?? []).filter((r: any) => r.status !== "ok").length;

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
