// Server-only Gmail API helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type EmailAccountRow = {
  id: string;
  owner_id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  status: string;
  history_id: string | null;
};

function b64url(input: string | Buffer) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function refreshAccessToken(account: EmailAccountRow): Promise<string> {
  if (!account.refresh_token) throw new Error("Conta sem refresh_token — reconecte o Gmail");
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    await supabaseAdmin
      .from("email_accounts")
      .update({ status: "error", last_error: `refresh failed: ${res.status} ${t}` })
      .eq("id", account.id);
    throw new Error(`Falha ao renovar token: ${res.status}`);
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin
    .from("email_accounts")
    .update({
      access_token: j.access_token,
      expires_at: expiresAt,
      status: "connected",
      last_error: null,
    })
    .eq("id", account.id);
  return j.access_token;
}

export async function ensureAccessToken(account: EmailAccountRow): Promise<string> {
  const exp = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (!account.access_token || Date.now() >= exp - 30_000) {
    return refreshAccessToken(account);
  }
  return account.access_token;
}

function encodeHeader(value: string): string {
  // Use MIME encoded-word if non-ASCII
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawMime(opts: {
  from: string;
  fromName?: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const fromHeader = opts.fromName
    ? `${encodeHeader(opts.fromName)} <${opts.from}>`
    : opts.from;
  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${opts.to.join(", ")}`,
  ];
  if (opts.cc && opts.cc.length) headers.push(`Cc: ${opts.cc.join(", ")}`);
  if (opts.bcc && opts.bcc.length) headers.push(`Bcc: ${opts.bcc.join(", ")}`);
  headers.push(`Subject: ${encodeHeader(opts.subject)}`);
  headers.push("MIME-Version: 1.0");
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);

  const text = opts.bodyText ?? (opts.bodyHtml ? stripHtml(opts.bodyHtml) : "");
  const html = opts.bodyHtml ?? `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;

  const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n" + body;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function gmailSendRaw(
  accessToken: string,
  raw: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: b64url(raw), ...(threadId ? { threadId } : {}) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${t}`);
  }
  return (await res.json()) as { id: string; threadId: string };
}

export async function gmailGetMessageIdHeader(
  accessToken: string,
  messageId: string,
): Promise<string | null> {
  const res = await fetch(
    `${GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { payload?: { headers?: { name: string; value: string }[] } };
  const h = j.payload?.headers?.find((x) => x.name.toLowerCase() === "message-id");
  return h?.value ?? null;
}
