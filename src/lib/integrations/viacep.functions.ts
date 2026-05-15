// ViaCEP server-side bulk enrichment for companies
// Endpoint: GET https://viacep.com.br/ws/{cep}/json/  (sem autenticação)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ViaCepResp = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

async function lookup(cep: string): Promise<ViaCepResp | null> {
  const c = cep.replace(/\D/g, "");
  if (c.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
  if (!r.ok) return null;
  const d = (await r.json()) as ViaCepResp;
  if (d.erro) return null;
  return d;
}

export const enrichCompaniesAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).max(1000).optional(),
        all_missing: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase.from("companies").select("id, cep, address, city, state");
    if (data.ids && data.ids.length) q = q.in("id", data.ids);
    else if (data.all_missing) q = q.is("city", null);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);

    const { data: job } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
        provider: "viacep",
        kind: "enrich",
        entity: "company",
        status: "running",
        total: rows?.length ?? 0,
        started_at: new Date().toISOString(),
        scope: { ids: data.ids ?? null, all_missing: !!data.all_missing } as never,
      })
      .select("id")
      .single();

    let succeeded = 0,
      failed = 0,
      skipped = 0;
    for (const c of rows ?? []) {
      if (!c.cep) {
        skipped++;
        continue;
      }
      try {
        const r = await lookup(c.cep);
        if (!r) {
          failed++;
          continue;
        }
        const update: Record<string, unknown> = {};
        if (!c.city && r.localidade) update.city = r.localidade;
        if (!c.state && r.uf) update.state = r.uf;
        if (!c.address && r.logradouro) update.address = `${r.logradouro}${r.bairro ? `, ${r.bairro}` : ""}`;
        if (Object.keys(update).length > 0) {
          await supabase.from("companies").update(update).eq("id", c.id);
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    await supabase
      .from("enrichment_jobs")
      .update({
        status: failed === 0 ? "done" : succeeded === 0 ? "failed" : "partial",
        processed: succeeded + failed,
        succeeded,
        failed,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job!.id);

    return { succeeded, failed, skipped };
  });
