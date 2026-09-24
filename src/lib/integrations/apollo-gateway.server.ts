// Camada única de transporte para a API do Apollo.io.
// Quando a conexão do Apollo é gerenciada pelo Connector Gateway da Lovable
// (caso padrão do workspace), a chamada precisa passar pelo gateway com
// Authorization: Bearer LOVABLE_API_KEY + X-Connection-Api-Key. Chamar
// api.apollo.io direto com essa chave resulta em 401 "Invalid API key".
// Sem LOVABLE_API_KEY (chave própria do cliente), cai no modo direto.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";
const APOLLO_BASE = "https://api.apollo.io";

export type ApolloRequestInit = {
  method?: "GET" | "POST";
  query?: Record<string, string | undefined>;
  body?: unknown;
};

export function apolloEndpoint(path: string, query?: Record<string, string | undefined>) {
  const base = process.env.LOVABLE_API_KEY ? GATEWAY_URL : APOLLO_BASE;
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v) url.searchParams.append(k, v);
  }
  return url;
}

export function apolloHeaders(connectionKey: string, method: "GET" | "POST" = "GET") {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const headers: Record<string, string> = { accept: "application/json" };
  if (lovableKey) {
    headers.Authorization = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = connectionKey;
  } else {
    headers["X-Api-Key"] = connectionKey;
  }
  if (method === "POST") headers["Content-Type"] = "application/json";
  return headers;
}

/** Faz a chamada crua e devolve status + texto, sem interpretar erros. */
export async function apolloRawRequest(
  path: string,
  connectionKey: string,
  init: ApolloRequestInit = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const method = init.method ?? "GET";
  const res = await fetch(apolloEndpoint(path, init.query), {
    method,
    headers: apolloHeaders(connectionKey, method),
    ...(method === "POST" && init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
