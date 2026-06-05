// Engine que gera AI summaries automaticamente após nova atividade.
// Roda via cron tick. Detecta entidades com atividades novas desde o último
// summary e dispara geração com debounce.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Entity = "lead" | "contact" | "deal" | "ticket";
type Kind = "conversation" | "call";

type Msg = {
  at: string;
  channel: string;
  direction: "in" | "out" | "internal";
  who: string;
  text: string;
};

const RELATED_KEY: Partial<Record<Entity, string>> = {
  lead: "related_lead_id",
  contact: "related_contact_id",
  deal: "related_deal_id",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveContactId(entity: Entity, entityId: string): Promise<string | null> {
  if (entity === "contact") return entityId;
  if (entity === "deal") {
    const { data } = await supabaseAdmin
      .from("deals").select("primary_contact_id").eq("id", entityId).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.primary_contact_id ?? null;
  }
  if (entity === "ticket") {
    const { data } = await supabaseAdmin
      .from("tickets").select("contact_id").eq("id", entityId).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.contact_id ?? null;
  }
  const { data: lead } = await supabaseAdmin
    .from("leads").select("email, converted_contact_id").eq("id", entityId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = lead as any;
  if (l?.converted_contact_id) return l.converted_contact_id;
  if (l?.email) {
    const { data: c } = await supabaseAdmin
      .from("contacts").select("id").eq("email", l.email).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (c as any)?.id ?? null;
  }
  return null;
}

async function collectMessages(
  entity: Entity,
  entityId: string,
  kind: Kind,
  windowDays: number,
): Promise<Msg[]> {
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
  const msgs: Msg[] = [];
  const relCol = RELATED_KEY[entity];
  let q = supabaseAdmin
    .from("activities")
    .select("id, type, subject, body, created_at, outcome, duration_ms")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);
  if (relCol) {
    q = q.eq(relCol, entityId);
  } else {
    const cid = await resolveContactId(entity, entityId);
    if (!cid) return msgs;
    q = q.eq("related_contact_id", cid);
  }
  const { data: acts } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of ((acts ?? []) as any[])) {
    if (kind === "call" && a.type !== "call" && a.type !== "meeting") continue;
    const body = [a.subject, a.body].filter(Boolean).join(" — ");
    if (!body) continue;
    const minutes = a.duration_ms ? Math.round(a.duration_ms / 60000) : null;
    msgs.push({
      at: a.created_at,
      channel: a.type,
      direction: "internal",
      who: a.type === "call" ? `Call (${a.outcome ?? "—"})` : a.type,
      text: minutes ? `${body} [${minutes} min]` : body,
    });
  }
  if (kind === "conversation") {
    const contactId = await resolveContactId(entity, entityId);
    if (contactId) {
      const { data: convs } = await supabaseAdmin
        .from("whatsapp_conversations").select("id").eq("contact_id", contactId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convIds = ((convs ?? []) as any[]).map((c) => c.id);
      if (convIds.length > 0) {
        const { data: wa } = await supabaseAdmin
          .from("whatsapp_messages")
          .select("direction, body, created_at")
          .in("conversation_id", convIds)
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(300);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const m of ((wa ?? []) as any[])) {
          if (!m.body) continue;
          msgs.push({
            at: m.created_at,
            channel: "whatsapp",
            direction: m.direction === "inbound" ? "in" : "out",
            who: m.direction === "inbound" ? "Cliente" : "Atendente",
            text: m.body,
          });
        }
      }
    }
  }
  msgs.sort((a, b) => (a.at < b.at ? -1 : 1));
  return msgs;
}

function buildPrompt(msgs: Msg[], kind: Kind): string {
  const lines = msgs.map((m) =>
    `[${new Date(m.at).toLocaleString("pt-BR")}] (${m.channel}/${m.direction}) ${m.who}: ${m.text.slice(0, 800)}`
  );
  const header = kind === "call"
    ? "Você é um analista de vendas. Resuma as ligações/reuniões abaixo."
    : "Você é um analista de vendas. Resuma a conversa multi-canal abaixo.";
  return `${header}
Responda APENAS em JSON válido com este schema:
{
  "summary": "parágrafo curto em português (até 4 linhas)",
  "key_points": ["bullets curtos"],
  "next_actions": ["próximos passos sugeridos"],
  "sentiment": "positivo|neutro|negativo"
}

Mensagens (ordem cronológica):
${lines.join("\n")}`;
}

async function callAi(prompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Responda apenas com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`AI Gateway ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = {};
  try { parsed = JSON.parse(jsonStr); } catch {
    parsed = { summary: raw.slice(0, 600), key_points: [], next_actions: [], sentiment: "neutro" };
  }
  return {
    summary: String(parsed.summary ?? "").slice(0, 4000),
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 12).map(String) : [],
    next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 12).map(String) : [],
    sentiment: String(parsed.sentiment ?? "neutro"),
  };
}

type Candidate = {
  owner_id: string;
  entity: Entity;
  entity_id: string;
  last_activity_at: string;
};

// Encontra entidades com nova atividade recente (últimos N dias) cuja
// atividade mais nova é posterior ao último summary existente (ou sem summary).
async function findCandidates(lookbackHours: number, limit: number): Promise<Candidate[]> {
  const sinceIso = new Date(Date.now() - lookbackHours * 3600_000).toISOString();
  const { data: acts } = await supabaseAdmin
    .from("activities")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("owner_id, related_lead_id, related_contact_id, related_deal_id, created_at" as any)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  const seen = new Map<string, Candidate>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of ((acts ?? []) as any[])) {
    const pairs: Array<[Entity, string | null]> = [
      ["lead", a.related_lead_id],
      ["contact", a.related_contact_id],
      ["deal", a.related_deal_id],
    ];
    for (const [entity, id] of pairs) {
      if (!id) continue;
      const key = `${entity}:${id}`;
      if (seen.has(key)) continue;
      seen.set(key, { owner_id: a.owner_id, entity, entity_id: id, last_activity_at: a.created_at });
      if (seen.size >= limit * 4) break;
    }
  }
  const out: Candidate[] = [];
  for (const c of seen.values()) {
    const { data: last } = await supabaseAdmin
      .from("ai_summaries")
      .select("created_at")
      .eq("entity", c.entity)
      .eq("entity_id", c.entity_id)
      .eq("kind", "conversation")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastAt = (last as any)?.created_at as string | undefined;
    if (lastAt && new Date(lastAt) >= new Date(c.last_activity_at)) continue;
    // debounce: evita re-sumarizar dentro de 30 min
    if (lastAt && Date.now() - new Date(lastAt).getTime() < 30 * 60_000) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

async function summarizeOne(c: Candidate): Promise<"ok" | "skipped" | "error"> {
  try {
    const msgs = await collectMessages(c.entity, c.entity_id, "conversation", 60);
    if (msgs.length === 0) return "skipped";
    const prompt = buildPrompt(msgs, "conversation");
    const ai = await callAi(prompt);
    const { error } = await supabaseAdmin.from("ai_summaries").insert({
      owner_id: c.owner_id,
      entity: c.entity,
      entity_id: c.entity_id,
      kind: "conversation",
      summary: ai.summary,
      key_points: ai.key_points,
      next_actions: ai.next_actions,
      sentiment: ai.sentiment,
      model: MODEL,
      window_from: msgs[0].at,
      window_to: msgs[msgs.length - 1].at,
      source_count: msgs.length,
    });
    if (error) throw error;
    return "ok";
  } catch (e) {
    console.error("[ai-summary-tick] summarizeOne error", c, e);
    return "error";
  }
}

export async function tickAiSummaries(batch = 10, lookbackHours = 6): Promise<{
  processed: number; skipped: number; errors: number; candidates: number;
}> {
  const cands = await findCandidates(lookbackHours, batch);
  let processed = 0, skipped = 0, errors = 0;
  for (const c of cands) {
    const r = await summarizeOne(c);
    if (r === "ok") processed++;
    else if (r === "skipped") skipped++;
    else errors++;
  }
  return { processed, skipped, errors, candidates: cands.length };
}
