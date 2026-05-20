// Engine de análise de sentimento de mensagens (WhatsApp/email/atividades).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

type Pending = {
  source: "whatsapp" | "email" | "activity";
  source_id: string;
  owner_id: string;
  text: string;
  contact_id: string | null;
  lead_id: string | null;
};

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : parseFloat(String(n ?? "0"));
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

async function classify(text: string): Promise<{ label: "positive"|"neutral"|"negative"; score: number; emotion: string | null; keywords: string[] } | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const trimmed = text.slice(0, 2000);
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: `Classifique o sentimento da mensagem. Retorne APENAS JSON: {"label":"positive|neutral|negative","score":-1..1,"emotion":"alegria|raiva|tristeza|medo|surpresa|gratidão|frustração|neutro","keywords":["..."]}` },
        { role: "user", content: trimmed },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^```json|^```|```$/g, "").trim();
  try {
    const p = JSON.parse(raw) as { label?: string; score?: number; emotion?: string; keywords?: unknown };
    const label = (p.label === "positive" || p.label === "negative") ? p.label : "neutral";
    return {
      label,
      score: clampScore(p.score),
      emotion: typeof p.emotion === "string" ? p.emotion.slice(0, 40) : null,
      keywords: Array.isArray(p.keywords) ? p.keywords.map((k) => String(k).slice(0, 60)).slice(0, 10) : [],
    };
  } catch { return null; }
}

async function pickPending(limit: number): Promise<Pending[]> {
  const out: Pending[] = [];
  // WhatsApp inbound recentes
  const { data: wa } = await supabaseAdmin
    .from("whatsapp_messages")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, owner_id, body, direction, from_number, created_at" as any)
    .eq("direction", "inbound")
    .not("body", "is", null)
    .gt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  const waRows = (wa ?? []) as unknown as Array<{ id: string; owner_id: string; body: string | null; from_number: string }>;
  if (waRows.length) {
    const ids = waRows.map((r) => r.id);
    const { data: done } = await supabaseAdmin
      .from("message_sentiments").select("source_id").eq("source", "whatsapp").in("source_id", ids);
    const doneSet = new Set(((done ?? []) as { source_id: string }[]).map((d) => d.source_id));
    const phones = Array.from(new Set(waRows.map((r) => r.from_number).filter(Boolean)));
    const { data: contacts } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("contacts").select("id, owner_id, phone" as any).in("phone", phones);
    const phoneMap = new Map<string, string>();
    for (const c of ((contacts ?? []) as unknown as { id: string; phone: string | null }[])) {
      if (c.phone) phoneMap.set(c.phone, c.id);
    }
    for (const r of waRows) {
      if (doneSet.has(r.id) || !r.body) continue;
      out.push({
        source: "whatsapp",
        source_id: r.id,
        owner_id: r.owner_id,
        text: r.body,
        contact_id: phoneMap.get(r.from_number) ?? null,
        lead_id: null,
      });
    }
  }
  return out.slice(0, limit);
}

export async function tickSentiment(batch = 20): Promise<{ processed: number; errors: number }> {
  const pending = await pickPending(batch);
  let processed = 0, errors = 0;
  for (const p of pending) {
    try {
      const cls = await classify(p.text);
      if (!cls) { errors++; continue; }
      await supabaseAdmin.from("message_sentiments").upsert({
        owner_id: p.owner_id,
        source: p.source,
        source_id: p.source_id,
        contact_id: p.contact_id,
        lead_id: p.lead_id,
        label: cls.label,
        score: cls.score,
        emotion: cls.emotion,
        keywords: cls.keywords,
        model: MODEL,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any, { onConflict: "source,source_id" });
      processed++;
    } catch { errors++; }
  }
  return { processed, errors };
}

export async function analyzeText(text: string) {
  return classify(text);
}
