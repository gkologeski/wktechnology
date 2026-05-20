import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITY = z.enum(["lead", "contact", "deal", "ticket"]);
const KIND = z.enum(["conversation", "call"]);

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Msg = {
  at: string;
  channel: string;
  direction: "in" | "out" | "internal";
  who: string;
  text: string;
};

const RELATED_KEY: Record<z.infer<typeof ENTITY>, string> = {
  lead: "related_lead_id",
  contact: "related_contact_id",
  deal: "related_deal_id",
  ticket: "related_ticket_id",
};

async function resolveContactId(
  supabase: any,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
): Promise<string | null> {
  if (entity === "contact") return entityId;
  if (entity === "deal") {
    const { data } = await supabase
      .from("deals").select("primary_contact_id").eq("id", entityId).maybeSingle();
    return data?.primary_contact_id ?? null;
  }
  if (entity === "ticket") {
    const { data } = await supabase
      .from("tickets").select("contact_id").eq("id", entityId).maybeSingle();
    return data?.contact_id ?? null;
  }
  // lead → try matching contact by email
  const { data: lead } = await supabase
    .from("leads").select("email, converted_contact_id").eq("id", entityId).maybeSingle();
  if (lead?.converted_contact_id) return lead.converted_contact_id;
  if (lead?.email) {
    const { data: c } = await supabase
      .from("contacts").select("id").eq("email", lead.email).maybeSingle();
    return c?.id ?? null;
  }
  return null;
}

async function collectMessages(
  supabase: any,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  kind: z.infer<typeof KIND>,
  windowDays: number,
): Promise<Msg[]> {
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
  const msgs: Msg[] = [];

  // Activities (notes, emails, calls, meetings, tasks)
  const relCol = RELATED_KEY[entity];
  let actQuery = supabase
    .from("activities")
    .select("id, type, subject, body, created_at, due_date, call_outcome, call_duration_seconds")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);
  if (relCol) actQuery = actQuery.eq(relCol, entityId);
  const { data: acts } = await actQuery;
  for (const a of (acts ?? []) as any[]) {
    if (kind === "call" && a.type !== "call" && a.type !== "meeting") continue;
    const body = [a.subject, a.body].filter(Boolean).join(" — ");
    if (!body) continue;
    msgs.push({
      at: a.created_at,
      channel: a.type,
      direction: "internal",
      who: a.type === "call" ? `Call (${a.call_outcome ?? "—"})` : a.type,
      text: a.type === "call" && a.call_duration_seconds
        ? `${body} [${Math.round(a.call_duration_seconds / 60)} min]`
        : body,
    });
  }

  if (kind === "conversation") {
    // WhatsApp messages via contact
    const contactId = await resolveContactId(supabase, entity, entityId);
    if (contactId) {
      const { data: wa } = await supabase
        .from("whatsapp_messages")
        .select("direction, body, created_at, conversation_id, whatsapp_conversations!inner(contact_id)")
        .eq("whatsapp_conversations.contact_id", contactId)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(300);
      for (const m of (wa ?? []) as any[]) {
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

  msgs.sort((a, b) => (a.at < b.at ? -1 : 1));
  return msgs;
}

function buildPrompt(msgs: Msg[], kind: z.infer<typeof KIND>): string {
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

type AiResult = {
  summary: string;
  key_points: string[];
  next_actions: string[];
  sentiment: string;
};

async function callAi(prompt: string, model: string): Promise<AiResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Responda apenas com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
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

export const generateAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      entity: ENTITY,
      entity_id: z.string().uuid(),
      kind: KIND.default("conversation"),
      window_days: z.number().int().min(1).max(180).default(60),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const msgs = await collectMessages(supabase, data.entity, data.entity_id, data.kind, data.window_days);
    if (msgs.length === 0) {
      throw new Error("Sem mensagens suficientes nos últimos " + data.window_days + " dias para resumir.");
    }
    const prompt = buildPrompt(msgs, data.kind);
    const ai = await callAi(prompt, DEFAULT_MODEL);
    const windowFrom = msgs[0].at;
    const windowTo = msgs[msgs.length - 1].at;
    const { data: row, error } = await supabase.from("ai_summaries").insert({
      owner_id: userId,
      entity: data.entity,
      entity_id: data.entity_id,
      kind: data.kind,
      summary: ai.summary,
      key_points: ai.key_points,
      next_actions: ai.next_actions,
      sentiment: ai.sentiment,
      model: DEFAULT_MODEL,
      window_from: windowFrom,
      window_to: windowTo,
      source_count: msgs.length,
    }).select("*").single();
    if (error) throw error;
    return row;
  });

export const listAiSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      entity: ENTITY,
      entity_id: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(10),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("entity", data.entity)
      .eq("entity_id", data.entity_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });

export const deleteAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("ai_summaries").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
