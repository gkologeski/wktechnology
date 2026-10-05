// Processa eventos guardados em whatsapp_webhook_events (conexão Lovable).
// Idempotente: mensagens deduplicadas por wa_message_id; status nunca regride.
import { shouldApplyStatus } from "@/lib/whatsapp/status-rank";

const STATUS_ORDER = ["accepted", "sent", "delivered", "read", "failed"];
import { normalizePhone } from "@/lib/whatsapp/meta-channel.server";
import { identityColumns, resolveInboxIdentity } from "@/lib/inbox/identity-resolution.server";
import { autoAssignInboxConversation } from "@/lib/inbox-auto-assignment.server";

// Tabela whatsapp_webhook_events só entra nos tipos após aceitar o rascunho.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

type EventRow = { id: string; event: string; payload: any; attempts: number };

class Retry extends Error {}

function valueOf(payload: any): any {
  return payload?.entry?.[0]?.changes?.[0]?.value ?? {};
}

async function resolveWorkspace(
  admin: Admin,
  contactPhone: string,
  ourPhone: string,
  phoneNumberId?: string | null,
) {
  if (phoneNumberId) {
    const { data: configured } = await admin
      .from("wa_phone_numbers")
      .select("workspace_id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    if (configured?.workspace_id) {
      return { id: null, workspace_id: configured.workspace_id as string };
    }
  }
  const { data: byContact } = await admin
    .from("whatsapp_conversations")
    .select("id, workspace_id, contact_id, lead_id, identity_status")
    .eq("contact_phone", contactPhone)
    .eq("twilio_number", ourPhone)
    .maybeSingle();
  if (byContact?.workspace_id) return byContact;
  const { data: any1 } = await admin
    .from("whatsapp_conversations")
    .select("workspace_id")
    .eq("twilio_number", ourPhone)
    .not("workspace_id", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (any1?.workspace_id) return { id: null, workspace_id: any1.workspace_id as string };
  const { data: ws } = await admin.from("workspaces").select("id").limit(2);
  if (ws && ws.length === 1) return { id: null, workspace_id: ws[0].id as string };
  return null;
}

async function autoAssignConversation(admin: Admin, workspaceId: string, convId: string) {
  await autoAssignInboxConversation(admin, workspaceId, "whatsapp_conversations", convId);
}

function inboundBody(m: any): string {
  if (m.type === "text") return m.text?.body ?? "";
  if (m.type === "button") return m.button?.text ?? "";
  if (m.type === "interactive")
    return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
  const media = m[m.type];
  return media?.caption ? `[${m.type}] ${media.caption}` : `[${m.type}]`;
}

async function handleMessages(admin: Admin, value: any): Promise<string | null> {
  const ourPhone = normalizePhone(value?.metadata?.display_phone_number ?? "");
  let workspaceId: string | null = null;
  for (const m of value?.messages ?? []) {
    const { data: dup } = await admin
      .from("whatsapp_messages")
      .select("id")
      .eq("wa_message_id", m.id)
      .maybeSingle();
    if (dup) continue;
    const from = normalizePhone(m.from);
    const ws = await resolveWorkspace(admin, from, ourPhone, value?.metadata?.phone_number_id);
    if (!ws) throw new Retry("Workspace da conversa não identificado");
    workspaceId = ws.workspace_id;
    const body = inboundBody(m);
    const now = new Date().toISOString();
    const hasIdentity = !!ws.contact_id || !!ws.lead_id || ws.identity_status === "manual";
    const identity = hasIdentity
      ? null
      : await resolveInboxIdentity({
          supabase: admin,
          workspaceId: ws.workspace_id,
          phone: from,
        });
    const { data: conv, error: cErr } = await admin
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: ws.workspace_id,
          workspace_id: ws.workspace_id,
          contact_phone: from,
          twilio_number: ourPhone,
          provider: "meta",
          wa_phone_number_id: value?.metadata?.phone_number_id ?? null,
          last_message_at: now,
          last_inbound_at: now,
          last_message_preview: body.slice(0, 120),
          ...(identity ? identityColumns(identity) : {}),
        },
        { onConflict: "contact_phone,twilio_number" },
      )
      .select("id, assigned_to")
      .single();
    if (cErr) throw new Retry(cErr.message);
    // Conversa sem responsável: distribui pela regra ativa da Central de Distribuição.
    if (!conv.assigned_to) await autoAssignConversation(admin, ws.workspace_id, conv.id);
    const media = ["image", "audio", "video", "document", "sticker"].includes(m.type)
      ? m[m.type]
      : null;
    const { error: mErr } = await admin.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      owner_id: ws.workspace_id,
      workspace_id: ws.workspace_id,
      direction: "inbound",
      body,
      from_number: from,
      to_number: ourPhone,
      provider: "meta",
      wa_message_id: m.id,
      context_message_id: m.context?.id ?? null,
      media_content_type: media?.mime_type ?? null,
      status: "received",
      raw: m,
    });
    if (mErr) throw new Retry(mErr.message);
  }
  return workspaceId;
}

async function handleStatuses(admin: Admin, value: any): Promise<string | null> {
  let workspaceId: string | null = null;
  for (const s of value?.statuses ?? []) {
    const { data: msg, error } = await admin
      .from("whatsapp_messages")
      .select("id, status, workspace_id, delivered_at, read_at")
      .eq("wa_message_id", s.id)
      .maybeSingle();
    if (error) throw new Retry(error.message);
    // Status chegou antes do registro do envio: fica pendente para nova tentativa.
    if (!msg) throw new Retry("Mensagem enviada ainda não registrada");
    workspaceId = msg.workspace_id as string;
    const at = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : null;
    const patch: Record<string, unknown> = {};
    if (s.status === "delivered" && !msg.delivered_at && at) patch.delivered_at = at;
    if (s.status === "read" && !msg.read_at && at) patch.read_at = at;
    if (s.errors?.[0]) {
      patch.error_code = String(s.errors[0].code ?? "");
      patch.error_message = s.errors[0].title ?? s.errors[0].message ?? null;
    }
    if (Object.keys(patch).length) {
      const { error: uErr } = await admin.from("whatsapp_messages").update(patch).eq("id", msg.id);
      if (uErr) throw new Retry(uErr.message);
    }
    // Troca de status atômica: só grava se o status atual ainda for inferior,
    // evitando que avisos simultâneos (ex.: "sent" após "delivered") regridam.
    if (shouldApplyStatus(msg.status as string, s.status)) {
      const lower = STATUS_ORDER.filter((st) => shouldApplyStatus(st, s.status));
      const { error: sErr } = await admin
        .from("whatsapp_messages")
        .update({ status: s.status })
        .eq("id", msg.id)
        .or(`status.is.null,status.in.(${lower.join(",")})`);
      if (sErr) throw new Retry(sErr.message);
    }
  }
  return workspaceId;
}

export async function processEvent(admin: Admin, row: EventRow): Promise<boolean> {
  try {
    const value = valueOf(row.payload);
    let ws: string | null = null;
    if (row.event === "whatsapp.message") ws = await handleMessages(admin, value);
    else if (row.event === "whatsapp.status") ws = await handleStatuses(admin, value);
    // Demais eventos ficam guardados e são reconhecidos sem processamento.
    await admin
      .from("whatsapp_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null,
        ...(ws ? { workspace_id: ws } : {}),
      })
      .eq("id", row.id);
    return true;
  } catch (e) {
    const attempts = row.attempts + 1;
    const delayMin = Math.min(60, 2 ** attempts);
    await admin
      .from("whatsapp_webhook_events")
      .update({
        attempts,
        processing_error: (e as Error).message.slice(0, 500),
        next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
      })
      .eq("id", row.id);
    return false;
  }
}

/** Retoma pendências antigas em lote pequeno, por ordem de próxima tentativa. */
export async function processPending(admin: Admin, limit = 10): Promise<void> {
  const { data } = await admin
    .from("whatsapp_webhook_events")
    .select("id, event, payload, attempts")
    .is("processed_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  for (const row of data ?? []) await processEvent(admin, row as EventRow);
}
