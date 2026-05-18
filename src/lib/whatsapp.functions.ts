import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
// Twilio Sandbox padrão. Para produção: salvar em integrations(provider='twilio_whatsapp').config.from_number
const SANDBOX_FROM = "whatsapp:+14155238886";

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

async function resolveFromNumber(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("owner_id", userId)
    .eq("provider", "twilio_whatsapp")
    .maybeSingle();
  const cfg = (data?.config ?? {}) as { from_number?: string };
  return cfg.from_number ? toWa(cfg.from_number) : SANDBOX_FROM;
}

// ---------- send ----------
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        to: z.string().min(5),
        body: z.string().min(1).max(1600),
        contactId: z.string().uuid().optional(),
        mediaUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const from = await resolveFromNumber(supabase, userId);
    const toWaNum = toWa(data.to);
    const toBare = normalizePhone(data.to);
    const fromBare = from.replace(/^whatsapp:/, "");

    const params = new URLSearchParams({ From: from, To: toWaNum, Body: data.body });
    if (data.mediaUrl) params.set("MediaUrl", data.mediaUrl);

    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: twilioHeaders(),
      body: params,
    });
    const tw = await res.json();
    if (!res.ok) {
      throw new Error(`Twilio erro [${res.status}]: ${tw?.message ?? JSON.stringify(tw)}`);
    }

    // upsert conversation
    const { data: conv, error: cErr } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: userId,
          contact_id: data.contactId ?? null,
          contact_phone: toBare,
          twilio_number: fromBare,
          last_message_at: new Date().toISOString(),
          last_message_preview: data.body.slice(0, 120),
        },
        { onConflict: "contact_phone,twilio_number" },
      )
      .select("id")
      .single();
    if (cErr) throw cErr;

    const { error: mErr } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      owner_id: userId,
      direction: "outbound",
      body: data.body,
      media_url: data.mediaUrl ?? null,
      from_number: fromBare,
      to_number: toBare,
      twilio_sid: tw.sid,
      status: tw.status ?? "queued",
      sent_by: userId,
      sent_at: new Date().toISOString(),
      raw: tw,
    });
    if (mErr) throw mErr;

    return { ok: true, sid: tw.sid as string, conversationId: conv.id as string };
  });

// ---------- list conversations ----------
export const listWhatsAppConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("id, contact_id, contact_phone, twilio_number, last_message_at, last_message_preview, unread_count, status")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ---------- list messages ----------
export const listWhatsAppMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, body, media_url, status, created_at, sent_at, delivered_at, read_at, twilio_sid")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return rows ?? [];
  });

// ---------- mark conversation read ----------
export const markWhatsAppRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- get/save sender config ----------
export const getWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("integrations")
      .select("config, status")
      .eq("owner_id", userId)
      .eq("provider", "twilio_whatsapp")
      .maybeSingle();
    const cfg = (data?.config ?? {}) as { from_number?: string };
    return {
      from_number: cfg.from_number ?? "",
      effective_from: cfg.from_number ? normalizePhone(cfg.from_number) : SANDBOX_FROM.replace("whatsapp:", ""),
      using_sandbox: !cfg.from_number,
    };
  });

export const saveWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ from_number: z.string().min(0).max(32) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const from = data.from_number.trim();
    const { error } = await supabase.from("integrations").upsert(
      {
        owner_id: userId,
        provider: "twilio_whatsapp",
        status: from ? "connected" : "pending",
        config: from ? { from_number: normalizePhone(from) } : {},
      },
      { onConflict: "owner_id,provider" },
    );
    if (error) throw error;
    return { ok: true };
  });
