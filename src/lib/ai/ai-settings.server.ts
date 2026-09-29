import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { encryptApiKey, routeForProvider } from "./provider-resolver.server";
import { adaptBody, getAiProvider, type AiProviderId } from "./providers";

type Ctx = { workspaceId: string; isAdmin: boolean };

async function ctxFor(supabase: SupabaseClient, userId: string): Promise<Ctx> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data } = await supabase.rpc("is_workspace_admin_v2", {
    _workspace: workspaceId,
    _user: userId,
  });
  return { workspaceId, isAdmin: Boolean(data) };
}

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const c = await ctxFor(supabase, userId);
  if (!c.isAdmin) throw new Error("Apenas administradores do workspace podem alterar a IA.");
  return c;
}

export async function loadAiSettings(supabase: SupabaseClient, userId: string) {
  const { workspaceId, isAdmin } = await ctxFor(supabase, userId);
  const { data: s } = await supabase
    .from("workspace_ai_settings")
    .select("provider, model, status, last_error, last_tested_at, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const { data: creds } = await supabaseAdmin
    .from("workspace_ai_credentials")
    .select("provider, key_last4, model, updated_at")
    .eq("workspace_id", workspaceId);
  return {
    isAdmin,
    active: {
      provider: (s?.provider ?? "lovable") as AiProviderId,
      model: s?.model ?? null,
      status: s?.status ?? "connected",
      lastError: s?.last_error ?? null,
      lastTestedAt: s?.last_tested_at ?? null,
    },
    credentials: (creds ?? []).map((c) => ({
      provider: c.provider as AiProviderId,
      keyLast4: c.key_last4,
      model: c.model,
      updatedAt: c.updated_at,
    })),
  };
}

export async function saveCredential(
  supabase: SupabaseClient,
  userId: string,
  input: { provider: AiProviderId; apiKey?: string; model: string },
) {
  const { workspaceId } = await requireAdmin(supabase, userId);
  const now = new Date().toISOString();
  if (input.apiKey) {
    const { error } = await supabaseAdmin.from("workspace_ai_credentials").upsert({
      workspace_id: workspaceId,
      provider: input.provider,
      key_ciphertext: await encryptApiKey(input.apiKey),
      key_last4: input.apiKey.slice(-4),
      model: input.model,
      updated_by: userId,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("workspace_ai_credentials")
      .update({ model: input.model, updated_by: userId, updated_at: now })
      .eq("workspace_id", workspaceId)
      .eq("provider", input.provider)
      .select("provider");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Informe a chave de API do provedor.");
  }
  // Se já é o provedor ativo, atualiza o modelo e volta a "configurado".
  await supabaseAdmin
    .from("workspace_ai_settings")
    .update({ model: input.model, status: "configured", last_error: null, updated_at: now })
    .eq("workspace_id", workspaceId)
    .eq("provider", input.provider);
  return { ok: true };
}

export async function testProvider(
  supabase: SupabaseClient,
  userId: string,
  provider: AiProviderId,
) {
  const { workspaceId } = await requireAdmin(supabase, userId);
  const route = await routeForProvider(workspaceId, provider);
  const body = adaptBody(
    {
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: "Responda apenas: ok" }],
    },
    route,
  );
  let ok = false;
  let message = "";
  try {
    const res = await fetch(route.url, {
      method: "POST",
      headers: route.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    ok = res.ok;
    message = res.ok ? "Conexão funcionando." : `Erro ${res.status}: ${text.slice(0, 200)}`;
  } catch (e) {
    message = `Falha de rede: ${(e as Error).message}`;
  }
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("workspace_ai_settings")
    .update({
      status: ok ? "connected" : "failed",
      last_error: ok ? null : message,
      last_tested_at: now,
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
  return { ok, message };
}

export async function setActive(supabase: SupabaseClient, userId: string, provider: AiProviderId) {
  const { workspaceId } = await requireAdmin(supabase, userId);
  let model: string | null = null;
  if (provider !== "lovable") {
    const { data } = await supabaseAdmin
      .from("workspace_ai_credentials")
      .select("model")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .maybeSingle();
    if (!data) throw new Error("Salve a chave desse provedor antes de usá-lo.");
    model = data.model ?? getAiProvider(provider)?.defaultModel ?? null;
  }
  const { error } = await supabaseAdmin.from("workspace_ai_settings").upsert({
    workspace_id: workspaceId,
    provider,
    model,
    status: provider === "lovable" ? "connected" : "configured",
    last_error: null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removeCredential(
  supabase: SupabaseClient,
  userId: string,
  provider: AiProviderId,
) {
  const { workspaceId } = await requireAdmin(supabase, userId);
  const { data: s } = await supabaseAdmin
    .from("workspace_ai_settings")
    .select("provider")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (s?.provider === provider) await setActive(supabase, userId, "lovable");
  const { error } = await supabaseAdmin
    .from("workspace_ai_credentials")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
  return { ok: true };
}
