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
        "id, provider, status, mode, display_name, scopes, external_account_id, last_sync_at, last_error, created_at, updated_at",
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
      await supabase
        .from("bank_connections")
        .update({ last_error: msg })
        .eq("id", conn.id);
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

