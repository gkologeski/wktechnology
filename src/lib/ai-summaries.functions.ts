import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITY = z.enum(["lead", "contact", "deal", "ticket"]);
const KIND = z.enum(["conversation", "call", "meeting", "email", "notes", "tasks", "all"]);

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const MAX_MSGS = 400;

type Msg = {
  at: string;
  channel: string;
  direction: "in" | "out" | "internal";
  who: string;
  text: string;
};

const RELATED_KEY: Partial<Record<z.infer<typeof ENTITY>, string>> = {
  lead: "related_lead_id",
  contact: "related_contact_id",
  deal: "related_deal_id",
  ticket: "related_ticket_id",
};

const MEETING_KEY: Partial<Record<z.infer<typeof ENTITY>, string>> = {
  lead: "related_lead_id",
  contact: "related_contact_id",
  deal: "related_deal_id",
  ticket: "related_ticket_id",
};

const THREAD_KEY: Partial<Record<z.infer<typeof ENTITY>, string>> = {
  lead: "lead_id",
  contact: "contact_id",
  deal: "deal_id",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function resolveContactId(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
): Promise<string | null> {
  if (entity === "contact") return entityId;
  if (entity === "deal") {
    const { data } = await supabase
      .from("deals")
      .select("primary_contact_id")
      .eq("id", entityId)
      .maybeSingle();
    return data?.primary_contact_id ?? null;
  }
  if (entity === "ticket") {
    const { data } = await supabase
      .from("tickets")
      .select("contact_id")
      .eq("id", entityId)
      .maybeSingle();
    return data?.contact_id ?? null;
  }
  const { data: lead } = await supabase
    .from("leads")
    .select("email, converted_contact_id")
    .eq("id", entityId)
    .maybeSingle();
  if (lead?.converted_contact_id) return lead.converted_contact_id;
  if (lead?.email) {
    const { data: c } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", lead.email)
      .maybeSingle();
    return c?.id ?? null;
  }
  return null;
}

function kindWantsActivityTypes(kind: z.infer<typeof KIND>): string[] | null {
  switch (kind) {
    case "call":
      return ["call"];
    case "meeting":
      return ["meeting"];
    case "email":
      return ["email"];
    case "notes":
      return ["note"];
    case "tasks":
      return ["task"];
    case "conversation":
      return ["call", "meeting", "email", "note"];
    case "all":
      return null; // all types
  }
  return null;
}

async function collectFromActivities(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  kind: z.infer<typeof KIND>,
  since: string,
): Promise<Msg[]> {
  const msgs: Msg[] = [];
  const relCol = RELATED_KEY[entity];
  let q = supabase
    .from("activities")
    .select(
      "id, type, subject, body, created_at, due_date, outcome, duration_ms, transcription, recording_url, meeting_outcome",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_MSGS);
  if (relCol) q = q.eq(relCol, entityId);
  else {
    const cid = await resolveContactId(supabase, entity, entityId);
    if (!cid) return msgs;
    q = q.eq("related_contact_id", cid);
  }
  const wanted = kindWantsActivityTypes(kind);
  const { data: acts } = await q;
  for (const a of (acts ?? []) as SB[]) {
    if (wanted && !wanted.includes(a.type)) continue;
    const parts = [a.subject, a.body, a.transcription].filter(Boolean);
    if (parts.length === 0) continue;
    const minutes = a.duration_ms ? Math.round(a.duration_ms / 60000) : null;
    const label =
      a.type === "call"
        ? `Call (${a.outcome ?? "—"})`
        : a.type === "meeting"
          ? `Reunião (${a.meeting_outcome ?? "—"})`
          : a.type === "email"
            ? "E-mail"
            : a.type === "note"
              ? "Nota"
              : a.type === "task"
                ? "Task"
                : String(a.type);
    msgs.push({
      at: a.created_at,
      channel: a.type,
      direction: "internal",
      who: label,
      text: minutes ? `${parts.join(" — ")} [${minutes} min]` : parts.join(" — "),
    });
  }
  return msgs;
}

async function collectFromMeetings(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  since: string,
): Promise<Msg[]> {
  const msgs: Msg[] = [];
  const relCol = MEETING_KEY[entity];
  if (!relCol) return msgs;
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, started_at, ended_at, created_at, recording_duration_seconds")
    .eq(relCol, entityId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(100);
  const ids = (meetings ?? []).map((m: SB) => m.id);
  if (ids.length === 0) return msgs;
  const { data: sums } = await supabase
    .from("meeting_summaries")
    .select("meeting_id, summary, decisions, action_items, transcript, sentiment, created_at")
    .in("meeting_id", ids);
  const byMeeting = new Map<string, SB>();
  for (const s of (sums ?? []) as SB[]) byMeeting.set(s.meeting_id, s);
  for (const m of (meetings ?? []) as SB[]) {
    const s = byMeeting.get(m.id);
    const parts: string[] = [];
    if (m.title) parts.push(`Reunião: ${m.title}`);
    if (s?.summary) parts.push(`Resumo: ${s.summary}`);
    if (Array.isArray(s?.decisions) && s.decisions.length)
      parts.push(`Decisões: ${s.decisions.join("; ")}`);
    if (Array.isArray(s?.action_items) && s.action_items.length)
      parts.push(
        `Ações: ${s.action_items.map((a: SB) => (typeof a === "string" ? a : JSON.stringify(a))).join("; ")}`,
      );
    if (s?.transcript) parts.push(`Transcrição: ${String(s.transcript).slice(0, 4000)}`);
    if (parts.length === 0) continue;
    const minutes = m.recording_duration_seconds
      ? Math.round(m.recording_duration_seconds / 60)
      : null;
    msgs.push({
      at: m.started_at ?? m.created_at,
      channel: "meeting",
      direction: "internal",
      who: minutes ? `Reunião gravada [${minutes} min]` : "Reunião",
      text: parts.join(" — "),
    });
  }
  return msgs;
}

async function collectFromEmails(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  since: string,
): Promise<Msg[]> {
  const msgs: Msg[] = [];
  const threadCol = THREAD_KEY[entity];
  let threadIds: string[] = [];
  if (threadCol) {
    const { data: threads } = await supabase
      .from("email_threads")
      .select("id")
      .eq(threadCol, entityId)
      .limit(200);
    threadIds = (threads ?? []).map((t: SB) => t.id);
  } else {
    const cid = await resolveContactId(supabase, entity, entityId);
    if (cid) {
      const { data: threads } = await supabase
        .from("email_threads")
        .select("id")
        .eq("contact_id", cid)
        .limit(200);
      threadIds = (threads ?? []).map((t: SB) => t.id);
    }
  }
  if (threadIds.length === 0) return msgs;
  const { data: emails } = await supabase
    .from("email_messages")
    .select(
      "subject, snippet, body_text, direction, from_name, from_email, sent_at, received_at, created_at",
    )
    .in("thread_id", threadIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);
  for (const e of (emails ?? []) as SB[]) {
    const text = [e.subject, e.snippet || e.body_text?.slice(0, 1000)].filter(Boolean).join(" — ");
    if (!text) continue;
    msgs.push({
      at: e.sent_at ?? e.received_at ?? e.created_at,
      channel: "email",
      direction: e.direction === "inbound" ? "in" : "out",
      who: e.direction === "inbound" ? `${e.from_name ?? e.from_email ?? "Cliente"}` : "Nós",
      text,
    });
  }
  return msgs;
}

async function collectFromWhatsapp(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  since: string,
): Promise<Msg[]> {
  const msgs: Msg[] = [];
  const contactId = await resolveContactId(supabase, entity, entityId);
  if (!contactId) return msgs;
  const { data: convs } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("contact_id", contactId);
  const convIds = (convs ?? []).map((c: SB) => c.id);
  if (convIds.length === 0) return msgs;
  const { data: wa } = await supabase
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .in("conversation_id", convIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(300);
  for (const m of (wa ?? []) as SB[]) {
    if (!m.body) continue;
    msgs.push({
      at: m.created_at,
      channel: "whatsapp",
      direction: m.direction === "inbound" ? "in" : "out",
      who: m.direction === "inbound" ? "Cliente" : "Atendente",
      text: m.body,
    });
  }
  return msgs;
}

async function collectFromComments(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  since: string,
): Promise<Msg[]> {
  const msgs: Msg[] = [];
  const relCol = RELATED_KEY[entity];
  let actQ = supabase.from("activities").select("id").gte("created_at", since).limit(500);
  if (relCol) actQ = actQ.eq(relCol, entityId);
  else {
    const cid = await resolveContactId(supabase, entity, entityId);
    if (!cid) return msgs;
    actQ = actQ.eq("related_contact_id", cid);
  }
  const { data: acts } = await actQ;
  const ids = (acts ?? []).map((a: SB) => a.id);
  if (ids.length === 0) return msgs;
  const { data: comments } = await supabase
    .from("activity_comments")
    .select("body, created_at, author_id")
    .in("activity_id", ids)
    .is("deleted_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(200);
  for (const c of (comments ?? []) as SB[]) {
    if (!c.body) continue;
    msgs.push({
      at: c.created_at,
      channel: "comment",
      direction: "internal",
      who: "Comentário",
      text: c.body,
    });
  }
  return msgs;
}

async function collectMessages(
  supabase: SB,
  entity: z.infer<typeof ENTITY>,
  entityId: string,
  kind: z.infer<typeof KIND>,
  windowDays: number,
): Promise<Msg[]> {
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
  const msgs: Msg[] = [];

  // Activities baseline
  msgs.push(...(await collectFromActivities(supabase, entity, entityId, kind, since)));

  if (kind === "meeting" || kind === "all") {
    msgs.push(...(await collectFromMeetings(supabase, entity, entityId, since)));
  }
  if (kind === "email" || kind === "conversation" || kind === "all") {
    msgs.push(...(await collectFromEmails(supabase, entity, entityId, since)));
  }
  if (kind === "conversation" || kind === "all") {
    msgs.push(...(await collectFromWhatsapp(supabase, entity, entityId, since)));
  }
  if (kind === "notes" || kind === "all") {
    msgs.push(...(await collectFromComments(supabase, entity, entityId, since)));
  }

  msgs.sort((a, b) => (a.at < b.at ? -1 : 1));
  return msgs.slice(0, MAX_MSGS);
}

const KIND_HEADER: Record<z.infer<typeof KIND>, string> = {
  conversation:
    "Você é um analista de vendas. Resuma a conversa multi-canal abaixo (WhatsApp, e-mails e atividades).",
  call: "Você é um analista de vendas. Resuma as ligações abaixo, incluindo transcrições e resultados.",
  meeting:
    "Você é um analista de vendas. Resuma as reuniões, gravações e transcrições abaixo, destacando decisões e ações combinadas.",
  email: "Você é um analista de vendas. Resuma a troca de e-mails abaixo.",
  notes:
    "Você é um analista de vendas. Consolide as notas internas e comentários da equipe abaixo.",
  tasks: "Você é um analista de vendas. Resuma o histórico de tarefas e follow-ups abaixo.",
  all: "Você é um analista de vendas. Consolide TODA a interação (conversas, e-mails, ligações, reuniões, notas e tarefas) abaixo em um resumo executivo.",
};

function buildPrompt(msgs: Msg[], kind: z.infer<typeof KIND>): string {
  const lines = msgs.map(
    (m) =>
      `[${new Date(m.at).toLocaleString("pt-BR")}] (${m.channel}/${m.direction}) ${m.who}: ${m.text.slice(0, 800)}`,
  );
  return `${KIND_HEADER[kind]}
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
  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { summary: raw.slice(0, 600), key_points: [], next_actions: [], sentiment: "neutro" };
  }
  return {
    summary: String(parsed.summary ?? "").slice(0, 4000),
    key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 12).map(String) : [],
    next_actions: Array.isArray(parsed.next_actions)
      ? parsed.next_actions.slice(0, 12).map(String)
      : [],
    sentiment: String(parsed.sentiment ?? "neutro"),
  };
}

export const generateAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: ENTITY,
        entity_id: z.string().uuid(),
        kind: KIND.default("conversation"),
        window_days: z.number().int().min(1).max(180).default(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const msgs = await collectMessages(
      supabase,
      data.entity,
      data.entity_id,
      data.kind,
      data.window_days,
    );
    if (msgs.length === 0) {
      return {
        skipped: true as const,
        reason: `Sem dados suficientes nos últimos ${data.window_days} dias para resumir.`,
      };
    }
    const prompt = buildPrompt(msgs, data.kind);
    const ai = await callAi(prompt, DEFAULT_MODEL);
    const windowFrom = msgs[0].at;
    const windowTo = msgs[msgs.length - 1].at;
    const { data: row, error } = await supabase
      .from("ai_summaries")
      .insert({
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
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listAiSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: ENTITY,
        entity_id: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(input),
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
