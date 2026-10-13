// Envio real de e-mail pelos fluxos: usa a caixa Gmail conectada do dono do
// fluxo no MESMO workspace. Respeita descadastro, é idempotente por
// execução/destinatário/assunto e, sem caixa conectada, registra só na fila
// interna com status honesto (nada sai).
import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowEmailInput = {
  workspaceId: string;
  ownerId: string;
  runId?: string;
  to: string;
  subject: string;
  bodyHtml: string;
};

export type WorkflowEmailResult =
  | { status: "sent"; provider: "gmail"; providerId: string; messageId: string; from: string }
  | { status: "skipped_duplicate"; messageId: string }
  | { status: "unsubscribed" }
  | { status: "queued_local"; messageId: string | null; reason: "no_account" };

export type GmailSender = {
  send: (
    account: { id: string; email: string } & Record<string, unknown>,
    mime: { from: string; to: string[]; subject: string; bodyHtml: string; bodyText: string },
  ) => Promise<{ id: string; threadId: string }>;
};

export function workflowEmailKey(i: Pick<WorkflowEmailInput, "workspaceId" | "runId" | "to" | "subject">) {
  if (!i.runId) return null;
  return `wf:${i.workspaceId}:${i.runId}:${i.to.toLowerCase()}:${i.subject}`;
}

const defaultSender: GmailSender = {
  async send(account, mime) {
    const g = await import("@/lib/gmail.server");
    const token = await g.ensureAccessToken(account as unknown as import("@/lib/gmail.server").EmailAccountRow);
    return g.gmailSendRaw(token, g.buildRawMime(mime));
  },
};

export async function sendWorkflowEmail(
  supabase: SupabaseClient,
  input: WorkflowEmailInput,
  sender: GmailSender = defaultSender,
): Promise<WorkflowEmailResult> {
  const to = input.to.trim().toLowerCase();
  const { data: unsub } = await supabase
    .from("email_unsubscribes")
    .select("email")
    .eq("workspace_id", input.workspaceId)
    .ilike("email", to)
    .limit(1);
  if ((unsub ?? []).length > 0) return { status: "unsubscribed" };

  const key = workflowEmailKey({ ...input, to });
  if (key) {
    const { data: prior } = await supabase
      .from("email_messages")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("headers->>x-wf-idempotency", key)
      .limit(1);
    const p = (prior ?? [])[0] as { id: string } | undefined;
    if (p) return { status: "skipped_duplicate", messageId: p.id };
  }

  const bodyText = input.bodyHtml.replace(/<[^>]+>/g, "");
  const { data: accounts } = await supabase
    .from("email_accounts")
    .select("id, workspace_id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
    .eq("workspace_id", input.workspaceId)
    .eq("owner_id", input.ownerId)
    .eq("provider", "gmail")
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1);
  const account = (accounts ?? [])[0] as ({ id: string; email: string } & Record<string, unknown>) | undefined;
  const headers = key ? { "x-wf-idempotency": key } : {};

  if (!account) {
    const { data: row } = await supabase
      .from("email_messages")
      .insert({
        workspace_id: input.workspaceId,
        owner_id: input.ownerId,
        direction: "outbound",
        to_emails: [to],
        subject: input.subject,
        body_html: input.bodyHtml,
        body_text: bodyText,
        headers,
      } as never)
      .select("id")
      .maybeSingle();
    return { status: "queued_local", messageId: (row as { id: string } | null)?.id ?? null, reason: "no_account" };
  }

  const sent = await sender.send(account, {
    from: account.email,
    to: [to],
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText,
  });
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("email_messages")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      account_id: account.id,
      provider_message_id: sent.id,
      direction: "outbound",
      from_email: account.email,
      to_emails: [to],
      subject: input.subject,
      body_html: input.bodyHtml,
      body_text: bodyText,
      sent_at: now,
      headers,
    } as never)
    .select("id")
    .maybeSingle();
  // Já saiu pelo provedor: falha local não pode virar novo envio.
  if (error) console.error("[workflow-email] envio feito, registro local falhou", error.message);
  return {
    status: "sent",
    provider: "gmail",
    providerId: sent.id,
    messageId: (row as { id: string } | null)?.id ?? "",
    from: account.email,
  };
}
