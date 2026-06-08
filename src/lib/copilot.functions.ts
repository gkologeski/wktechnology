import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Source = { kind: string; id: string; title: string; snippet: string; url?: string };

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      question: z.string().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const q = data.question;
    const ilike = `%${q.slice(0, 60).replace(/[%_]/g, " ")}%`;

    // Buscas paralelas — RLS scopa por owner/workspace.
    const [contacts, deals, leads, activities] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, phone").or(`first_name.ilike.${ilike},last_name.ilike.${ilike},email.ilike.${ilike}`).limit(5),
      supabase.from("deals").select("id, name, value, stage, expected_close_date").ilike("name", ilike).limit(5),
      supabase.from("leads").select("id, email, phone, source, status").ilike("email", ilike).limit(5),
      supabase.from("activities").select("id, subject, body, type").or(`subject.ilike.${ilike},body.ilike.${ilike}`).limit(5),
    ]);

    const sources: Source[] = [];
    (contacts.data ?? []).forEach((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || (r.email ?? "Contato");
      sources.push({ kind: "contact", id: r.id, title: String(name), snippet: [r.email, r.phone].filter(Boolean).join(" · "), url: `/contacts/${r.id}` });
    });
    (deals.data ?? []).forEach((r) => sources.push({ kind: "deal", id: r.id, title: r.name, snippet: `R$ ${r.value} · ${r.stage}`, url: `/deals/${r.id}` }));
    (leads.data ?? []).forEach((r) => sources.push({ kind: "lead", id: r.id, title: r.email ?? "Lead", snippet: [r.source, r.status].filter(Boolean).join(" · "), url: `/leads/${r.id}` }));
    (activities.data ?? []).forEach((r) => sources.push({ kind: "activity", id: r.id, title: r.subject ?? r.type ?? "Atividade", snippet: String(r.body ?? "").slice(0, 160) }));

    const ctx = sources.slice(0, 12).map((s, i) => `[${i + 1}] (${s.kind}) ${s.title} — ${s.snippet}`).join("\n");

    const sys = `Você é o Copilot do CRM. Responda em português, curto e prático, baseado APENAS no contexto fornecido.
Quando citar dados, use marcações como [1], [2] que se referem às fontes. Se não houver dado, diga claramente "não encontrei nessa base".`;
    const user = `Pergunta: ${q}\n\nContexto:\n${ctx || "(sem resultados)"}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = (j.choices?.[0]?.message?.content ?? "").trim();
    return { answer, sources };
  });
