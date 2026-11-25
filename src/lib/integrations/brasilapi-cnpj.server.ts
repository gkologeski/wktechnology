import type { SupabaseClient } from "@supabase/supabase-js";
import { onlyDigits } from "@/lib/cnpj";
import { corporateDomainFromEmail } from "@/lib/domain-utils";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import {
  planCompanyCnpjEnrichment,
  type CompanyCnpjConflict,
  type CompanyCnpjRecord,
} from "@/lib/companies/company-legal-name";
import {
  lookupPublicCnpj,
  type CnpjLookupFailureReason,
  type CnpjLookupSource,
  type PublicCnpjRecord,
} from "@/lib/integrations/cnpj-lookup.server";

export type NormalizedCnpj = CompanyCnpjRecord & {
  email?: string;
};

function toNormalizedCnpj(record: PublicCnpjRecord): NormalizedCnpj {
  const emailDomain = corporateDomainFromEmail(record.email || undefined);
  const address = [record.street, record.number, record.complement, record.neighborhood]
    .filter((p) => p.trim().length > 0)
    .join(", ")
    .trim();
  return {
    legal_name: record.razao_social || undefined,
    trade_name: record.nome_fantasia || undefined,
    address: address || record.address_line || undefined,
    city: record.city || undefined,
    state: record.state || undefined,
    cep: record.cep || undefined,
    phone: record.phone || undefined,
    email: record.email || undefined,
    domain: emailDomain || undefined,
    industry: record.industry || undefined,
    size: record.size || undefined,
  };
}

export async function lookupCompanyCnpjData(cnpj: string): Promise<NormalizedCnpj | null> {
  const res = await lookupPublicCnpj(cnpj);
  return res.ok ? toNormalizedCnpj(res.data) : null;
}

export type EnrichCompanyResult =
  | { ok: false; reason: CnpjLookupFailureReason; message: string }
  | {
      ok: true;
      needsConfirmation: true;
      conflicts: CompanyCnpjConflict[];
      emptyCount: number;
      source: CnpjLookupSource;
      cnpj: string;
    }
  | {
      ok: true;
      needsConfirmation: false;
      applied: number;
      source: CnpjLookupSource;
      cnpj: string;
    };

type CompanyRowForCnpj = {
  id: string;
  cnpj: string | null;
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  domain: string | null;
};

/**
 * Enriquece uma única empresa pelo CNPJ.
 * Preenche `legal_name` e `trade_name` separadamente e nunca altera `name`.
 * Quando `overwrite` não é informado e há campos já preenchidos com valor diferente,
 * retorna `needsConfirmation: true` para a UI confirmar antes de substituir.
 */
export async function runEnrichCompanyByCNPJ(
  supabase: SupabaseClient,
  userId: string,
  input: { company_id: string; overwrite?: boolean },
): Promise<EnrichCompanyResult> {
  const workspaceId = await getActiveWorkspaceId(supabase, userId);
  await assertSalesRecord(supabase, "companies", input.company_id, "update");

  const { data: raw, error } = await supabase
    .from("companies")
    .select(
      "id, cnpj, name, legal_name, trade_name, industry, size, phone, address, city, state, cep, domain",
    )
    .eq("id", input.company_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const c = raw as CompanyRowForCnpj | null;
  if (!c) throw new Error("Empresa não encontrada.");
  if (!c.cnpj) throw new Error("Empresa sem CNPJ.");

  const lookupRes = await lookupPublicCnpj(c.cnpj);
  if (!lookupRes.ok) {
    return { ok: false, reason: lookupRes.reason, message: lookupRes.message };
  }
  const r = toNormalizedCnpj(lookupRes.data);

  const plan = planCompanyCnpjEnrichment(c, r, { overwrite: Boolean(input.overwrite) });
  if (input.overwrite === undefined && plan.conflicts.length > 0) {
    return {
      ok: true,
      needsConfirmation: true,
      conflicts: plan.conflicts,
      emptyCount: Object.keys(plan.emptyUpdates).length,
      source: lookupRes.data.source,
      cnpj: lookupRes.data.cnpj,
    };
  }

  const normalizedMissingZero = onlyDigits(c.cnpj).length === 13;
  const updatePayload: Record<string, unknown> = {
    ...plan.update,
    ...(normalizedMissingZero ? { cnpj: lookupRes.data.cnpj } : {}),
    cnpj_enriched_at: new Date().toISOString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: uerr } = await (supabase as any)
    .from("companies")
    .update(updatePayload)
    .eq("id", c.id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (uerr) throw new Error(uerr.message);
  if (!Array.isArray(updated) || updated.length === 0) {
    throw new Error("Sem permissão para atualizar esta empresa.");
  }
  return {
    ok: true,
    needsConfirmation: false,
    applied: Object.keys(plan.update).length + (normalizedMissingZero ? 1 : 0),
    source: lookupRes.data.source,
    cnpj: lookupRes.data.cnpj,
  };
}

export async function runEnrichCompaniesByCNPJ(
  supabase: SupabaseClient,
  userId: string,
  input: { ids?: string[]; all_missing?: boolean; overwrite?: boolean },
) {
  const workspaceId = await getActiveWorkspaceId(supabase, userId);
  let q = supabase
    .from("companies")
    .select(
      "id, cnpj, name, legal_name, trade_name, industry, size, phone, address, city, state, cep, cnpj_enriched_at, domain",
    )
    .eq("workspace_id", workspaceId);
  if (input.ids && input.ids.length) q = q.in("id", input.ids);
  else if (input.all_missing) q = q.not("cnpj", "is", null).is("cnpj_enriched_at", null);
  else q = q.in("id", []);
  const { data: rows, error } = await q.limit(1000);
  if (error) throw new Error(error.message);

  const { data: job } = await supabase
    .from("enrichment_jobs")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      provider: "brasilapi",
      kind: "enrich",
      entity: "company",
      status: "running",
      total: rows?.length ?? 0,
      started_at: new Date().toISOString(),
      scope: {
        ids: input.ids ?? null,
        all_missing: !!input.all_missing,
        overwrite: !!input.overwrite,
      } as never,
    })
    .select("id")
    .single();

  const overwrite = !!input.overwrite;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  for (const c of (rows ?? []) as CompanyRowForCnpj[]) {
    if (!c.cnpj) {
      skipped++;
      continue;
    }
    try {
      await assertSalesRecord(supabase, "companies", c.id, "update");
      const lookupRes = await lookupPublicCnpj(c.cnpj);
      if (!lookupRes.ok) {
        failed++;
        continue;
      }
      const r = toNormalizedCnpj(lookupRes.data);
      const plan = planCompanyCnpjEnrichment(c, r, { overwrite });
      const updatePayload: Record<string, unknown> = {
        ...plan.update,
        ...(onlyDigits(c.cnpj).length === 13 ? { cnpj: lookupRes.data.cnpj } : {}),
        cnpj_enriched_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uerr } = await (supabase as any)
        .from("companies")
        .update(updatePayload)
        .eq("id", c.id)
        .eq("workspace_id", workspaceId);
      if (uerr) {
        failed++;
        continue;
      }
      succeeded++;
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
}
