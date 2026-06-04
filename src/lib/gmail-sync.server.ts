// Server-only Gmail sync helpers (History API + messages.get + MIME parsing).
// Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureAccessToken, type EmailAccountRow } from "@/lib/gmail.server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailHeader = { name: string; value: string };
type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailMessagePart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

function findHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

function parseAddressList(value: string | null): string[] {
  if (!value) return [];
  // Naive split — handles "Name <a@b>, c@d" reasonably well.
  return value
    .split(",")
    .map((piece) => {
      const m = piece.match(/<([^>]+)>/);
      const email = m ? m[1] : piece;
      return email.trim().toLowerCase();
    })
    .filter((x) => /.+@.+/.test(x));
}

function parseSingleAddress(value: string | null): { email: string | null; name: string | null } {
  if (!value) return { email: null, name: null };
  const m = value.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: m[1]?.trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: value.trim().toLowerCase() };
}

type ParsedBody = {
  text: string | null;
  html: string | null;
  attachments: Array<{
    filename: string;
    mime_type: string;
    size: number | null;
    attachment_id: string | null;
  }>;
};

function walkParts(part: GmailMessagePart | undefined, acc: ParsedBody) {
  if (!part) return;
  const mt = (part.mimeType || "").toLowerCase();
  const filename = part.filename || "";

  if (filename && part.body?.attachmentId) {
    acc.attachments.push({
      filename,
      mime_type: mt || "application/octet-stream",
      size: part.body.size ?? null,
      attachment_id: part.body.attachmentId,
    });
  } else if (mt === "text/plain" && part.body?.data) {
    acc.text = (acc.text ?? "") + b64urlDecode(part.body.data);
  } else if (mt === "text/html" && part.body?.data) {
    acc.html = (acc.html ?? "") + b64urlDecode(part.body.data);
  }

  if (part.parts) for (const p of part.parts) walkParts(p, acc);
}

function parsePayload(payload: GmailMessagePart | undefined): ParsedBody {
  const acc: ParsedBody = { text: null, html: null, attachments: [] };
  walkParts(payload, acc);
  return acc;
}

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    const err = new Error(`Gmail API ${path} → ${res.status} ${t}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

async function getProfileHistoryId(token: string): Promise<string> {
  const j = await gmailFetch<{ historyId: string }>(token, "/profile");
  return j.historyId;
}

async function listRecentMessageIds(token: string): Promise<string[]> {
  // Initial seed: only the last day, max 25 messages, to avoid a flood.
  const j = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(
    token,
    "/messages?maxResults=25&q=" + encodeURIComponent("newer_than:1d -in:chats -in:drafts"),
  );
  return (j.messages ?? []).map((m) => m.id);
}

async function listHistoryMessageIds(
  token: string,
  startHistoryId: string,
): Promise<{ messageIds: string[]; newHistoryId: string | null; expired: boolean }> {
  type Page = {
    history?: Array<{ messagesAdded?: Array<{ message: { id: string; threadId: string } }> }>;
    historyId?: string;
    nextPageToken?: string;
  };
  const messageIds = new Set<string>();
  let pageToken: string | undefined;
  let lastHistoryId: string | null = null;
  for (let i = 0; i < 10; i++) {
    const qs = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      maxResults: "100",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    try {
      const j = await gmailFetch<Page>(token, `/history?${qs.toString()}`);
      for (const h of j.history ?? []) {
        for (const ma of h.messagesAdded ?? []) messageIds.add(ma.message.id);
      }
      if (j.historyId) lastHistoryId = j.historyId;
      if (!j.nextPageToken) break;
      pageToken = j.nextPageToken;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 404 || status === 410) {
        // history expired — caller should fall back to a fresh seed
        return { messageIds: [], newHistoryId: null, expired: true };
      }
      throw e;
    }
  }
  return { messageIds: [...messageIds], newHistoryId: lastHistoryId, expired: false };
}

async function getFullMessage(token: string, id: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(token, `/messages/${id}?format=full`);
}

export type SyncResult = {
  accountId: string;
  email: string;
  fetched: number;
  inserted: number;
  skipped: number;
  error?: string;
};

export async function syncAccount(account: EmailAccountRow): Promise<SyncResult> {
  const token = await ensureAccessToken(account);

  // Decide which IDs to pull this tick.
  let candidateIds: string[] = [];
  let nextHistoryId: string | null = null;

  if (!account.history_id) {
    candidateIds = await listRecentMessageIds(token);
    nextHistoryId = await getProfileHistoryId(token);
  } else {
    const r = await listHistoryMessageIds(token, account.history_id);
    if (r.expired) {
      // Fall back to a fresh seed but keep candidates bounded.
      candidateIds = await listRecentMessageIds(token);
      nextHistoryId = await getProfileHistoryId(token);
    } else {
      candidateIds = r.messageIds;
      nextHistoryId = r.newHistoryId ?? account.history_id;
    }
  }

  // Cap per-tick volume to stay friendly to quota (≈ 5 quota units per get).
  candidateIds = candidateIds.slice(0, 25);

  let inserted = 0;
  let skipped = 0;

  if (candidateIds.length > 0) {
    // Pre-filter against existing provider_message_id rows.
    const { data: existing } = await supabaseAdmin
      .from("email_messages")
      .select("provider_message_id")
      .eq("account_id", account.id)
      .in("provider_message_id", candidateIds);
    const have = new Set((existing ?? []).map((e) => e.provider_message_id));

    for (const id of candidateIds) {
      if (have.has(id)) {
        skipped++;
        continue;
      }
      try {
        const msg = await getFullMessage(token, id);
        const persisted = await persistInboundMessage(account, msg);
        if (persisted) inserted++;
        else skipped++;
      } catch (e) {
        console.error(`[gmail-sync] failed to persist message ${id}:`, e);
      }
    }
  }

  await supabaseAdmin
    .from("email_accounts")
    .update({
      history_id: nextHistoryId ?? account.history_id,
      last_sync_at: new Date().toISOString(),
      last_error: null,
      status: "connected",
    })
    .eq("id", account.id);

  return {
    accountId: account.id,
    email: account.email,
    fetched: candidateIds.length,
    inserted,
    skipped,
  };
}

async function persistInboundMessage(
  account: EmailAccountRow,
  msg: GmailMessage,
): Promise<boolean> {
  const headers = msg.payload?.headers;
  const fromRaw = findHeader(headers, "From");
  const toRaw = findHeader(headers, "To");
  const ccRaw = findHeader(headers, "Cc");
  const subject = findHeader(headers, "Subject") || "(sem assunto)";
  const messageIdHeader = findHeader(headers, "Message-ID") || findHeader(headers, "Message-Id");
  const inReplyTo = findHeader(headers, "In-Reply-To");
  const { email: fromEmail, name: fromName } = parseSingleAddress(fromRaw);
  const toEmails = parseAddressList(toRaw);
  const ccEmails = parseAddressList(ccRaw);
  const dateMs = msg.internalDate ? Number(msg.internalDate) : Date.now();
  const isOutbound =
    !!fromEmail && fromEmail.toLowerCase() === account.email.toLowerCase();
  const direction = isOutbound ? "outbound" : "inbound";

  // Skip purely internal/work emails — when every participant uses an internal
  // domain there is no client involved; these are not synced into the CRM inbox.
  const INTERNAL_DOMAINS = ["wkconsultoria.com.br", "wktechnology.com.br"];
  const isInternal = (addr: string | null | undefined) => {
    if (!addr) return false;
    const dom = addr.toLowerCase().split("@")[1];
    return !!dom && INTERNAL_DOMAINS.includes(dom);
  };
  const participants = [fromEmail, ...toEmails, ...ccEmails].filter(
    (e): e is string => !!e,
  );
  if (participants.length > 0 && participants.every(isInternal)) {
    return false;
  }


  // If we already have the outbound copy (sent via our compose flow) we should
  // not double-insert. Skip when outbound + Message-ID header matches.
  if (isOutbound && messageIdHeader) {
    const { data: dup } = await supabaseAdmin
      .from("email_messages")
      .select("id")
      .eq("account_id", account.id)
      .eq("message_id_header", messageIdHeader)
      .maybeSingle();
    if (dup) return false;
  }

  const parsed = parsePayload(msg.payload);
  const snippet = (msg.snippet || parsed.text || "").slice(0, 200);
  const occurredIso = new Date(dateMs).toISOString();

  // Upsert thread by provider_thread_id.
  const { data: existingThread } = await supabaseAdmin
    .from("email_threads")
    .select("id, contact_id")
    .eq("owner_id", account.owner_id)
    .eq("account_id", account.id)
    .eq("provider_thread_id", msg.threadId)
    .maybeSingle();

  // Try to match a contact by the inbound 'from' email when applicable.
  let contactId: string | null = existingThread?.contact_id ?? null;
  if (!contactId && !isOutbound && fromEmail) {
    const { data: c } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("owner_id", account.owner_id)
      .eq("email", fromEmail)
      .limit(1)
      .maybeSingle();
    if (c) contactId = c.id;
  }

  let threadDbId: string;
  if (existingThread) {
    threadDbId = existingThread.id;
    await supabaseAdmin
      .from("email_threads")
      .update({
        last_message_at: occurredIso,
        snippet,
        subject,
        ...(contactId && !existingThread.contact_id ? { contact_id: contactId } : {}),
      })
      .eq("id", threadDbId);
  } else {
    const { data: ins, error: tErr } = await supabaseAdmin
      .from("email_threads")
      .insert({
        owner_id: account.owner_id,
        account_id: account.id,
        provider_thread_id: msg.threadId,
        subject,
        snippet,
        last_message_at: occurredIso,
        contact_id: contactId,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);
    threadDbId = ins.id;
  }

  const { error: mErr } = await supabaseAdmin.from("email_messages").insert({
    owner_id: account.owner_id,
    account_id: account.id,
    thread_id: threadDbId,
    provider_message_id: msg.id,
    message_id_header: messageIdHeader,
    in_reply_to: inReplyTo,
    direction,
    from_email: fromEmail,
    from_name: fromName,
    to_emails: toEmails,
    cc_emails: ccEmails,
    bcc_emails: [],
    subject,
    body_html: parsed.html,
    body_text: parsed.text,
    snippet,
    has_attachments: parsed.attachments.length > 0,
    attachments: parsed.attachments.length > 0 ? parsed.attachments : null,
    headers: headers ? Object.fromEntries((headers as GmailHeader[]).map((h) => [h.name, h.value])) : null,
    sent_at: isOutbound ? occurredIso : null,
    received_at: isOutbound ? null : occurredIso,
  });
  if (mErr) {
    // Unique constraint races etc. — log and bail without throwing the whole batch.
    console.error("[gmail-sync] insert email_messages failed", mErr);
    return false;
  }

  // Bump message_count.
  const { count } = await supabaseAdmin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadDbId);
  await supabaseAdmin
    .from("email_threads")
    .update({ message_count: count ?? 1 })
    .eq("id", threadDbId);

  // Mirror into activities timeline (inbound only — outbound already logs there
  // when the compose flow is upgraded; here we keep parity for inbound).
  if (!isOutbound && contactId) {
    await supabaseAdmin.from("activities").insert({
      owner_id: account.owner_id,
      type: "email",
      subject,
      body: snippet,
      email_direction: "inbound",
      email_status: "received",
      related_contact_id: contactId,
      completed: true,
    });
  }

  return true;
}
