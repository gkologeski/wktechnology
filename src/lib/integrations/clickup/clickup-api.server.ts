// A API e os downloads de origem são somente leitura; credencial nunca segue ao CDN.
import type { SupabaseClient } from "@supabase/supabase-js";
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
type Ctx = { client: SupabaseClient; workspaceId: string; userId: string };

export class ClickUpRateLimited extends Error {
  constructor(public waitSeconds: number) {
    super("Limite de leitura do ClickUp atingido. A importação pode ser retomada.");
  }
}

export class ClickUpReadError extends Error {
  constructor(public status: number) {
    super(`ClickUp respondeu ${status}. Os registros já recebidos continuam preservados.`);
  }
}

export function clickUpId(id: unknown): string {
  const value = String(id ?? "");
  if (!ID_RE.test(value)) throw new Error("Identificador do ClickUp inválido.");
  return value;
}

export async function clickUpGet<T>(
  path: string,
  query: Record<string, string> = {},
  version: 2 | 3 = 2,
  token?: string,
): Promise<T> {
  if (!/^\/[A-Za-z0-9_/-]+$/.test(path) || path.includes(".."))
    throw new Error("Caminho de leitura do ClickUp inválido.");
  if (!token) throw new Error("Cadastre a conexão ClickUp deste workspace antes de continuar.");
  const url = new URL(`https://api.clickup.com/api/v${version}${path}`);
  url.search = new URLSearchParams(query).toString();
  const res = await fetch(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: token, accept: "application/json" },
  });
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const wait = Number.isFinite(reset) && reset > 0 ? Math.max(5, reset - Date.now() / 1000) : 30;
    throw new ClickUpRateLimited(Math.min(300, Math.ceil(wait)));
  }
  // O corpo de erro pode repetir dados privados ou URLs assinadas: não vai para UI/log.
  if (!res.ok) throw new ClickUpReadError(res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("A resposta do ClickUp não pôde ser interpretada; retome a coleta.");
  }
}

/** No request can fall back to a global token merely because another tenant has configured it. */
export async function clickUpGetForWorkspace<T>(
  ctx: Ctx,
  path: string,
  query: Record<string, string> = {},
  version: 2 | 3 = 2,
) {
  const { getClickUpCredential } = await import("./clickup-connection.server");
  return clickUpGet<T>(path, query, version, await getClickUpCredential(ctx));
}

/** URLs retornadas pela API não autorizam requisições a hosts arbitrários. */
export function assertClickUpAttachmentUrl(input: string): URL {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !["attachments.clickup.com", "attachments-public.clickup.com"].includes(url.hostname)
  )
    throw new Error("O endereço do arquivo não pertence ao CDN autorizado do ClickUp.");
  return url;
}

/** Lê conteúdo em memória limitada, sem transmitir Authorization ao CDN ou seguir redirects. */
export async function readClickUpAttachment(input: string, maxBytes = 64 * 1024 * 1024) {
  const url = assertClickUpAttachmentUrl(input);
  const res = await fetch(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
    headers: { accept: "application/octet-stream" },
  });
  if (!res.ok || !res.body) throw new Error("Não foi possível preservar o conteúdo do arquivo.");
  const length = Number(res.headers.get("content-length"));
  if (length > maxBytes)
    throw new Error("Arquivo excede o limite de transferência; conteúdo pendente.");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maxBytes)
        throw new Error("Arquivo excede o limite de transferência; conteúdo pendente.");
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, contentType: res.headers.get("content-type") || "application/octet-stream" };
}
