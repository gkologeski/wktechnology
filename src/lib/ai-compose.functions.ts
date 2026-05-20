import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const Mode = z.enum(["draft", "improve", "shorter", "longer", "formal", "casual", "translate_en", "translate_es", "translate_pt", "reply"]);
const Channel = z.enum(["email", "whatsapp"]);

function instruction(mode: z.infer<typeof Mode>, channel: z.infer<typeof Channel>): string {
  const tone = channel === "whatsapp"
    ? "Use tom conversacional, curto, sem markdown e sem assinatura."
    : "Use tom profissional para email, parágrafos curtos, sem markdown.";
  switch (mode) {
    case "draft": return `Redija uma mensagem nova a partir da intenção descrita. ${tone}`;
    case "improve": return `Reescreva melhorando clareza e gramática, preservando intenção e idioma. ${tone}`;
    case "shorter": return `Reescreva de forma mais curta e direta. ${tone}`;
    case "longer": return `Expanda com mais contexto e detalhes úteis, sem inventar fatos. ${tone}`;
    case "formal": return `Reescreva em tom mais formal. ${tone}`;
    case "casual": return `Reescreva em tom mais casual e amigável. ${tone}`;
    case "translate_en": return `Traduza para o inglês mantendo o sentido. ${tone}`;
    case "translate_es": return `Traduza para o espanhol mantendo o sentido. ${tone}`;
    case "translate_pt": return `Traduza para o português mantendo o sentido. ${tone}`;
    case "reply": return `Redija uma resposta adequada à mensagem recebida. ${tone}`;
  }
}

export const smartCompose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      channel: Channel,
      mode: Mode,
      input_text: z.string().max(8000).optional().default(""),
      prompt: z.string().max(2000).optional().default(""),
      contact_name: z.string().max(200).optional().default(""),
      language: z.string().max(20).optional().default("pt-BR"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const sys = `Você é um assistente de copywriting de CRM. ${instruction(data.mode, data.channel)}
Retorne APENAS o texto final, sem aspas, sem prefixos do tipo "Aqui está".`;
    const userParts: string[] = [];
    if (data.contact_name) userParts.push(`Destinatário: ${data.contact_name}`);
    if (data.prompt) userParts.push(`Instrução do usuário: ${data.prompt}`);
    if (data.input_text) userParts.push(`Texto base:\n${data.input_text}`);
    if (!data.input_text && !data.prompt) userParts.push("Redija uma mensagem útil de follow-up.");
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userParts.join("\n\n") },
        ],
        temperature: 0.6,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (j.choices?.[0]?.message?.content ?? "").trim();
    return { text };
  });
