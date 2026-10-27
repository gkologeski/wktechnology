import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { authorizeCloudConnection, inspectCloudNumbers } from "./cloud-connections.server";

export const listCloudConnections = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.whatsapp", "view")])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await authorizeCloudConnection(context.supabase, workspaceId, "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const connections = await admin
      .from("wa_cloud_connections")
      .select(
        "id,label,waba_id,api_version,enabled,webhook_verified_at,webhook_received_at,synced_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at");
    if (connections.error) throw new Error("Não foi possível carregar as conexões Meta.");
    const numbers = await admin
      .from("wa_cloud_numbers")
      .select(
        "phone_number_id,connection_id,display_phone_number,verified_name,quality_rating,status,available",
      )
      .eq("workspace_id", workspaceId);
    if (numbers.error) throw new Error("Não foi possível carregar os números Meta.");
    return { connections: connections.data ?? [], numbers: numbers.data ?? [] };
  });

export const createCloudConnection = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.whatsapp", "manage")])
  .inputValidator((input) =>
    z
      .object({
        label: z.string().trim().min(1).max(120),
        wabaId: z.string().regex(/^\d{5,30}$/),
        apiVersion: z.string().regex(/^v\d{2}\.0$/),
        accessToken: z.string().trim().min(20).max(4096),
        appSecret: z.string().trim().min(16).max(256),
        verifyToken: z.string().trim().min(32).max(256),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await authorizeCloudConnection(context.supabase, workspaceId, "manage");
    const { encryptApiKey } = await import("@/lib/ai/provider-resolver.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Validate token access before persisting; never activate sending here.
    await inspectCloudNumbers(data, data.wabaId);
    const credentials = await encryptApiKey(
      JSON.stringify({
        accessToken: data.accessToken,
        appSecret: data.appSecret,
        verifyToken: data.verifyToken,
      }),
    );
    const { data: row, error } = await (supabaseAdmin as any)
      .from("wa_cloud_connections")
      .insert({
        workspace_id: workspaceId,
        label: data.label,
        waba_id: data.wabaId,
        api_version: data.apiVersion,
        credentials_ciphertext: credentials,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error)
      throw new Error(
        "Não foi possível cadastrar a conexão. Verifique se essa conta já foi cadastrada.",
      );
    return { id: row.id as string };
  });

export const syncCloudConnection = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.whatsapp", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await authorizeCloudConnection(context.supabase, workspaceId, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
    const admin = supabaseAdmin as any;
    const { data: connection, error } = await admin
      .from("wa_cloud_connections")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !connection) throw new Error("Conexão indisponível.");
    const secrets = JSON.parse(await decryptApiKey(connection.credentials_ciphertext));
    let numbers = await inspectCloudNumbers(
      { accessToken: secrets.accessToken, apiVersion: connection.api_version },
      connection.waba_id,
    );
    const { gatewayConfigured, getConnectedPhone } = await import("./gateway-channel.server");
    if (gatewayConfigured()) {
      const legacy = await getConnectedPhone();
      numbers = numbers.filter((number) => number.phone_number_id !== legacy.id);
    }
    const now = new Date().toISOString();
    // Transactional RPC prevents partial sync and cross-tenant number takeover.
    const result = await admin.rpc("wa_cloud_sync_numbers", {
      p_connection: data.id,
      p_workspace: workspaceId,
      p_numbers: numbers,
      p_synced_at: now,
    });
    if (result.error) throw new Error("Não foi possível sincronizar os números com segurança.");
    return { count: numbers.length };
  });

export const setCloudConnectionEnabled = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.whatsapp", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await authorizeCloudConnection(context.supabase, workspaceId, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any)
      .from("wa_cloud_connections")
      .update({ enabled: data.enabled })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (data.enabled)
      query = query
        .not("webhook_verified_at", "is", null)
        .not("webhook_received_at", "is", null)
        .not("synced_at", "is", null);
    const result = await query.select("id").single();
    if (result.error)
      throw new Error(
        "Antes de ativar, sincronize os números, verifique o webhook e receba um evento assinado da Meta.",
      );
    return { ok: true };
  });

export const subscribeCloudConnection = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.whatsapp", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await authorizeCloudConnection(context.supabase, workspaceId, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptApiKey } = await import("@/lib/ai/provider-resolver.server");
    const { cloudRequest } = await import("./cloud-api.server");
    const row = await (supabaseAdmin as any)
      .from("wa_cloud_connections")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .single();
    if (row.error || !row.data?.webhook_verified_at)
      throw new Error("Configure e verifique o endereço do webhook na Meta primeiro.");
    const secrets = JSON.parse(await decryptApiKey(row.data.credentials_ciphertext));
    const result = await cloudRequest(
      { accessToken: secrets.accessToken, apiVersion: row.data.api_version },
      row.data.waba_id,
      "subscribed_apps",
      { method: "POST" },
    );
    if (result?.success !== true) throw new Error("A Meta não confirmou a assinatura dos eventos.");
    return { ok: true };
  });

export const listCloudSenders = createServerFn({ method: "GET" })
  .middleware([
    requireSalesPermission(["techsales.inbox.whatsapp", "techsales.marketing.campaigns"], "view"),
  ])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const membership = await context.supabase.rpc("is_workspace_member", {
      _workspace: workspaceId,
      _user: context.userId,
    });
    if (membership.error || !membership.data) throw new Error("Membro ativo obrigatório.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const connections = await admin
      .from("wa_cloud_connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("enabled", true);
    if (connections.error) throw new Error("Não foi possível consultar os remetentes.");
    if (!connections.data.length) return [];
    const numbers = await admin
      .from("wa_cloud_numbers")
      .select("phone_number_id,display_phone_number,verified_name,quality_rating")
      .eq("workspace_id", workspaceId)
      .eq("available", true)
      .in(
        "connection_id",
        connections.data.map((row: any) => row.id),
      );
    if (numbers.error) throw new Error("Não foi possível consultar os remetentes.");
    return numbers.data as {
      phone_number_id: string;
      display_phone_number: string;
      verified_name: string | null;
      quality_rating: string | null;
    }[];
  });
