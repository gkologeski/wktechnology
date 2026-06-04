// Prospecting agent — usa Lovable AI para gerar ICP-matching prospects.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SearchInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  industry: z.string().max(120).optional().default(""),
  role_title: z.string().max(120).optional().default(""),
  company_size: z.string().max(80).optional().default(""),
  location: z.string().max(120).optional().default(""),
  keywords: z.string().max(400).optional().default(""),
  instructions: z.string().max(1000).optional().default(""),
  max_results: z.number().int().min(1).max(50).default(10),
});

type ProspectSearch = {
  id: string; owner_id: string; name: string; status: string; error: string | null;
  industry: string | null; role_title: string | null; company_size: string | null;
  location: string | null; keywords: string | null; instructions: string | null;
  max_results: number; result_count: number; ran_at: string | null;
  created_at: string; updated_at: string;
};
type ProspectResult = {
  id: string; owner_id: string; search_id: string;
  company_name: string | null; contact_name: string | null; role_title: string | null;
  email_hint: string | null; domain_hint: string | null; location: string | null;
  reason: string | null; imported_lead_id: string | null; imported_at: string | null; created_at: string;
};

export const listProspectSearches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProspectSearch[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("prospecting_searches")
      .select("*").eq("owner_id", workspaceId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProspectSearch[];
  });

export const upsertProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SearchInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    const payload = {
      owner_id: workspaceId,
      name: data.name,
      industry: data.industry || null,
      role_title: data.role_title || null,
      company_size: data.company_size || null,
      location: data.location || null,
      keywords: data.keywords || null,
      instructions: data.instructions || null,
      max_results: data.max_results,
    };
    if (data.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("prospecting_searches").update(payload).eq("id", data.id).eq("owner_id", workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase as any).from("prospecting_searches").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
      const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("prospecting_searches").delete().eq("id", data.id).eq("owner_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProspectResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ search_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ProspectResult[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any).from("prospecting_results")
      .select("*").eq("owner_id", workspaceId).eq("search_id", data.search_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProspectResult[];
  });

export const runProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: s, error: sErr } = await sb.from("prospecting_searches").select("*").eq("id", data.id).eq("owner_id", workspaceId).single();
    if (sErr || !s) throw new Error("Busca não encontrada");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    await sb.from("prospecting_searches").update({ status: "running", error: null }).eq("id", data.id);

    const sys = `Você é um agente de prospecção B2B. Gere uma lista de prospects PLAUSÍVEIS (empresas e contatos) baseada no ICP fornecido.
Retorne APENAS JSON: {"prospects":[{"company_name":"...","contact_name":"...","role_title":"...","email_hint":"nome@dominio","domain_hint":"empresa.com","location":"Cidade, UF","reason":"por que combina com o ICP"}]}.
Os emails devem ser HEURÍSTICOS (formato provável), nunca afirme que existem. Limite a ${s.max_results} prospects.`;

    const user = [
      `ICP:`,
      s.industry && `- Segmento: ${s.industry}`,
      s.role_title && `- Cargo alvo: ${s.role_title}`,
      s.company_size && `- Porte: ${s.company_size}`,
      s.location && `- Localização: ${s.location}`,
      s.keywords && `- Palavras-chave: ${s.keywords}`,
      s.instructions && `- Instruções: ${s.instructions}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user || "ICP genérico — gere prospects diversos" },
          ],
          temperature: 0.8,
        }),
      });
      if (!res.ok) throw new Error(`AI ${res.status}`);
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^```json|^```|```$/g, "").trim();
      const parsed = JSON.parse(raw) as { prospects?: Array<Record<string, unknown>> };
      const prospects = Array.isArray(parsed.prospects) ? parsed.prospects.slice(0, s.max_results) : [];
      if (prospects.length) {
        await sb.from("prospecting_results").insert(prospects.map((p) => ({
          owner_id: workspaceId,
          search_id: data.id,
          company_name: String(p.company_name ?? "").slice(0, 200) || null,
          contact_name: String(p.contact_name ?? "").slice(0, 200) || null,
          role_title: String(p.role_title ?? "").slice(0, 200) || null,
          email_hint: String(p.email_hint ?? "").slice(0, 200) || null,
          domain_hint: String(p.domain_hint ?? "").slice(0, 200) || null,
          location: String(p.location ?? "").slice(0, 200) || null,
          reason: String(p.reason ?? "").slice(0, 1000) || null,
        })));
      }
      await sb.from("prospecting_searches").update({
        status: "completed", ran_at: new Date().toISOString(), result_count: prospects.length, error: null,
      }).eq("id", data.id);
      return { count: prospects.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      await sb.from("prospecting_searches").update({ status: "failed", error: msg }).eq("id", data.id);
      throw new Error(msg);
    }
  });

export const importProspectAsLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ result_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: r, error: rErr } = await sb.from("prospecting_results").select("*").eq("id", data.result_id).eq("owner_id", workspaceId).single();
    if (rErr || !r) throw new Error("Prospect não encontrado");
    if (r.imported_lead_id) return { id: r.imported_lead_id, already: true };
    const fullName: string = r.contact_name || r.company_name || "Prospect";
    const parts = fullName.split(" ");
    const first = parts[0] || fullName;
    const last = parts.slice(1).join(" ") || null;
    const { data: lead, error: lErr } = await sb.from("leads").insert({
      owner_id: workspaceId,
      first_name: first,
      last_name: last,
      company: r.company_name,
      email: r.email_hint,
      title: r.role_title,
      city: r.location,
      source: "prospecting",
      status: "new",
    }).select("id").single();
    if (lErr) throw new Error(lErr.message);
    await sb.from("prospecting_results").update({ imported_lead_id: lead.id, imported_at: new Date().toISOString() }).eq("id", r.id);
    return { id: lead.id, already: false };
  });
