// Resolve qual provedor de IA atende o workspace e executa a chamada de chat.
// A chave do provedor externo fica cifrada (AES-GCM) e só é lida aqui, no servidor.
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  LOVABLE_AI_URL,
  adaptBody,
  buildExternalRoute,
  type AiProviderId,
  type AiRoute,
} from "./providers";

async function cryptoKey(): Promise<CryptoKey> {
  const secret = process.env["AI_KEYS_ENCRYPTION_KEY"];
  if (!secret) throw new Error("AI_KEYS_ENCRYPTION_KEY não configurada");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptApiKey(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(),
    new TextEncoder().encode(plain),
  );
  return `${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decryptApiKey(payload: string): Promise<string> {
  const [iv, ct] = payload.split(".");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await cryptoKey(),
    unb64(ct),
  );
  return new TextDecoder().decode(pt);
}

function lovableRoute(): AiRoute {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  return {
    provider: "lovable",
    url: `${LOVABLE_AI_URL}/chat/completions`,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    model: null,
  };
}

/** Rota para um provedor específico com a chave salva do workspace. */
export async function routeForProvider(
  workspaceId: string,
  provider: AiProviderId,
  modelOverride?: string | null,
): Promise<AiRoute> {
  if (provider === "lovable") return lovableRoute();
  const { data, error } = await supabaseAdmin
    .from("workspace_ai_credentials")
    .select("key_ciphertext, model")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler credencial de IA: ${error.message}`);
  if (!data) throw new Error("Chave do provedor de IA não configurada.");
  const key = await decryptApiKey(data.key_ciphertext);
  return buildExternalRoute(provider, key, modelOverride ?? data.model ?? "");
}

export async function resolveAiRoute(workspaceId: string | null): Promise<AiRoute> {
  if (!workspaceId) return lovableRoute();
  const { data } = await supabaseAdmin
    .from("workspace_ai_settings")
    .select("provider, model, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data || data.provider === "lovable" || data.status === "disabled") return lovableRoute();
  return routeForProvider(workspaceId, data.provider as AiProviderId, data.model);
}

/** Descobre usuário/workspace a partir do token da requisição atual, quando houver. */
async function identityFromRequest(): Promise<{ userId: string | null; workspaceId: string | null }> {
  try {
    const req = getRequest();
    const auth = req?.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return { userId: null, workspaceId: null };
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (!data.user) return { userId: null, workspaceId: null };
    return { userId: data.user.id, workspaceId: await resolveActiveWorkspace(data.user.id) };
  } catch {
    return { userId: null, workspaceId: null };
  }
}

/** Workspace de uma tarefa automática: usa o do registro ou o do dono. */
export async function workspaceForRecord(
  workspaceId: string | null | undefined,
  ownerId: string | null | undefined,
): Promise<string | null> {
  if (workspaceId) return workspaceId;
  if (!ownerId) return null;
  // Algumas tabelas legadas guardam o próprio workspace em owner_id.
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("id", ownerId)
    .maybeSingle();
  if (ws) return ownerId;
  try {
    return await resolveActiveWorkspace(ownerId);
  } catch {
    return null;
  }
}

export type AiCallContext = {
  workspaceId?: string | null;
  feature?: AiFeature;
  triggerSource?: "user" | "automatic";
  userId?: string | null;
};

async function markFailure(workspaceId: string, provider: string, status: number, text: string) {
  if (status !== 401 && status !== 402 && status !== 403) return;
  await supabaseAdmin
    .from("workspace_ai_settings")
    .update({ status: "failed", last_error: `${provider} ${status}: ${text.slice(0, 200)}` })
    .eq("workspace_id", workspaceId);
}

/** Grava uma linha em `ai_call_logs` (sem prompt nem resposta). */
export async function writeLog(row: {
  workspace_id: string | null;
  provider: string;
  model: string | null;
  feature: string;
  trigger_source: "user" | "automatic";
  triggered_by: string | null;
  duration_ms: number;
  status: "success" | "failed";
  error: string | null;
  text: string;
}) {
  const usage = row.status === "success" ? parseUsage(row.text) : null;
  const { text: _t, ...rest } = row;
  void _t;
  await supabaseAdmin.from("ai_call_logs").insert({
    ...rest,
    prompt_tokens: usage?.prompt_tokens ?? null,
    completion_tokens: usage?.completion_tokens ?? null,
    estimated_cost_usd: estimateCostUsd(row.provider, row.model, usage),
  });
}

/**
 * Substitui `fetch(AI_URL, init)` nas chamadas de chat. Usa o provedor configurado
 * no workspace (ou Lovable AI por padrão). Não troca de provedor em caso de erro.
 * Registra cada chamada em `ai_call_logs`.
 */
export async function aiChatFetch(init: RequestInit, ctx: AiCallContext = {}): Promise<Response> {
  const who =
    ctx.workspaceId !== undefined
      ? { userId: ctx.userId ?? null, workspaceId: ctx.workspaceId }
      : await identityFromRequest();
  const workspaceId = who.workspaceId;
  const route = await resolveAiRoute(workspaceId);
  const parsed = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const body = adaptBody(parsed, route);
  const started = Date.now();
  const logBase = {
    workspace_id: workspaceId,
    provider: route.provider,
    model: (body.model as string | undefined) ?? null,
    feature: ctx.feature ?? "outros",
    trigger_source: ctx.triggerSource ?? (who.userId ? "user" : "automatic"),
    triggered_by: ctx.userId ?? who.userId,
  } as const;
  let res: Response;
  try {
    res = await fetch(route.url, {
      ...init,
      method: "POST",
      headers: route.headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    await writeLog({
      ...logBase,
      duration_ms: Date.now() - started,
      status: "failed",
      error: (e as Error).message.slice(0, 300),
      text: "",
    }).catch(() => undefined);
    throw e;
  }
  const done = res
    .clone()
    .text()
    .then(async (text) => {
      if (!res.ok && route.provider !== "lovable" && workspaceId) {
        await markFailure(workspaceId, route.provider, res.status, text);
      }
      await writeLog({
        ...logBase,
        duration_ms: Date.now() - started,
        status: res.ok ? "success" : "failed",
        error: res.ok ? null : `${res.status}: ${text.slice(0, 300)}`,
        text,
      });
    })
    .catch(() => undefined);
  // Respostas não-stream aguardam o log (rápido); streams não são bloqueados.
  if (!parsed.stream) await done;
  return res;
}
