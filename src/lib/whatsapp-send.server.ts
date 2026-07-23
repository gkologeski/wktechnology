// Envio de WhatsApp para uso em contextos server-only (cron, régua de cobrança).
// Reaproveita a mesma infra Twilio de `whatsapp.functions.ts`, porém sem
// depender de um usuário autenticado.
import type { SupabaseClient } from "@supabase/supabase-js";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const SANDBOX_FROM = "whatsapp:+14155238886";
const DEFAULT_PUBLIC_BASE = "https://app.wktechnology.com.br";

function twilioHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!TWILIO_API_KEY) throw new Error("Conecte o Twilio para enviar WhatsApp");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function toWa(phone: string): string {
  const p = normalizePhone(phone);
  return p.startsWith("whatsapp:") ? p : `whatsapp:${p}`;
}

async function loadWaConfig(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("owner_id", workspaceId)
    .eq("provider", "twilio_whatsapp")
    .maybeSingle();
  const cfg = (data?.config ?? {}) as {
    from_number?: string;
    public_base_url?: string;
  };
  const from = cfg.from_number ? toWa(cfg.from_number) : SANDBOX_FROM;
  const publicBase = (cfg.public_base_url || DEFAULT_PUBLIC_BASE).replace(/\/$/, "");
  return { from, publicBase };
}

export type WaSendResult = {
  ok: true;
  sid: string;
  status: string;
  from: string;
  to: string;
};

/**
 * Envia uma mensagem de WhatsApp texto para o número informado.
 * Registra `whatsapp_conversations` + `whatsapp_messages` no workspace.
 * Lança erro em falhas — cabe ao chamador tratar e registrar no histórico.
 */
export async function sendWhatsAppFromServer(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  to: string;
  body: string;
  contactId?: string | null;
  templateName?: string | null;
  source?: Record<string, unknown>;
}): Promise<WaSendResult> {
  const { supabase, workspaceId, to, body } = params;
  if (!to || !body) throw new Error("Destinatário ou mensagem vazios");

  const { from, publicBase } = await loadWaConfig(supabase, workspaceId);
  const toWaNum = toWa(to);
  const toBare = normalizePhone(to);
  const fromBare = from.replace(/^whatsapp:/, "");

  const search = new URLSearchParams({
    From: from,
    To: toWaNum,
    Body: body,
    StatusCallback: `${publicBase}/api/public/hooks/twilio-whatsapp-status`,
  });

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: twilioHeaders(),
    body: search,
  });
  const tw = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
    code?: number;
  };
  if (!res.ok) {
    throw new Error(`Twilio erro [${res.status}]: ${tw?.message ?? JSON.stringify(tw)}`);
  }

  // Log da conversa + mensagem (best-effort; falhas não invalidam o envio real)
  try {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: workspaceId,
          contact_id: params.contactId ?? null,
          contact_phone: toBare,
          twilio_number: fromBare,
          last_message_at: new Date().toISOString(),
          last_message_preview: body.slice(0, 120),
        },
        { onConflict: "contact_phone,twilio_number" },
      )
      .select("id")
      .single();

    if (conv?.id) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conv.id,
        owner_id: workspaceId,
        direction: "outbound",
        body,
        from_number: fromBare,
        to_number: toBare,
        twilio_sid: tw.sid,
        status: tw.status ?? "queued",
        template_name: params.templateName ?? null,
        is_template: !!params.templateName,
        sent_at: new Date().toISOString(),
        raw: { ...tw, source: params.source ?? { origin: "dunning" } },
      });
    }
  } catch (e) {
    console.warn("[whatsapp-send] log falhou (envio ok)", e);
  }

  return {
    ok: true,
    sid: tw.sid ?? "",
    status: tw.status ?? "queued",
    from: fromBare,
    to: toBare,
  };
}
