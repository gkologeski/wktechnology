// Parser de CV via PDF (multimodal). Recebe URL assinada (ou base64), baixa
// no servidor, encaminha o arquivo para o Lovable AI Gateway (Gemini) e
// retorna os mesmos dados estruturados de `parseCv`.
//
// Vantagem sobre o caminho text-only: dispensa pdfjs no browser, lida com
// layouts complexos (colunas, tabelas) e faz OCR em PDFs digitalizados.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const InputSchema = z.object({
  cv_url: z.string().url(),
  filename: z.string().max(200).default("cv.pdf"),
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

export const parseCvFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // 1) Baixa o PDF (URL assinada vinda do bucket ats-cvs ou qualquer URL pública)
    const fileRes = await fetch(data.cv_url);
    if (!fileRes.ok) throw new Error(`Falha ao baixar PDF (${fileRes.status})`);
    const mime = fileRes.headers.get("content-type") ?? "application/pdf";
    if (!mime.includes("pdf")) throw new Error(`Arquivo não é PDF (content-type=${mime})`);
    const buf = await fileRes.arrayBuffer();
    if (buf.byteLength > 15 * 1024 * 1024) throw new Error("PDF maior que 15MB");
    const b64 = Buffer.from(buf).toString("base64");

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
Nunca invente dados. Se um campo não estiver no PDF, use null ou [].`;

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste currículo." },
              {
                type: "file",
                file: {
                  filename: data.filename,
                  file_data: `data:${mime};base64,${b64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 402)
        throw new Error("Créditos da IA esgotados. Recarregue para continuar.");
      if (aiRes.status === 429) throw new Error("Limite da IA atingido. Tente em instantes.");
      throw new Error(`Falha na IA: ${txt.slice(0, 200)}`);
    }
    const json = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
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
        source: "cv_pdf",
        notes: parsed.summary,
        cv_parsed: parsed,
        cv_url: data.cv_url,
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
