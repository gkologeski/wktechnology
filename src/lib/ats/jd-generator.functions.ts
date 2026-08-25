// AI Job Description generator (Fase 3)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const generateJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(2),
        seniority: z.string().optional(),
        location: z.string().optional(),
        modality: z.string().optional(),
        notes: z.string().optional(),
        language: z.string().default("pt-BR"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const sys = `Você é um recrutador especialista. Gere uma descrição de vaga atraente, inclusiva e estruturada no idioma ${data.language}. Responda APENAS JSON: {"description":"markdown completo","requirements":["..."],"benefits":["..."],"tags":["..."]}`;
    const usr = `Cargo: ${data.title}\nSenioridade: ${data.seniority ?? "-"}\nLocal: ${data.location ?? "-"}\nModalidade: ${data.modality ?? "-"}\nContexto extra: ${data.notes ?? "-"}`;
    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`AI Gateway ${r.status}`);
    const j = await r.json();
    try {
      return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return {};
    }
  });
