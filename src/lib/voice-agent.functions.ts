// Voice Agent settings, Vapi phone numbers, ElevenLabs voices.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const ELEVEN_BASE = "https://api.elevenlabs.io";
const VAPI_BASE = "https://api.vapi.ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

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

export type VoiceAgentSettings = {
  vapi_phone_number_id: string | null;
  default_voice_id: string | null;
  default_voice_provider: "elevenlabs" | "vapi_default";
  llm_model: string;
  language: string;
  speed: number;
  stability: number;
  similarity_boost: number;
  first_message: string | null;
  max_duration_seconds: number;
} | null;

export const getVoiceAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VoiceAgentSettings> => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data } = await sb
      .from("voice_agent_settings")
      .select("*")
      .eq("workspace_id", ws)
      .maybeSingle();
    return (data ?? null) as VoiceAgentSettings;
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
    const { error } = await sb
      .from("voice_agent_settings")
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
    const arr = (await res.json()) as Array<{
      id: string;
      number?: string;
      name?: string;
      provider?: string;
    }>;
    return arr.map((p) => ({
      id: p.id,
      number: p.number ?? "",
      name: p.name ?? "",
      provider: p.provider ?? "",
    }));
  });

type ElevenVoice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string> | null;
  verified_languages?: Array<{ language?: string; accent?: string }> | null;
  fine_tuning?: { language?: string | null } | null;
  language?: string | null;
};

function isPortugueseVoice(v: ElevenVoice): boolean {
  const langLabel = (v.labels?.language ?? "").toLowerCase();
  const accentLabel = (v.labels?.accent ?? "").toLowerCase();
  const ftLang = (v.fine_tuning?.language ?? "").toLowerCase();
  const topLang = (v.language ?? "").toLowerCase();
  const verified = (v.verified_languages ?? []).some((x) =>
    (x.language ?? "").toLowerCase().startsWith("pt"),
  );
  return (
    verified ||
    langLabel.startsWith("pt") ||
    langLabel.includes("portuguese") ||
    langLabel.includes("português") ||
    accentLabel.includes("brazil") ||
    accentLabel.includes("brasil") ||
    ftLang.startsWith("pt") ||
    topLang.startsWith("pt")
  );
}

export const listElevenLabsVoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { onlyPortuguese?: boolean } | undefined) => i ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY não configurado");

    // 1) Vozes da conta do usuário
    const ownRes = await fetch(`${ELEVEN_BASE}/v1/voices`, { headers: { "xi-api-key": apiKey } });
    if (!ownRes.ok) throw new Error(`ElevenLabs ${ownRes.status}`);
    const ownJson = (await ownRes.json()) as { voices: ElevenVoice[] };
    const own = ownJson.voices ?? [];

    // 2) Voice Library pública (pt) — para usuários que ainda não adicionaram nenhuma
    let shared: ElevenVoice[] = [];
    try {
      const sharedRes = await fetch(`${ELEVEN_BASE}/v1/shared-voices?language=pt&page_size=100`, {
        headers: { "xi-api-key": apiKey },
      });
      if (sharedRes.ok) {
        const sj = (await sharedRes.json()) as { voices: Array<ElevenVoice & { accent?: string }> };
        shared = (sj.voices ?? []).map((v) => ({
          ...v,
          category: "library",
          labels: { ...(v.labels ?? {}), language: "pt", accent: v.accent ?? "" },
        }));
      }
    } catch {
      // best-effort; ignore shared library errors
    }

    // Mescla e dedup por voice_id
    const seen = new Set<string>();
    const all = [...own, ...shared].filter((v) => {
      if (seen.has(v.voice_id)) return false;
      seen.add(v.voice_id);
      return true;
    });

    const filtered = data.onlyPortuguese ? all.filter(isPortugueseVoice) : all;

    return filtered.map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category ?? "premade",
      accent: v.labels?.accent ?? "",
    }));
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
