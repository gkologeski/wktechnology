import type { SupabaseClient } from "@supabase/supabase-js";
import { corporateDomainFromEmail } from "@/lib/domain-utils";
import { sourcePhone } from "@/lib/phone/phone-boundary";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import {
  planCompanyCnpjEnrichment,
  type CompanyCnpjConflict,
  type CompanyCnpjRecord,
} from "@/lib/companies/company-legal-name";

type BrasilApiResp = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_tipo_de_logradouro?: string;
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

export type NormalizedCnpj = CompanyCnpjRecord & {
  email?: string;
};

async function lookupBrasilApi(cnpj: string): Promise<NormalizedCnpj | null> {
  const c = stripDigits(cnpj);
  if (c.length !== 14) return null;
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`, {
    signal: AbortSignal.timeout(8000),
    redirect: "manual",
  });
  if (!r.ok) return null;
  const d = (await r.json()) as BrasilApiResp;
  if (!d?.cnpj && !d?.razao_social) return null;
  const prefix = d.descricao_tipo_de_logradouro?.trim();
  const street = d.logradouro?.trim() ?? "";
  const fullStreet =
    prefix && street && !street.toUpperCase().startsWith(prefix.toUpperCase())
      ? `${prefix} ${street}`
      : street;
  const address = [fullStreet, d.numero, d.complemento, d.bairro]
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .join(", ")
    .trim();
  const emailDomain = corporateDomainFromEmail(d.email);
  return {
    legal_name: d.razao_social?.trim() || undefined,
    trade_name: d.nome_fantasia?.trim() || undefined,
    address: address || undefined,
    city: d.municipio?.trim() || undefined,
    state: d.uf?.trim() || undefined,
    cep: formatCep(d.cep) || undefined,
    // Cadastro da Receita Federal: número brasileiro (país comprovado pela fonte).
    phone: sourcePhone(d.ddd_telefone_1, "BR") || undefined,
    email: d.email || undefined,
    domain: emailDomain || undefined,
    industry: d.cnae_fiscal_descricao?.trim() || undefined,
    size:
      typeof d.porte === "object"
        ? d.porte?.descricao?.trim()
        : typeof d.porte === "string"
          ? d.porte.trim()
          : undefined,
  };
}

async function lookupReceitaWs(cnpj: string): Promise<NormalizedCnpj | null> {
  const c = stripDigits(cnpj);
  if (c.length !== 14) return null;
  const r = await fetch(`https://receitaws.com.br/v1/cnpj/${c}`, {
    signal: AbortSignal.timeout(8000),
    redirect: "manual",
  });
  if (!r.ok) return null;
  const d = (await r.json()) as ReceitaWsResp;
  if (d?.status && d.status.toUpperCase() === "ERROR") return null;
  const address = [d.logradouro, d.numero, d.complemento, d.bairro]
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .join(", ")
    .trim();
  const emailDomain = corporateDomainFromEmail(d.email);
  return {
    legal_name: d.nome?.trim() || undefined,
    trade_name: d.fantasia?.trim() || undefined,
    address: address || undefined,
    city: d.municipio?.trim() || undefined,
    state: d.uf?.trim() || undefined,
    cep: formatCep(d.cep) || undefined,
    phone: sourcePhone(d.telefone, "BR") || undefined,
    email: d.email || undefined,
    domain: emailDomain || undefined,
    industry: d.atividade_principal?.[0]?.text?.trim() || undefined,
    size: d.porte?.trim() || undefined,
  };
}

export async function lookupCompanyCnpjData(cnpj: string): Promise<NormalizedCnpj | null> {
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

export type EnrichCompanyResult =
  | { ok: false; reason: "not_found" }
  | {
      ok: true;
      needsConfirmation: true;
      conflicts: CompanyCnpjConflict[];
      emptyCount: number;
    }
  | {
      ok: true;
      needsConfirmation: false;
      applied: number;
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

  const r = await lookupCompanyCnpjData(c.cnpj);
  if (!r) return { ok: false, reason: "not_found" };

  const plan = planCompanyCnpjEnrichment(c, r, { overwrite: Boolean(input.overwrite) });
  if (input.overwrite === undefined && plan.conflicts.length > 0) {
    return {
      ok: true,
      needsConfirmation: true,
      conflicts: plan.conflicts,
      emptyCount: Object.keys(plan.emptyUpdates).length,
    };
  }

  const updatePayload: Record<string, unknown> = {
    ...plan.update,
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
  return { ok: true, needsConfirmation: false, applied: Object.keys(plan.update).length };
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
      const r = await lookupCompanyCnpjData(c.cnpj);
      if (!r) {
        failed++;
        continue;
      }
      const plan = planCompanyCnpjEnrichment(c, r, { overwrite });
      const updatePayload: Record<string, unknown> = {
        ...plan.update,
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
