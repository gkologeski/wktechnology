import { createFileRoute } from "@tanstack/react-router";
import { verifyTwilioSignature } from "@/lib/twilio-signature.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Twilio recording status callback (Release 11).
 *
 * Twilio POSTs this after a dual-channel `<Dial record="…">` recording is
 * completed. We:
 *   1. Verify Twilio signature (HMAC-SHA1) — same as voice webhook.
 *   2. Find the matching `activities` row by parent CallSid (logged by the
 *      browser dialer in `external_ids.twilio_call_sid`).
 *   3. Persist `recording_url`, `recording_sid`, duration, channels.
 *   4. Best-effort: download the recording with the account auth token and
 *      transcribe it via Lovable AI Gateway (Gemini 2.5 flash supports audio
 *      via OpenAI-compatible `input_audio` parts). If transcription fails we
 *      leave `transcription_status = 'failed'` so the UI can show the audio
 *      anyway.
 */
export const Route = createFileRoute("/api/public/twilio/recording-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (!verifyTwilioSignature(request, rawBody)) {
          console.warn("[twilio-recording-status] invalid signature");
          return new Response("Forbidden", { status: 403 });
        }

        const form = new URLSearchParams(rawBody);
        const recordingStatus = form.get("RecordingStatus") ?? "";
        if (recordingStatus !== "completed") {
          return new Response("ignored", { status: 200 });
        }

        // For <Dial record="…">, Twilio sends both CallSid (child leg) and
        // ParentCallSid (the original outbound leg logged by the dialer).
        const parentSid = form.get("ParentCallSid") ?? "";
        const childSid = form.get("CallSid") ?? "";
        const recordingSid = form.get("RecordingSid") ?? "";
        const recordingUrl = form.get("RecordingUrl") ?? "";
        const recordingDuration = parseInt(form.get("RecordingDuration") ?? "0", 10) || null;
        const recordingChannels = parseInt(form.get("RecordingChannels") ?? "0", 10) || null;

        if (!recordingSid || !recordingUrl) {
          return new Response("missing recording fields", { status: 400 });
        }

        // Twilio's RecordingUrl serves WAV (or .mp3 with explicit extension).
        const mp3Url = `${recordingUrl}.mp3`;

        // Find the activities row. Try parent first, then child as fallback.
        const sids = [parentSid, childSid].filter((s) => s.length > 0);
        let activity: { id: string; owner_id: string } | null = null;
        for (const sid of sids) {
          const { data } = await supabaseAdmin
            .from("activities")
            .select("id, owner_id")
            .eq("external_ids->>twilio_call_sid", sid)
            .limit(1)
            .maybeSingle();
          if (data) {
            activity = data;
            break;
          }
        }

        if (!activity) {
          console.warn("[twilio-recording-status] no activity found for sids", sids);
          // 200 so Twilio does not retry forever; we may not have logged the call yet.
          return new Response("no activity", { status: 200 });
        }

        const updates: Record<string, unknown> = {
          recording_url: mp3Url,
          recording_sid: recordingSid,
          recording_duration_seconds: recordingDuration,
          recording_channels: recordingChannels,
          transcription_status: "pending",
        };
        await supabaseAdmin.from("activities").update(updates).eq("id", activity.id);

        // Best-effort transcription. Errors are swallowed and surfaced as
        // transcription_status='failed'.
        try {
          const accountSid = process.env.TWILIO_ACCOUNT_SID;
          const authToken = process.env.TWILIO_AUTH_TOKEN;
          const aiKey = process.env.LOVABLE_API_KEY;
          if (!accountSid || !authToken || !aiKey) {
            throw new Error("missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/LOVABLE_API_KEY");
          }

          const audioRes = await fetch(mp3Url, {
            headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
          });
          if (!audioRes.ok) {
            throw new Error(`Twilio recording fetch failed ${audioRes.status}`);
          }
          const buf = new Uint8Array(await audioRes.arrayBuffer());
          // Inline base64 (chunked to avoid call stack overflows on large recs).
          let bin = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < buf.length; i += CHUNK) {
            bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
          }
          const b64 = btoa(bin);

          const model = "google/gemini-2.5-flash";
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "Você transcreve gravações de ligação em português do Brasil. Retorne APENAS a transcrição com indicação dos falantes (Agente/Cliente quando possível), sem comentários adicionais.",
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Transcreva a ligação abaixo." },
                    {
                      type: "input_audio",
                      input_audio: { data: b64, format: "mp3" },
                    },
                  ],
                },
              ],
              temperature: 0.1,
            }),
          });
          if (!aiRes.ok) {
            const t = await aiRes.text();
            throw new Error(`AI Gateway ${aiRes.status}: ${t.slice(0, 200)}`);
          }
          const j = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
          const text = (j.choices?.[0]?.message?.content ?? "").trim();

          await supabaseAdmin
            .from("activities")
            .update({
              transcription: text || null,
              transcription_status: text ? "completed" : "failed",
              transcription_model: model,
            })
            .eq("id", activity.id);
        } catch (e) {
          console.error("[twilio-recording-status] transcription failed", e);
          await supabaseAdmin
            .from("activities")
            .update({ transcription_status: "failed" })
            .eq("id", activity.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
