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
