import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";

const cloudReceiptSchema = z.object({
  workspaceId: z.string().uuid(),
  connectionId: z.string().uuid().nullable(),
  senderId: z.string().regex(/^\d{5,30}$/),
  providerId: z.string().min(1).max(512).regex(/^\S+$/),
  recipient: z.string().regex(/^\+[1-9]\d{7,14}$/),
  status: z.enum(["sent", "accepted", "delivered", "read", "failed"]),
  errorCode: z.enum(["131026", "131049"]).nullable(),
});
export type VerifiedCloudReceipt = z.infer<typeof cloudReceiptSchema>;

/** Markers are assigned only after the connection-specific HMAC and WABA checks. */
export function verifiedCloudReceipt(
  value: Record<string, any>,
  status: Record<string, any>,
): VerifiedCloudReceipt | null {
  if (!value._verified_workspace_id) return null; // Existing Lovable connector keeps its own boundary.
  const parsed = cloudReceiptSchema.safeParse({
    workspaceId: value._verified_workspace_id,
    connectionId: value._verified_connection_id ?? null,
    senderId: value.metadata?.phone_number_id,
    providerId: status.id,
    recipient:
      typeof status.recipient_id === "string" ? `+${status.recipient_id.replace(/^\+/, "")}` : "",
    status: status.status,
    errorCode:
      status.status === "failed" && ["131026", "131049"].includes(String(status.errors?.[0]?.code))
        ? String(status.errors[0].code)
        : null,
  });
  if (!parsed.success) throw Error("Contexto verificado do recibo incompleto.");
  return parsed.data;
}

/** Historical receipts require the original destination and sender, never current send eligibility. */
export async function assertCloudReceiptProjection(
  admin: any,
  receipt: VerifiedCloudReceipt,
  message: Record<string, any>,
) {
  if (
    message.workspace_id !== receipt.workspaceId ||
    message.direction !== "outbound" ||
    `+${String(message.to_number ?? "").replace(/\D/g, "")}` !== receipt.recipient
  )
    throw Error("O recibo não corresponde à mensagem enviada.");
  const conversation = await admin
    .from("whatsapp_conversations")
    .select("id,workspace_id,wa_phone_number_id")
    .eq("id", message.conversation_id)
    .eq("workspace_id", receipt.workspaceId)
    .maybeSingle();
  if (conversation.error || conversation.data?.wa_phone_number_id !== receipt.senderId)
    throw Error("O remetente do recibo não corresponde à conversa.");
  if (receipt.connectionId) {
    const pinned = message.raw?.source?.connection_id;
    if (pinned && pinned !== receipt.connectionId)
      throw Error("A conexão do recibo não corresponde ao envio.");
    if (!pinned) {
      const number = await admin
        .from("wa_cloud_numbers")
        .select("connection_id")
        .eq("workspace_id", receipt.workspaceId)
        .eq("phone_number_id", receipt.senderId)
        .maybeSingle();
      if (number.error || number.data?.connection_id !== receipt.connectionId)
        throw Error("A conexão histórica do recibo não pôde ser conferida.");
    }
  }
}

/** Service-only ledger reconciliation also works when the Inbox projection failed to persist. */
export async function recordNotificationCloudReceipt(admin: any, receipt: VerifiedCloudReceipt) {
  if (!receipt.connectionId) return { matched: false, updated: false }; // No invented pin for old queue rows.
  return z.object({ matched: z.boolean(), updated: z.boolean() }).parse(
    await workRpc(admin, "notification_whatsapp_receipt", {
      p_workspace: receipt.workspaceId,
      p_connection: receipt.connectionId,
      p_sender: receipt.senderId,
      p_wamid: receipt.providerId,
      p_recipient: receipt.recipient,
      p_status: receipt.status,
      p_error_code: receipt.errorCode,
    }),
  );
}

/** Queue retries cannot activate an inbound conversation while its connection is disabled. */
export async function assertCloudInboundEnabled(admin: any, value: Record<string, any>) {
  if (!value._verified_workspace_id) return;
  const number = await admin
    .from("wa_cloud_numbers")
    .select("connection_id,available")
    .eq("workspace_id", value._verified_workspace_id)
    .eq("phone_number_id", value.metadata?.phone_number_id)
    .maybeSingle();
  if (number.error || number.data?.available !== true)
    throw Error("Número Cloud indisponível para receber novas mensagens.");
  if (value._verified_connection_id && value._verified_connection_id !== number.data.connection_id)
    throw Error("A conexão Cloud da mensagem mudou.");
  const connection = await admin
    .from("wa_cloud_connections")
    .select("enabled,webhook_verified_at")
    .eq("id", number.data.connection_id)
    .eq("workspace_id", value._verified_workspace_id)
    .maybeSingle();
  if (connection.error || !connection.data?.enabled || !connection.data.webhook_verified_at)
    throw Error("Mensagem Cloud aguardando ativação da conexão.");
}
