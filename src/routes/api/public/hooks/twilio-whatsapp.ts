// Webhook que o Twilio chama quando chega mensagem WhatsApp.
// Configure no Twilio Console > Messaging > Sandbox/Sender > "When a message comes in":
//   https://wktechnology.lovable.app/api/public/hooks/twilio-whatsapp  (POST)
// (Pode ser testado via sandbox antes de número de produção.)
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTwilioSignature } from "@/lib/twilio-signature.server";

function strip(s: string | null | undefined) {
  return (s ?? "").replace(/^whatsapp:/, "");
}

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("amr")) return "amr";
  if (m.includes("wav")) return "wav";
  const sub = m.split("/")[1];
  return (sub || "bin").split(";")[0];
}

// Twilio media URLs require Basic Auth. Refazemos o download via gateway (que cuida da auth)
// e republicamos no bucket público whatsapp-media para podermos exibir e reaproveitar.
async function rehostTwilioMedia(
  mediaUrl: string,
  mime: string | null,
  ownerId: string,
  messageSid: string | null,
): Promise<string | null> {
  try {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) return mediaUrl;

    // mediaUrl: https://api.twilio.com/2010-04-01/Accounts/AC.../Messages/MM.../Media/ME...
    const match = mediaUrl.match(/\/Messages\/[^/]+\/Media\/[^/?]+/);
    if (!match) return mediaUrl;
    const gatewayPath = match[0]; // /Messages/.../Media/...

    const res = await fetch(`${TWILIO_GATEWAY}${gatewayPath}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
      },
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn("[twilio-media] download falhou", res.status);
      return mediaUrl;
    }
    const contentType = res.headers.get("content-type") || mime || "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    const ext = extFromMime(contentType);
    const path = `${ownerId}/in/${messageSid ?? crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("whatsapp-media")
      .upload(path, buf, { contentType, upsert: true });
    if (error) {
      console.warn("[twilio-media] upload bucket falhou", error.message);
      return mediaUrl;
    }
    const { data: pub } = supabaseAdmin.storage.from("whatsapp-media").getPublicUrl(path);
    return pub.publicUrl;
  } catch (e) {
    console.warn("[twilio-media] erro rehost", e);
    return mediaUrl;
  }
}

export const Route = createFileRoute("/api/public/hooks/twilio-whatsapp")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, info: "POST Twilio webhooks here" }),
      POST: async ({ request }) => {
        try {
          const text = await request.text();
          if (!verifyTwilioSignature(request, text)) {
            console.warn("[twilio-whatsapp] invalid signature");
            return new Response("Forbidden", { status: 403 });
          }
          const params = new URLSearchParams(text);
          const data = Object.fromEntries(params.entries());

          const from = strip(data.From); // contato
          const to = strip(data.To); // nosso número Twilio
          const body = data.Body ?? "";
          const sid = data.MessageSid ?? data.SmsMessageSid ?? null;
          const numMedia = Number(data.NumMedia ?? "0") || 0;
          const mediaUrl = numMedia > 0 ? data.MediaUrl0 : null;
          const mediaType = numMedia > 0 ? data.MediaContentType0 : null;

          if (!from || !to) {
            return new Response("missing From/To", { status: 400 });
          }

          // Descobrir owner: 1) integrações configuradas com esse from_number,
          // 2) senão contato com esse phone, 3) fallback: ignora.
          let ownerId: string | null = null;
          let contactId: string | null = null;

          const { data: integ } = await supabaseAdmin
            .from("integrations")
            .select("owner_id")
            .eq("provider", "twilio_whatsapp")
            .contains("config", { from_number: to })
            .maybeSingle();
          if (integ?.owner_id) ownerId = integ.owner_id;

          // tenta achar contato por telefone (com ou sem +)
          const phoneNoPlus = from.replace(/^\+/, "");
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select("id, owner_id")
            .or(
              `phone.eq.${from},phone.eq.${phoneNoPlus},mobile_phone.eq.${from},mobile_phone.eq.${phoneNoPlus}`,
            )
            .maybeSingle();
          if (contact) {
            contactId = contact.id;
            if (!ownerId) ownerId = contact.owner_id;
          }

          if (!ownerId) {
            // Sandbox: se ninguém configurou, atribui ao primeiro perfil (útil para testes solo)
            const { data: p } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            ownerId = p?.id ?? null;
          }

          if (!ownerId) {
            console.warn("[twilio-whatsapp] sem owner para mensagem de", from);
            return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
          }

          // Rehost de mídia para nosso bucket público
          let finalMediaUrl = mediaUrl;
          if (mediaUrl) {
            finalMediaUrl = await rehostTwilioMedia(mediaUrl, mediaType, ownerId, sid);
          }

          // upsert conversa
          const { data: conv, error: cErr } = await supabaseAdmin
            .from("whatsapp_conversations")
            .upsert(
              {
                owner_id: ownerId,
                contact_id: contactId,
                contact_phone: from,
                twilio_number: to,
                last_message_at: new Date().toISOString(),
                last_message_preview: body.slice(0, 120) || (finalMediaUrl ? "[mídia]" : ""),
              },
              { onConflict: "contact_phone,twilio_number" },
            )
            .select("id, unread_count")
            .single();
          if (cErr) throw cErr;

          await supabaseAdmin
            .from("whatsapp_conversations")
            .update({ unread_count: (conv.unread_count ?? 0) + 1 })
            .eq("id", conv.id);

          await supabaseAdmin.from("whatsapp_messages").insert({
            conversation_id: conv.id,
            owner_id: ownerId,
            direction: "inbound",
            body,
            media_url: finalMediaUrl,
            media_content_type: mediaType,
            from_number: from,
            to_number: to,
            twilio_sid: sid,
            status: "received",
            raw: data,
          });

          // Atividade na timeline do contato (se vinculado)
          if (contactId) {
            await supabaseAdmin.from("activities").insert({
              owner_id: ownerId,
              type: "whatsapp",
              related_contact_id: contactId,
              subject: "WhatsApp recebido",
              body: body || (mediaUrl ? "[mídia]" : ""),
              email_direction: "inbound",
              completed: true,
              outcome: "received",
              outcome_set_at: new Date().toISOString(),
              external_ids: { twilio_sid: sid, conversation_id: conv.id },
            });
          }

          // resposta TwiML vazia = sem auto-reply
          return new Response("<Response/>", {
            headers: { "Content-Type": "text/xml" },
          });
        } catch (e) {
          console.error("[twilio-whatsapp] erro", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
