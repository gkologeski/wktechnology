// Assinatura dos webhooks de saída: HMAC-SHA256 sobre "<timestamp>.<corpo>".
// Cabeçalho: X-TechERP-Signature: t=<unix>,v1=<hex>. O receptor recusa carimbos fora da janela
// (proteção contra repetição) e deduplica por X-TechERP-Event-Id.

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signWebhook(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${body}`)}`;
}

/** Assinatura legada (só o corpo), mantida para receptores já configurados. */
export async function legacySignature(secret: string, body: string) {
  return hmacHex(secret, body);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verificação do lado do receptor (usada nos testes e documentada para integradores). */
export async function verifyWebhook(
  secret: string,
  header: string | null,
  body: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > toleranceSeconds || !parts.v1) return false;
  return safeEqual(parts.v1, await hmacHex(secret, `${t}.${body}`));
}
