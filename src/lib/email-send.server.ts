// Envio de e-mail transacional server-only (cron, régua de cobrança).
// Renderiza template do registry e enfileira via RPC `enqueue_email`, mesma
// pipeline usada pela rota /lovable/email/transactional/send, porém sem
// exigir JWT do usuário — usa o cliente com service role.
import * as React from "react";
import { render as renderAsync } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "wktechnology";
const SENDER_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_DOMAIN = "notify.crm.wktechnology.com.br";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ServerEmailResult = {
  status: "sent" | "suppressed" | "error";
  messageId?: string;
  error?: string;
};

export async function sendTransactionalEmailFromServer(params: {
  supabase: SupabaseClient;
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<ServerEmailResult> {
  const { supabase, templateName, recipientEmail, templateData = {}, idempotencyKey } = params;

  const template = TEMPLATES[templateName];
  if (!template) {
    return { status: "error", error: `Template '${templateName}' não encontrado` };
  }

  const effectiveRecipient = template.to || recipientEmail;
  if (!effectiveRecipient) {
    return { status: "error", error: "Destinatário não informado" };
  }

  const messageId = crypto.randomUUID();
  const idKey = idempotencyKey || messageId;
  const normalizedEmail = effectiveRecipient.toLowerCase();

  // Suppression check
  const { data: suppressed, error: suppressionError } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (suppressionError) {
    return { status: "error", error: `suppression check: ${suppressionError.message}` };
  }
  if (suppressed) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
    });
    return { status: "suppressed", messageId };
  }

  // Unsubscribe token (get or create)
  let unsubscribeToken: string;
  const { data: existingToken } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;
  }

  // Render
  const element = React.createElement(template.component, templateData);
  const html = await renderAsync(element);
  const plainText = await renderAsync(element, { plainText: true });
  const resolvedSubject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: enqueueError.message,
    });
    return { status: "error", error: enqueueError.message };
  }

  return { status: "sent", messageId };
}
