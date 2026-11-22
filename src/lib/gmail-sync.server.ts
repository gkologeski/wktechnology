import { assertSalesAccountJob } from "@/lib/access-control/sales-account-job.server";
// Server-only Gmail sync helpers (History API + messages.get + MIME parsing).
// Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureAccessToken, type EmailAccountRow } from "@/lib/gmail.server";
import { identityColumns, resolveInboxIdentity } from "@/lib/inbox/identity-resolution.server";
import { autoAssignInboxConversation } from "@/lib/inbox-auto-assignment.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { gmailProviderTime } from "./gmail-provider-time";
import { recoverGmailAcceptances } from "./gmail-recovery.server";
import {
  collectGmailHistory,
  discoverGmailBatch,
  drainGmailQueue,
  type GmailHistoryPage,
  type GmailQueueItem,
} from "./gmail-sync-queue";

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

async function listHistoryMessageIds(token: string, startHistoryId: string) {
  return collectGmailHistory(async (pageToken) => {
    const qs = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      maxResults: "100",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    return gmailFetch<GmailHistoryPage>(token, `/history?${qs.toString()}`);
  });
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
  if (!account.workspace_id) throw new Error("Conta Gmail sem workspace de origem.");
  await assertSalesAccountJob(supabaseAdmin, "email_accounts", account.id);
  // Read the canonical status/cursor, never a stale composition or manual copy.
  const { data: current, error: currentError } = await supabaseAdmin
    .from("email_accounts")
    .select("history_id,status")
    .eq("workspace_id", account.workspace_id)
    .eq("id", account.id)
    .single();
  if (currentError) throw new Error(currentError.message);
  // Connected accounts recover before provider discovery. Manual error-account
  // retries first prove provider access; enqueue then restores connected status.
  let recovery = { claimed: 0, completed: 0, failed: 0 };
  if (current.status === "connected")
    recovery = await recoverGmailAcceptances(supabaseAdmin, account.workspace_id, account.id);
  const token = await ensureAccessToken(account);
  const discovered = await discoverGmailBatch(current.history_id, {
    profile: () => getProfileHistoryId(token),
    recent: () => listRecentMessageIds(token),
    history: (cursor) => listHistoryMessageIds(token, cursor),
  });
  const scope = { p_workspace: account.workspace_id, p_account: account.id };
  // One transaction: every discovered ID is durable BEFORE history_id advances. A stale CAS fails closed.
  await workRpc<number>(supabaseAdmin, "gmail_sync_enqueue", {
    ...scope,
    p_expected_history: current.history_id,
    p_next_history: discovered.nextHistory,
    p_provenance: discovered.provenance,
    p_ids: discovered.ids,
  });
  if (current.status !== "connected")
    recovery = await recoverGmailAcceptances(supabaseAdmin, account.workspace_id, account.id);
  const leaseToken = crypto.randomUUID();
  const items = await workRpc<GmailQueueItem[]>(supabaseAdmin, "gmail_sync_claim", {
    ...scope,
    p_token: leaseToken,
  });
  const result = await drainGmailQueue(items, {
    persist: async (item) => {
      await assertSalesAccountJob(supabaseAdmin, "email_accounts", account.id);
      // Accepted human sends are projected only from the private receipt. Do
      // not let a History API mirror race that projection with another row ID.
      if (
        await workRpc<boolean>(supabaseAdmin, "inbox_gmail_recovery_known", {
          ...scope,
          p_provider: item.provider_message_id,
        })
      )
        return "skipped";
      const { data: existing, error } = await supabaseAdmin
        .from("email_messages")
        .select("id")
        .eq("workspace_id", account.workspace_id)
        .eq("account_id", account.id)
        .eq("provider_message_id", item.provider_message_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (existing) return "existing";
      let msg: GmailMessage;
      try {
        msg = await getFullMessage(token, item.provider_message_id);
      } catch (error) {
        if ((error as { status?: number }).status === 404) return "gone";
        throw error;
      }
      return (await persistInboundMessage(account, msg, item)) ? "inserted" : "skipped";
    },
    finish: (item, outcome) =>
      workRpc<boolean>(supabaseAdmin, "gmail_sync_finish", {
        ...scope,
        p_id: item.id,
        p_token: leaseToken,
        p_outcome: outcome,
      }),
    retry: (item) =>
      workRpc<boolean>(supabaseAdmin, "gmail_sync_retry", {
        ...scope,
        p_id: item.id,
        p_token: leaseToken,
      }),
  });
  return {
    accountId: account.id,
    email: account.email,
    fetched: result.fetched,
    inserted: result.inserted,
    skipped: result.skipped,
    ...(result.failed || recovery.failed
      ? { error: `${result.failed + recovery.failed} mensagem(ns) pendente(s) de nova tentativa.` }
      : {}),
  };
}

async function persistInboundMessage(
  account: EmailAccountRow,
  msg: GmailMessage,
  receipt: GmailQueueItem,
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
  const occurredIso = gmailProviderTime(msg.internalDate);
  const isOutbound = !!fromEmail && fromEmail.toLowerCase() === account.email.toLowerCase();
  const direction = isOutbound ? "outbound" : "inbound";

  // Skip purely internal/work emails — when every participant uses an internal
  // domain there is no client involved; these are not synced into the CRM inbox.
  const INTERNAL_DOMAINS = ["wkconsultoria.com.br", "wktechnology.com.br"];
  const isInternal = (addr: string | null | undefined) => {
    if (!addr) return false;
    const dom = addr.toLowerCase().split("@")[1];
    return !!dom && INTERNAL_DOMAINS.includes(dom);
  };
  const participants = [fromEmail, ...toEmails, ...ccEmails].filter((e): e is string => !!e);
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

  // Upsert thread by provider_thread_id.
  const { data: existingThread } = await supabaseAdmin
    .from("email_threads")
    .select("id, contact_id, lead_id, assigned_to")
    .eq("owner_id", account.owner_id)
    .eq("account_id", account.id)
    .eq("provider_thread_id", msg.threadId)
    .maybeSingle();

  const hasIdentity = !!existingThread?.contact_id || !!existingThread?.lead_id;
  const identity =
    !hasIdentity && !isOutbound && fromEmail
      ? identityColumns(
          await resolveInboxIdentity({
            supabase: supabaseAdmin,
            workspaceId: account.workspace_id,
            email: fromEmail,
          }),
        )
      : null;

  let threadDbId: string;
  if (existingThread) {
    threadDbId = existingThread.id;
    await supabaseAdmin
      .from("email_threads")
      .update({
        last_message_at: occurredIso,
        snippet,
        subject,
        ...(identity ?? {}),
      })
      .eq("id", threadDbId);
  } else {
    const { data: ins, error: tErr } = await supabaseAdmin
      .from("email_threads")
      .insert({
        workspace_id: account.workspace_id,
        owner_id: account.owner_id,
        account_id: account.id,
        provider_thread_id: msg.threadId,
        inbox_creation_receipt:
          !isOutbound && receipt.provenance === "incremental" && !receipt.preexisting
            ? receipt.id
            : null,
        subject,
        snippet,
        last_message_at: occurredIso,
        ...(identity ?? { contact_id: null, lead_id: null, identity_status: "unresolved" }),
      })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);
    threadDbId = ins.id;
  }

  if (!isOutbound && !existingThread?.assigned_to) {
    await autoAssignInboxConversation(
      supabaseAdmin,
      account.workspace_id,
      "email_threads",
      threadDbId,
    );
  }

  const messageDbId = crypto.randomUUID();
  const { error: mErr } = await supabaseAdmin.from("email_messages").insert({
    id: messageDbId,
    workspace_id: account.workspace_id,
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
    headers: headers
      ? Object.fromEntries((headers as GmailHeader[]).map((h) => [h.name, h.value]))
      : null,
    sent_at: isOutbound ? occurredIso : null,
    received_at: isOutbound ? null : occurredIso,
  });
  if (mErr) {
    // A write failure must stay pending, not be acknowledged as a successfully skipped message.
    // A uniqueness race is read back as "existing" on retry without changing first provenance.
    throw new Error(mErr.message);
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
  const contactId = existingThread?.contact_id ?? identity?.contact_id ?? null;
  if (!isOutbound && contactId) {
    await supabaseAdmin.from("activities").insert({
      workspace_id: account.workspace_id,
      owner_id: account.owner_id,
      type: "email",
      subject,
      body: parsed.html ?? parsed.text ?? snippet,
      email_direction: "inbound",
      email_status: "received",
      related_contact_id: contactId,
      completed: true,
      external_ids: {
        email_message_id: messageDbId,
        email_thread_id: threadDbId,
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
      },
    });
  }

  return true;
}
