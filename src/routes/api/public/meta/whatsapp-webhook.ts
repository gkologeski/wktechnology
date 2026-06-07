// Meta WhatsApp Cloud API webhook.
// Configure in Meta App Dashboard > WhatsApp > Configuration:
//   Callback URL: https://wktechnology.lovable.app/api/public/meta/whatsapp-webhook
//   Verify token: value of META_WHATSAPP_VERIFY_TOKEN
//   Subscribe to: messages, message_template_status_update, phone_number_quality_update, account_update
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";

function verifySig(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(got, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

async function findOrCreateConversation(phoneNumberId: string, displayPhone: string, contactPhone: string, workspaceId: string) {
  // upsert by (contact_phone, twilio_number) — keeps shared inbox compatible.
  const { data } = await supabaseAdmin
    .from("whatsapp_conversations")
    .upsert({
      owner_id: workspaceId,
      workspace_id: workspaceId,
      contact_phone: contactPhone,
      twilio_number: displayPhone,
      wa_phone_number_id: phoneNumberId,
      provider: "meta",
      last_inbound_at: new Date().toISOString(),
    }, { onConflict: "contact_phone,twilio_number" })
    .select("id").single();
  return data?.id as string | undefined;
}

async function handleMessageChange(value: any) {
  const metadata = value?.metadata ?? {};
  const phoneNumberId: string = metadata.phone_number_id;
  const displayPhone: string = metadata.display_phone_number;
  if (!phoneNumberId) return;

  // Resolve workspace from phone_number_id
  const { data: pn } = await supabaseAdmin
    .from("wa_phone_numbers").select("workspace_id, display_phone_number")
    .eq("phone_number_id", phoneNumberId).maybeSingle();
  if (!pn) {
    console.warn("[wa-webhook] phone_number_id not registered", phoneNumberId);
    return;
  }
  const workspaceId = pn.workspace_id as string;

  // Inbound messages
  for (const m of value?.messages ?? []) {
    const from: string = m.from;
    const convId = await findOrCreateConversation(phoneNumberId, displayPhone || pn.display_phone_number, from, workspaceId);
    if (!convId) continue;

    let body: string | null = null;
    let interactiveType: string | null = null;
    if (m.type === "text") body = m.text?.body ?? null;
    else if (m.type === "button") body = m.button?.text ?? null;
    else if (m.type === "interactive") {
      interactiveType = m.interactive?.type ?? null;
      body = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || JSON.stringify(m.interactive);
    } else {
      body = `[${m.type}]`;
    }

    let referralId: string | null = null;
    if (m.referral) {
      const { data: ref } = await supabaseAdmin.from("wa_ad_referrals").insert({
        owner_id: workspaceId, workspace_id: workspaceId,
        conversation_id: convId,
        source_type: m.referral.source_type ?? null,
        source_id: m.referral.source_id ?? null,
        source_url: m.referral.source_url ?? null,
        ctwa_clid: m.referral.ctwa_clid ?? null,
        headline: m.referral.headline ?? null,
        body: m.referral.body ?? null,
        media_type: m.referral.media_type ?? null,
        media_url: m.referral.image_url ?? m.referral.video_url ?? null,
        raw: m.referral,
      }).select("id").single();
      referralId = ref?.id ?? null;
    }

    const { data: inserted } = await supabaseAdmin.from("whatsapp_messages").insert({
      owner_id: workspaceId, workspace_id: workspaceId,
      conversation_id: convId,
      direction: "inbound",
      body,
      from_number: from,
      to_number: displayPhone || pn.display_phone_number,
      wa_message_id: m.id,
      context_message_id: m.context?.id ?? null,
      interactive_type: interactiveType,
      status: "received",
      provider: "meta",
      referral_id: referralId,
      raw: m,
    }).select("id").single();

    if (referralId && inserted?.id) {
      await supabaseAdmin.from("wa_ad_referrals").update({ message_id: inserted.id }).eq("id", referralId);
    }
  }

  // Status updates (sent/delivered/read/failed)
  for (const s of value?.statuses ?? []) {
    const patch: any = { status: s.status };
    if (s.status === "delivered") patch.delivered_at = new Date(Number(s.timestamp) * 1000).toISOString();
    if (s.status === "read") patch.read_at = new Date(Number(s.timestamp) * 1000).toISOString();
    if (s.errors?.[0]) {
      patch.error_code = String(s.errors[0].code ?? "");
      patch.error_message = s.errors[0].title ?? s.errors[0].message ?? null;
    }
    if (s.pricing?.category) patch.pricing_category = s.pricing.category;
    await supabaseAdmin.from("whatsapp_messages").update(patch).eq("wa_message_id", s.id);
  }
}

async function handleTemplateStatus(value: any) {
  const metaId = value?.message_template_id;
  if (!metaId) return;
  await supabaseAdmin.from("wa_templates").update({
    status: value.event ?? value.status,
    rejection_reason: value.reason ?? null,
  }).eq("meta_template_id", String(metaId));
}

async function handleQualityUpdate(value: any) {
  const phoneNumberId = value?.phone_number_id || value?.display_phone_number;
  if (!phoneNumberId) return;
  const patch: any = {};
  if (value.current_quality_rating || value.current_quality) patch.quality_rating = value.current_quality_rating ?? value.current_quality;
  if (value.current_limit || value.new_limit) patch.messaging_limit_tier = value.new_limit ?? value.current_limit;
  if (Object.keys(patch).length) {
    await supabaseAdmin.from("wa_phone_numbers").update(patch).eq("phone_number_id", String(value.phone_number_id));
  }
}

export const Route = createFileRoute("/api/public/meta/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.META_WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        if (!verifySig(raw, sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        let payload: any;
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const field = change.field;
            const value = change.value;
            try {
              if (field === "messages") await handleMessageChange(value);
              else if (field === "message_template_status_update") await handleTemplateStatus(value);
              else if (field === "phone_number_quality_update") await handleQualityUpdate(value);
            } catch (e) {
              console.error("[wa-webhook] handler error", field, e);
            }
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
