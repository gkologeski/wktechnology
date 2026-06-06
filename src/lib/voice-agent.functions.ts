// Voice Agent settings, Vapi phone numbers, ElevenLabs voices.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ELEVEN_BASE = "https://api.elevenlabs.io";
const VAPI_BASE = "https://api.vapi.ai";

// Curated voices (ElevenLabs IDs)
export const CURATED_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
];

export const getVoiceAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data } = await supabaseAdmin
      .from("voice_agent_settings" as never)
      .select("*")
      .eq("workspace_id", ws)
      .maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
  });

const SettingsSchema = z.object({
  vapi_phone_number_id: z.string().nullable().optional(),
  default_voice_id: z.string().nullable().optional(),
  default_voice_provider: z.enum(["elevenlabs", "vapi_default"]).default("elevenlabs"),
  llm_model: z.string().min(1).max(80).default("gpt-4o-mini"),
  language: z.string().min(2).max(20).default("pt-BR"),
  speed: z.number().min(0.5).max(2).default(1.0),
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  first_message: z.string().max(500).nullable().optional(),
  max_duration_seconds: z.number().int().min(30).max(3600).default(600),
});

export const saveVoiceAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SettingsSchema.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const payload = { workspace_id: ws, owner_id: ws, ...data };
    const { error } = await supabaseAdmin
      .from("voice_agent_settings" as never)
      .upsert(payload, { onConflict: "workspace_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVapiPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) throw new Error("VAPI_API_KEY não configurado");
    const res = await fetch(`${VAPI_BASE}/phone-number`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`);
    const arr = (await res.json()) as Array<{ id: string; number?: string; name?: string; provider?: string }>;
    return arr.map((p) => ({ id: p.id, number: p.number ?? "", name: p.name ?? "", provider: p.provider ?? "" }));
  });

export const listElevenLabsVoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurado");
    const res = await fetch(`${ELEVEN_BASE}/v1/voices`, { headers: { "xi-api-key": apiKey } });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const json = (await res.json()) as { voices: Array<{ voice_id: string; name: string; category?: string }> };
    return json.voices.map((v) => ({ id: v.voice_id, name: v.name, category: v.category ?? "premade" }));
  });

const PreviewSchema = z.object({
  text: z.string().min(1).max(500),
  voice_id: z.string().min(1).max(64),
});

export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PreviewSchema.parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurado");
    const res = await fetch(
      `${ELEVEN_BASE}/v1/text-to-speech/${data.voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
        }),
      },
    );
    if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
    const buf = await res.arrayBuffer();
    return { audio_base64: Buffer.from(buf).toString("base64") };
  });
