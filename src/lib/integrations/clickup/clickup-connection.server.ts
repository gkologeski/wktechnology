import type { SupabaseClient } from "@supabase/supabase-js";
import { assertClickUpImport } from "./clickup-import.server";
import { clickUpGet } from "./clickup-api.server";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/provider-resolver.server";

type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };
type Connection = { key_ciphertext: string | null; legacy_key: boolean; key_last4: string | null };
async function load(ctx: Ctx): Promise<Connection | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin
    .from("clickup_import_connections" as never)
    .select("key_ciphertext,legacy_key,key_last4")
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a conexão ClickUp deste workspace.");
  return result.data as Connection | null;
}

export async function getClickUpConnectionState(ctx: Ctx) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "view");
  const connection = await load(ctx);
  const configured =
    !!connection &&
    (!!connection.key_ciphertext || (connection.legacy_key && !!process.env["CLICKUP_API_TOKEN"]));
  return {
    configured,
    status: configured ? "configured" : "not_configured",
    error: null as string | null,
    encryptionReady: !!process.env["AI_KEYS_ENCRYPTION_KEY"],
  };
}

/** Server-only value. The legacy environment key is usable only by pre-existing scoped markers. */
export async function getClickUpCredential(ctx: Ctx): Promise<string> {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const connection = await load(ctx);
  if (connection?.key_ciphertext) return decryptApiKey(connection.key_ciphertext);
  const legacy = process.env["CLICKUP_API_TOKEN"];
  if (connection?.legacy_key && legacy) return legacy;
  throw new Error(
    "Cadastre a conexão ClickUp deste workspace antes de consultar organizações ou importar.",
  );
}

export async function saveClickUpConnection(ctx: Ctx, apiKey: string) {
  await assertClickUpImport(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  const key = apiKey.trim();
  if (key.length < 20 || key.length > 500 || /[\r\n]/.test(key) || key.includes("\0"))
    throw new Error("Informe a chave de API completa do ClickUp.");
  if (!process.env["AI_KEYS_ENCRYPTION_KEY"])
    throw new Error("A cifragem do servidor precisa estar configurada antes de salvar a conexão.");
  // Validate the supplied credential using only the official GET endpoint before persisting.
  const result = await clickUpGet<{ teams: { id: string; name: string }[] }>("/team", {}, 2, key);
  if (!Array.isArray(result.teams))
    throw new Error("A origem não informou as organizações disponíveis.");
  const ciphertext = await encryptApiKey(key);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const saved = await supabaseAdmin.from("clickup_import_connections" as never).upsert(
    {
      workspace_id: ctx.workspaceId,
      key_ciphertext: ciphertext,
      key_last4: key.slice(-4),
      legacy_key: false,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "workspace_id" },
  );
  if (saved.error) throw new Error("Não foi possível salvar a conexão cifrada do ClickUp.");
  const cleared = await supabaseAdmin
    .from("clickup_import_source_bindings" as never)
    .delete()
    .eq("workspace_id", ctx.workspaceId);
  if (cleared.error)
    throw new Error(
      "Conexão salva; não foi possível renovar as organizações. Confira a configuração antes de importar.",
    );
  // A rotated key invalidates previous source assumptions; source selection is explicit again.
  return { configured: true, status: "configured" };
}
