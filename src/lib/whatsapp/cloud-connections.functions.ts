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
      .select("id,label,waba_id,api_version,enabled,webhook_verified_at,synced_at")
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
    const numbers = await inspectCloudNumbers(
      { accessToken: secrets.accessToken, apiVersion: connection.api_version },
      connection.waba_id,
    );
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
