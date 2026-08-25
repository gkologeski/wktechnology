// Assinatura/verificação do parâmetro `state` do OAuth Conta Azul.
// Evita CSRF e carrega o workspace/usuário e a origem de retorno.
import { createHmac, timingSafeEqual } from "node:crypto";

export type CaOAuthState = {
  workspaceId: string;
  userId: string;
  origin: string;
  /** epoch ms de emissão */
  ts: number;
};

const MAX_AGE_MS = 15 * 60 * 1000;

function secret(): string {
  return (
    process.env["CONTAAZUL_CLIENT_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    "contaazul-state"
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export function signContaAzulState(input: Omit<CaOAuthState, "ts">): string {
  const payload = b64url(JSON.stringify({ ...input, ts: Date.now() } satisfies CaOAuthState));
  return `${payload}.${sign(payload)}`;
}

export function verifyContaAzulState(state: string | null): CaOAuthState | null {
  if (!state) return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as CaOAuthState;
    if (!parsed.workspaceId || !parsed.userId || !parsed.origin) return null;
    if (!parsed.ts || Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
