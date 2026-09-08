// Envio de e-mail transacional server-only (cron, régua de cobrança, lembretes).
// Renderiza o template do registry e envia de forma síncrona pela infraestrutura
// gerenciada da Lovable (`sendTemplateEmail`). Entregas, retentativas, limites e
// supressão são responsabilidade da plataforma; aqui apenas registramos o
// histórico em `email_send_log`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export type ServerEmailResult = {
  status: "sent" | "suppressed" | "error";
  messageId?: string;
  error?: string;
};

async function log(
  supabase: SupabaseClient,
  row: {
    messageId: string;
    templateName: string;
    recipientEmail: string;
    status: "sent" | "suppressed" | "failed";
    errorMessage?: string;
  },
): Promise<void> {
  const { error } = await supabase.from("email_send_log").insert({
    message_id: row.messageId,
    template_name: row.templateName,
    recipient_email: row.recipientEmail,
    status: row.status,
    ...(row.errorMessage ? { error_message: row.errorMessage } : {}),
  });
  if (error) {
    console.error("[email-send] falha ao registrar histórico", {
      code: error.code,
      message: error.message,
    });
  }
}

export async function sendTransactionalEmailFromServer(params: {
  supabase: SupabaseClient;
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<ServerEmailResult> {
  const { supabase, templateName, recipientEmail, templateData = {}, idempotencyKey } = params;

  if (!recipientEmail) {
    return { status: "error", error: "Destinatário não informado" };
  }

  const messageId = crypto.randomUUID();

  try {
    const result = await sendTemplateEmail(templateName, recipientEmail, {
      templateData,
      idempotencyKey: idempotencyKey || `${templateName}:${messageId}`,
    });

    if (!result.sent) {
      await log(supabase, {
        messageId,
        templateName,
        recipientEmail,
        status: "suppressed",
      });
      return { status: "suppressed", messageId };
    }

    await log(supabase, { messageId, templateName, recipientEmail, status: "sent" });
    return { status: "sent", messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log(supabase, {
      messageId,
      templateName,
      recipientEmail,
      status: "failed",
      errorMessage: message,
    });
    return { status: "error", error: message };
  }
}
