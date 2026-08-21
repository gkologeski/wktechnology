// Parsing de currículo com IA: recebe texto bruto do CV (colado pelo usuário ou
// extraído externamente) e retorna dados estruturados; opcionalmente salva no
// candidato (`ats_candidates`).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const InputSchema = z.object({
  cv_text: z.string().min(40).max(20000),
  candidate_id: z.string().uuid().optional(),
  apply: z.boolean().default(false),
});

type Parsed = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  current_position: string | null;
  current_company: string | null;
  skills: string[];
  summary: string | null;
  experience: Array<{ company: string; role: string; period?: string }>;
  education: Array<{ school: string; degree?: string; period?: string }>;
};

export const parseCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const sys = `Você extrai dados estruturados de currículos em português ou inglês.
Retorne JSON estrito no formato:
{
  "full_name": string|null,
  "email": string|null,
  "phone": string|null,
  "linkedin_url": string|null,
  "location": string|null,
  "current_position": string|null,
  "current_company": string|null,
  "skills": string[],
  "summary": string|null,
  "experience": [{"company": string, "role": string, "period": string?}],
  "education": [{"school": string, "degree": string?, "period": string?}]
}
Nunca invente dados. Se um campo não estiver no texto, use null ou [].`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.cv_text },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 402) throw new Error("Créditos da IA esgotados. Recarregue para continuar.");
      if (res.status === 429) throw new Error("Limite da IA atingido. Tente novamente em instantes.");
      throw new Error(`Falha na IA: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Parsed;
    try {
      parsed = JSON.parse(content) as Parsed;
    } catch {
      throw new Error("IA retornou JSON inválido");
    }

    let saved: { id: string } | null = null;
    if (data.apply) {
      const base = {
        owner_id: userId,
        workspace_id: workspaceId,
        full_name: parsed.full_name ?? "(sem nome)",
        email: parsed.email,
        phone: parsed.phone,
        linkedin_url: parsed.linkedin_url,
        location: parsed.location,
        current_position: parsed.current_position,
        current_company: parsed.current_company,
        skills: parsed.skills ?? [],
        source: "cv_parse",
        notes: parsed.summary,
        cv_parsed: parsed,
        created_by: userId,
      };
      if (data.candidate_id) {
        const { error } = await supabase
          .from("ats_candidates")
          .update(base as never)
          .eq("id", data.candidate_id)
          .eq("workspace_id", workspaceId);
        if (error) throw new Error(error.message);
        saved = { id: data.candidate_id };
      } else {
        const { data: ins, error } = await supabase
          .from("ats_candidates")
          .insert(base as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        saved = ins as { id: string };
      }
    }

    return { parsed, saved };
  });
