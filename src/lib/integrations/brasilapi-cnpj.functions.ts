// BrasilAPI CNPJ enrichment for companies.
// Endpoint: GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
// Fallback: https://receitaws.com.br/v1/cnpj/{cnpj}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BrasilApiResp = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string;
  cnae_fiscal_descricao?: string;
  porte?: { descricao?: string } | string;
};

type ReceitaWsResp = {
  status?: string;
  nome?: string;
  fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  atividade_principal?: Array<{ text?: string }>;
  porte?: string;
};

function stripDigits(v: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

function formatCep(c?: string): string | null {
  const d = stripDigits(c ?? "");
  if (d.length !== 8) return null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

type NormalizedCnpj = {
  name?: string;
  fantasy?: string;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  phone?: string;
  email?: string;
  industry?: string;
  size?: string;
};

async function lookupBrasilApi(cnpj: string): Promise<NormalizedCnpj | null> {
  const c = stripDigits(cnpj);
  if (c.length !== 14) return null;
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
  if (!r.ok) return null;
  const d = (await r.json()) as BrasilApiResp;
  if (!d?.cnpj && !d?.razao_social) return null;
  const address = [d.logradouro, d.numero, d.complemento, d.bairro]
    .filter(Boolean)
    .join(", ")
    .trim();
  return {
    name: d.razao_social || undefined,
    fantasy: d.nome_fantasia || undefined,
    address: address || undefined,
    city: d.municipio || undefined,
    state: d.uf || undefined,
    cep: formatCep(d.cep) || undefined,
    phone: d.ddd_telefone_1 || undefined,
    email: d.email || undefined,
    industry: d.cnae_fiscal_descricao || undefined,
    size:
      typeof d.porte === "object"
        ? d.porte?.descricao
        : typeof d.porte === "string"
          ? d.porte
          : undefined,
  };
}

async function lookupReceitaWs(cnpj: string): Promise<NormalizedCnpj | null> {
  const c = stripDigits(cnpj);
  if (c.length !== 14) return null;
  const r = await fetch(`https://receitaws.com.br/v1/cnpj/${c}`);
  if (!r.ok) return null;
  const d = (await r.json()) as ReceitaWsResp;
  if (d?.status && d.status.toUpperCase() === "ERROR") return null;
  const address = [d.logradouro, d.numero, d.complemento, d.bairro]
    .filter(Boolean)
    .join(", ")
    .trim();
  return {
    name: d.nome || undefined,
    fantasy: d.fantasia || undefined,
    address: address || undefined,
    city: d.municipio || undefined,
    state: d.uf || undefined,
    cep: formatCep(d.cep) || undefined,
    phone: d.telefone || undefined,
    email: d.email || undefined,
    industry: d.atividade_principal?.[0]?.text || undefined,
    size: d.porte || undefined,
  };
}

async function lookup(cnpj: string): Promise<NormalizedCnpj | null> {
  try {
    const primary = await lookupBrasilApi(cnpj);
    if (primary) return primary;
  } catch {
    // fall through
  }
  try {
    return await lookupReceitaWs(cnpj);
  } catch {
    return null;
  }
}

// Enrich a single company by its CNPJ. Only fills empty fields (non-destructive).
export const enrichCompanyByCNPJ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        company_id: z.string().uuid(),
        overwrite: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: c, error } = await supabase
      .from("companies")
      .select("id, cnpj, name, industry, size, phone, address, city, state, cep")
      .eq("id", data.company_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Empresa não encontrada.");
    if (!c.cnpj) throw new Error("Empresa sem CNPJ.");

    const r = await lookup(c.cnpj);
    if (!r) return { ok: false, reason: "not_found" as const };

    const overwrite = !!data.overwrite;
    const update: Record<string, unknown> = { cnpj_enriched_at: new Date().toISOString() };
    if ((overwrite || !c.name) && r.name) update.name = r.name;
    if ((overwrite || !c.industry) && r.industry) update.industry = r.industry;
    if ((overwrite || !c.size) && r.size) update.size = r.size;
    if ((overwrite || !c.phone) && r.phone) update.phone = r.phone;
    if ((overwrite || !c.address) && r.address) update.address = r.address;
    if ((overwrite || !c.city) && r.city) update.city = r.city;
    if ((overwrite || !c.state) && r.state) update.state = r.state;
    if ((overwrite || !c.cep) && r.cep) update.cep = r.cep;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uerr } = await (supabase as any).from("companies").update(update).eq("id", c.id);
    if (uerr) throw new Error(uerr.message);
    return { ok: true, applied: Object.keys(update).length - 1 };
  });

// Bulk enrichment. Enriches by explicit IDs or all companies with CNPJ and no enrichment yet.
export const enrichCompaniesByCNPJ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).max(1000).optional(),
        all_missing: z.boolean().optional(),
        overwrite: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("companies")
      .select("id, cnpj, name, industry, size, phone, address, city, state, cep, cnpj_enriched_at");
    if (data.ids && data.ids.length) q = q.in("id", data.ids);
    else if (data.all_missing) q = q.not("cnpj", "is", null).is("cnpj_enriched_at", null);
    else q = q.in("id", []); // no-op guard
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);

    const { data: job } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
        provider: "brasilapi",
        kind: "enrich",
        entity: "company",
        status: "running",
        total: rows?.length ?? 0,
        started_at: new Date().toISOString(),
        scope: {
          ids: data.ids ?? null,
          all_missing: !!data.all_missing,
          overwrite: !!data.overwrite,
        } as never,
      })
      .select("id")
      .single();

    const overwrite = !!data.overwrite;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    for (const c of rows ?? []) {
      if (!c.cnpj) {
        skipped++;
        continue;
      }
      try {
        const r = await lookup(c.cnpj);
        if (!r) {
          failed++;
          continue;
        }
        const update: Record<string, unknown> = { cnpj_enriched_at: new Date().toISOString() };
        if ((overwrite || !c.name) && r.name) update.name = r.name;
        if ((overwrite || !c.industry) && r.industry) update.industry = r.industry;
        if ((overwrite || !c.size) && r.size) update.size = r.size;
        if ((overwrite || !c.phone) && r.phone) update.phone = r.phone;
        if ((overwrite || !c.address) && r.address) update.address = r.address;
        if ((overwrite || !c.city) && r.city) update.city = r.city;
        if ((overwrite || !c.state) && r.state) update.state = r.state;
        if ((overwrite || !c.cep) && r.cep) update.cep = r.cep;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("companies").update(update).eq("id", c.id);
        succeeded++;
        // BrasilAPI recomenda ~3 req/s; espaço mínimo entre chamadas
        await new Promise((res) => setTimeout(res, 350));
      } catch {
        failed++;
      }
    }

    if (job?.id) {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: failed === 0 ? "done" : succeeded === 0 ? "failed" : "partial",
          processed: succeeded + failed,
          succeeded,
          failed,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return { total: rows?.length ?? 0, succeeded, failed, skipped };
  });
