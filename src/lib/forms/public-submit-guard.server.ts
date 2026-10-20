/**
 * Proteções do endpoint público de envio de formulários
 * (`/api/public/forms/$slug/submit`): CORS restrito ao site institucional,
 * IP do visitante e verificação do Cloudflare Turnstile no servidor.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_FAILED_MESSAGE =
  "Verificação de segurança falhou. Recarregue a página e tente novamente.";

/** Origens autorizadas a ler a resposta do endpoint no navegador. */
export const FORM_SUBMIT_ALLOWED_ORIGINS: readonly string[] = [
  "https://www.wktechnology.com.br",
  "https://wktechnology.com.br",
];

/** Cabeçalhos CORS: só ecoa a origem quando ela está na lista permitida. */
export function formSubmitCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    Vary: "Origin",
  };
  if (origin && FORM_SUBMIT_ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** IP do visitante: `cf-connecting-ip` ou o primeiro IP de `x-forwarded-for`. */
export function getVisitorIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}

export type TurnstileResult = { success: boolean; errorCodes: string[] };

/**
 * Valida o token do Turnstile na Cloudflare. Falha fechada: sem segredo,
 * sem token, erro de rede ou resposta inválida → `success: false`.
 */
export async function verifyTurnstileToken(
  token: unknown,
  remoteIp: string | null,
  opts: { secret?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TurnstileResult> {
  const secret = opts.secret ?? process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    console.error("[forms.submit] TURNSTILE_SECRET_KEY ausente; envio recusado");
    return { success: false, errorCodes: ["missing-secret"] };
  }
  // Tokens válidos têm no máximo 2048 caracteres (documentação Cloudflare).
  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token.trim());
  if (remoteIp) form.set("remoteip", remoteIp);

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: unknown;
      "error-codes"?: unknown;
    } | null;
    const errorCodes = Array.isArray(json?.["error-codes"])
      ? (json["error-codes"] as unknown[]).map(String)
      : [];
    return { success: json?.success === true, errorCodes };
  } catch (err) {
    console.error(
      "[forms.submit] falha ao consultar o Turnstile:",
      err instanceof Error ? err.name : "erro",
    );
    return { success: false, errorCodes: ["network-error"] };
  }
}
