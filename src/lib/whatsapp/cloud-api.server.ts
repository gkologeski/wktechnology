// Official Meta transport. Only server callers with an authorized connection
// may supply credentials; credentials are never placed in URLs or errors.
export type MetaCredentials = { accessToken: string; apiVersion: string };

export class MetaCloudError extends Error {
  constructor(
    public status: number,
    public code?: number,
    public subcode?: number,
  ) {
    super(`Meta Cloud API: falha ${status}${code ? ` (código ${code})` : ""}.`);
  }
}

export function metaObjectId(value: string): string {
  if (!/^\d{5,30}$/.test(value)) throw new Error("Identificador Meta inválido.");
  return value;
}

export async function cloudRequest(
  credentials: MetaCredentials,
  objectId: string,
  edge: "" | "phone_numbers" | "message_templates" | "messages" | "subscribed_apps",
  options: { method?: "GET" | "POST"; query?: Record<string, string>; body?: unknown } = {},
): Promise<any> {
  metaObjectId(objectId);
  if (!/^v\d{2}\.0$/.test(credentials.apiVersion)) throw new Error("Versão da API inválida.");
  if (!credentials.accessToken.trim()) throw new Error("Credencial Meta ausente.");
  const url = new URL(
    `https://graph.facebook.com/${credentials.apiVersion}/${objectId}${edge ? `/${edge}` : ""}`,
  );
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new MetaCloudError(response.status);
  }
  if (!response.ok || result?.error) {
    throw new MetaCloudError(response.status, result?.error?.code, result?.error?.error_subcode);
  }
  return result;
}

/** Follow cursors, never provider-supplied URLs (which can carry tokens). */
export async function cloudList(
  credentials: MetaCredentials,
  objectId: string,
  edge: "phone_numbers" | "message_templates",
  fields: string,
): Promise<any[]> {
  const items: any[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await cloudRequest(credentials, objectId, edge, {
      query: { fields, limit: "100", ...(after ? { after } : {}) },
    });
    if (!Array.isArray(result?.data)) throw new Error("Resposta de catálogo Meta inválida.");
    items.push(...result.data);
    if (!result.paging?.next) return items;
    after = result.paging?.cursors?.after;
    if (!after || seen.has(after)) throw new Error("Paginação Meta incompleta.");
    seen.add(after);
  }
  throw new Error("Catálogo Meta excedeu o limite de sincronização.");
}

/** Verify the exact raw bytes before parsing or accessing any tenant data. */
export async function verifyMetaSignature(
  raw: Uint8Array,
  signature: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, (value) => parseInt(value, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new Uint8Array(raw));
}
