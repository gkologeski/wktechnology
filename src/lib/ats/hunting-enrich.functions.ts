/**
 * Hunter v0.4 — Slice 5.6.
 * Enriquece um capture (ats_hunting_captures) com IA: extrai skills,
 * seniority normalizado e headline. Atualiza ats_candidates e registra
 * créditos no credit_ledger.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

const Input = z.object({ capture_id: z.string().uuid() });
const BulkInput = z.object({
  capture_ids: z.array(z.string().uuid()).min(1).max(20),
});

type EnrichResult = {
  skills: string[];
  seniority: "junior" | "pleno" | "senior" | "staff" | "principal" | null;
  headline: string | null;
};

async function callGemini(payload: Record<string, unknown>): Promise<EnrichResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const sys = `Você é um extractor de dados de perfis profissionais.
Devolva SOMENTE um JSON válido neste formato:
{"skills": string[], "seniority": "junior"|"pleno"|"senior"|"staff"|"principal"|null, "headline": string|null}
- skills: até 12, em minúsculas, sem duplicatas, somente tecnologias/áreas relevantes.
- seniority: inferido do cargo/experiência; null se incerto.
- headline: 1 linha curta (até 120 chars), em português.`;
  const user = `Dados brutos do perfil:\n${JSON.stringify(payload, null, 2)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<EnrichResult> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  const skills = Array.isArray(parsed.skills)
    ? parsed.skills.filter((s) => typeof s === "string").slice(0, 12)
    : [];
  const sen = parsed.seniority;
  const allowed = ["junior", "pleno", "senior", "staff", "principal"] as const;
  const seniority = (allowed as readonly string[]).includes(sen as string)
    ? (sen as EnrichResult["seniority"])
    : null;
  const headline = typeof parsed.headline === "string" ? parsed.headline.slice(0, 160) : null;
  return { skills, seniority, headline };
}

export const enrichCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cap, error } = await supabase
      .from("ats_hunting_captures")
      .select("id, candidate_id, raw_payload, source_url")
      .eq("id", data.capture_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cap) throw new Error("Capture não encontrado");

    const enriched = await callGemini({
      raw: cap.raw_payload,
      url: cap.source_url,
    });

    // patch candidate
    const patch: Record<string, unknown> = {
      last_touch_at: new Date().toISOString(),
    };
    if (enriched.skills.length) patch.skills = enriched.skills;
    if (enriched.headline) patch.current_position = enriched.headline;
    const { error: upErr } = await supabase
      .from("ats_candidates")
      .update(patch as never)
      .eq("id", cap.candidate_id);
    if (upErr) throw new Error(upErr.message);

    // credit ledger best-effort
    try {
      await supabase.from("credit_ledger").insert({
        owner_id: userId,
        kind: "ats.hunting.enrich",
        amount: -1,
        meta: { capture_id: cap.id, model: "google/gemini-2.5-flash" },
      } as never);
    } catch {
      // ignore — ledger may have stricter shape; non-blocking
    }

    await recordAtsEvent(supabase, {
      ownerId: userId,
      name: "ats.candidate.enriched",
      entityType: "candidate",
      entityId: cap.candidate_id,
      payload: { source: "hunting", seniority: enriched.seniority },
    });

    return { ok: true, enriched };
  });

export const enrichCapturesBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkInput.parse(d))
  .handler(async ({ context, data }) => {
    const fn = enrichCapture;
    let ok = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];
    for (const id of data.capture_ids) {
      try {
        await fn({ data: { capture_id: id } } as never);
        ok += 1;
      } catch (e) {
        failed += 1;
        errors.push({ id, message: (e as Error).message });
      }
    }
    return { ok, failed, errors };
  });
