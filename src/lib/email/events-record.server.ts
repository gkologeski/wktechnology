// Registro (somente notificação) dos eventos terminais de e-mail entregues pela
// infraestrutura gerenciada da Lovable. A supressão real é aplicada no envio
// pela própria plataforma — estas tabelas seguem existindo apenas como histórico
// consultável dentro do app.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TerminalEmailReason = "bounce" | "complaint" | "unsubscribe";

function statusForReason(reason: TerminalEmailReason): "bounced" | "complained" | "suppressed" {
  if (reason === "bounce") return "bounced";
  if (reason === "complaint") return "complained";
  return "suppressed";
}

function messageForReason(reason: TerminalEmailReason): string {
  switch (reason) {
    case "bounce":
      return "Permanent bounce — email address is invalid or rejected";
    case "complaint":
      return "Spam complaint — recipient marked email as spam";
    default:
      return "Recipient unsubscribed";
  }
}

function adminClient(): SupabaseClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Grava o evento terminal nas tabelas históricas do projeto. Idempotente:
 * `suppressed_emails` é upsert por e-mail e o log é append-only (redeliveries
 * geram no máximo uma linha extra de histórico).
 */
export async function recordTerminalEmailEvent(params: {
  recipient: string;
  reason: TerminalEmailReason;
  messageId?: string | null;
  eventId?: string | null;
}): Promise<void> {
  const supabase = adminClient();
  const normalizedEmail = params.recipient.toLowerCase();

  const { error: suppressError } = await supabase.from("suppressed_emails").upsert(
    {
      email: normalizedEmail,
      reason: params.reason,
      metadata: null,
    },
    { onConflict: "email" },
  );
  if (suppressError) {
    console.error("[email-events] falha ao registrar supressão", {
      event_id: params.eventId ?? null,
      code: suppressError.code,
      message: suppressError.message,
    });
    throw new Error(suppressError.message);
  }

  const { error: logError } = await supabase.from("email_send_log").insert({
    message_id: params.messageId ?? null,
    template_name: "system",
    recipient_email: normalizedEmail,
    status: statusForReason(params.reason),
    error_message: messageForReason(params.reason),
    metadata: null,
  });
  if (logError) {
    console.error("[email-events] falha ao registrar histórico", {
      event_id: params.eventId ?? null,
      code: logError.code,
      message: logError.message,
    });
    throw new Error(logError.message);
  }
}
