// Server-only helpers for Gmail OAuth (per-user).
// Never import from client code.
import { createHmac, timingSafeEqual } from "crypto";

export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

export const CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  // Needed to fetch Google Meet recordings stored in the organizer's Drive
  "https://www.googleapis.com/auth/drive.readonly",
];

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_OAUTH_CALLBACK_PATH = "/api/public/oauth/google-callback";
const WK_CANONICAL_GOOGLE_OAUTH_ORIGIN = "https://crm.wktechnology.com.br";
const WK_ALLOWED_APP_HOSTS = new Set([
  "app.wktechnology.com.br",
  "crm.wktechnology.com.br",
  "ats.wktechnology.com.br",
  "wktechnology.lovable.app",
]);

function b64url(buf: Buffer | string) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function stateSecret(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for state signing");
  return k;
}

export function signState(payload: Record<string, unknown>): string {
  const body = b64url(JSON.stringify({ ...payload, ts: Date.now() }));
  const sig = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyState(state: string): {
  user_id: string;
  return_to?: string;
  return_origin?: string;
  mode?: string;
  ts: number;
} {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid state");
  const expected = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("State signature mismatch");
  const parsed = JSON.parse(b64urlDecode(body).toString("utf8")) as {
    user_id: string;
    return_to?: string;
    return_origin?: string;
    mode?: string;
    ts: number;
  };
  if (Date.now() - parsed.ts > 15 * 60 * 1000) throw new Error("State expired");
  return parsed;
}

export function buildGmailAuthUrl(opts: { redirectUri: string; state: string }) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function buildCalendarAuthUrl(opts: { redirectUri: string; state: string }) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: { code: string; redirectUri: string }) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${t}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  return (await res.json()) as { email: string; name?: string; sub: string };
}

export function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);
  return parsed.origin.replace(/\/+$/, "");
}

function isWkCustomDomain(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith(".wktechnology.com.br");
  } catch {
    return false;
  }
}

export function googleOAuthCallbackOrigin(appOrigin: string): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_ORIGIN;
  if (configured) return normalizeOrigin(configured);

  const origin = normalizeOrigin(appOrigin);
  if (isWkCustomDomain(origin)) return WK_CANONICAL_GOOGLE_OAUTH_ORIGIN;
  return origin;
}

export function isAllowedGoogleOAuthReturnOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return false;
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".lovable.app") ||
      parsed.hostname.endsWith(".lovableproject.com") ||
      WK_ALLOWED_APP_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith(".wktechnology.com.br")
    );
  } catch {
    return false;
  }
}

export function buildGoogleOAuthReturnUrl(opts: {
  returnOrigin?: string;
  returnTo?: string;
  fallbackPath: string;
}): string {
  const origin =
    opts.returnOrigin && isAllowedGoogleOAuthReturnOrigin(opts.returnOrigin)
      ? normalizeOrigin(opts.returnOrigin)
      : "";
  const path = opts.returnTo && opts.returnTo.startsWith("/") ? opts.returnTo : opts.fallbackPath;
  return origin ? new URL(path, origin).toString() : path;
}

export function callbackRedirectUri(origin: string): string {
  return `${googleOAuthCallbackOrigin(origin)}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}
