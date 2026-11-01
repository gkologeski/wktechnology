// Autenticação do retorno da Vapi: segredo compartilhado (VAPI_WEBHOOK_SECRET)
// no cabeçalho x-vapi-secret/x-vapi-signature ou no campo `secret` da mensagem.
export function verifyVapiWebhook(
  request: Request,
  payloadSecret?: string | null,
): { ok: true } | { ok: false; response: Response } {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected) return { ok: false, response: new Response("Server misconfigured", { status: 500 }) };
  const got = request.headers.get("x-vapi-secret") ?? request.headers.get("x-vapi-signature") ?? "";
  if (got === expected || (payloadSecret ?? "") === expected) return { ok: true };
  return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
}
