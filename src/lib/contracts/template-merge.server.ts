// Monta o contexto de variáveis ({{...}}) de um modelo de contrato.
// Server-only: usado pelos modelos e pela conversão Proposta/Cotação -> Contrato.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadAcceptedProposalSource, legalEntityAddress } from "./accepted-proposal.server";
import { usedTokens } from "./template-tokens";
import {
  DEFAULT_JURISDICTION,
  DEFAULT_PENALTY_PERCENT,
  DEFAULT_VALIDITY_DAYS,
  endFromValidity,
  pickTerm,
  shouldAutofillAddress,
} from "./contract-terms-defaults";

type CnpjAddress = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  source: "brasilapi";
};

function title(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) return null;
  return s
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
    .trim();
}

async function lookupCnpjAddress(cnpj: string | null | undefined): Promise<CnpjAddress | null> {
  const digits = (cnpj ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!r.ok) return null;
    const d = (await r.json()) as Record<string, unknown>;
    const cep = typeof d.cep === "string" ? d.cep.replace(/\D/g, "") : "";
    const street = [title(d.descricao_tipo_de_logradouro), title(d.logradouro)]
      .filter(Boolean)
      .join(" ");
    return {
      street: street || null,
      number: typeof d.numero === "string" ? d.numero : null,
      complement: title(d.complemento),
      neighborhood: title(d.bairro),
      city: title(d.municipio),
      state: typeof d.uf === "string" ? d.uf : null,
      zip_code: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
      source: "brasilapi",
    };
  } catch {
    return null;
  }
}

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export type MergeInput = {
  templateId: string;
  dealId?: string;
  companyId?: string;
  serviceCatalogId?: string;
  title?: string;
  proposalId?: string;
  contractingLegalEntityId?: string;
};

export async function buildMergeContext(
  supabase: any,
  workspaceId: string,
  userId: string,
  input: MergeInput,
  template: Record<string, any>,
) {
  const defaults = (template.defaults ?? {}) as Record<string, unknown>;

  const requiresProposal = usedTokens(template.body_html).some((key) =>
    key.startsWith("proposal."),
  );
  if (requiresProposal && !input.proposalId)
    throw new Error("Selecione a Proposta Comercial aceita pelo cliente.");
  const source = input.proposalId
    ? await loadAcceptedProposalSource(supabase, workspaceId, input.proposalId)
    : null;
  if (
    source &&
    ((input.companyId && input.companyId !== source.proposal.company_id) ||
      (input.dealId && input.dealId !== source.proposal.deal_id))
  ) {
    throw new Error("A Proposta Comercial pertence a outra empresa ou negócio.");
  }
  const dealId = source?.proposal.deal_id ?? input.dealId;
  let deal: any = null;
  if (dealId) {
    const { data } = await supabase
      .from("deals")
      .select("id, name, value, currency, company_id")
      .eq("workspace_id", workspaceId)
      .eq("id", dealId)
      .maybeSingle();
    if (!data) throw new Error("Negócio indisponível neste workspace.");
    deal = data;
  }

  const companyId = source?.proposal.company_id ?? input.companyId ?? deal?.company_id ?? null;
  let company: any = null;
  if (companyId) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, cnpj, address, city, state, phone")
      .eq("workspace_id", workspaceId)
      .eq("id", companyId)
      .maybeSingle();
    if (!data) throw new Error("Empresa indisponível neste workspace.");
    company = data;
  }

  if (source) company = source.company;
  // Contratante sem endereço: usa o endereço oficial do CNPJ só no documento (não grava cadastro).
  if (company && shouldAutofillAddress(company.address)) {
    const addr = await lookupCnpjAddress(company.cnpj);
    if (addr) {
      company = {
        ...company,
        address: legalEntityAddress(addr),
        city: company.city ?? addr.city,
        state: company.state ?? addr.state,
      };
    }
  }

  let contact: any = source?.contact ?? null;
  if (companyId && !source) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone")
      .eq("workspace_id", workspaceId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(1);
    contact = data?.[0] ?? null;
  }

  const entityId =
    input.contractingLegalEntityId ?? (defaults.contracting_legal_entity_id as string | undefined);
  if (requiresProposal && !entityId)
    throw new Error("Selecione a pessoa jurídica prestadora do contrato.");
  let entityQuery = supabase
    .from("legal_entities")
    .select("id, name, cnpj, address_json")
    .eq("workspace_id", workspaceId)
    .eq("active", true);
  if (entityId) entityQuery = entityQuery.eq("id", entityId);
  else entityQuery = entityQuery.eq("is_default", true);
  const { data: entity, error: entityError } = await entityQuery.maybeSingle();
  if (entityError || (entityId && !entity))
    throw new Error("Pessoa jurídica indisponível neste workspace.");
  // Endereço da PJ prestadora vazio: completa pelo CNPJ e grava (RLS do usuário; manual nunca é sobrescrito).
  if (entity && shouldAutofillAddress(entity.address_json)) {
    const addr = await lookupCnpjAddress(entity.cnpj);
    if (addr) {
      entity.address_json = addr;
      await supabase
        .from("legal_entities")
        .update({ address_json: addr })
        .eq("workspace_id", workspaceId)
        .eq("id", entity.id)
        .eq("address_json", {});
    }
  }

  // Condições da proposta e signatário legal da contratante.
  let proposalTerms: {
    installments_count: number | null;
    installments_due_day: number | null;
    validity_days: number | null;
  } | null = null;
  if (source) {
    const { data } = await supabase
      .from("proposals")
      .select("installments_count, installments_due_day, validity_days")
      .eq("workspace_id", workspaceId)
      .eq("id", source.proposal.id)
      .maybeSingle();
    proposalTerms = data ?? null;
  }
  let signer: any = null;
  const signerCompanyId = source?.proposal.company_id ?? input.companyId ?? null;
  if (signerCompanyId) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, custom_fields")
      .eq("workspace_id", workspaceId)
      .eq("company_id", signerCompanyId)
      .eq("custom_fields->>signatario_legal", "true")
      .limit(2);
    // Mais de um signatário: não escolhe arbitrariamente.
    signer = data?.length === 1 ? data[0] : null;
  }

  let service: any = null;
  if (input.serviceCatalogId) {
    const { data } = await supabase
      .from("service_catalog")
      .select("name, description, unit, base_price, currency, service_type")
      .eq("workspace_id", workspaceId)
      .eq("id", input.serviceCatalogId)
      .maybeSingle();
    if (!data) throw new Error("Serviço do catálogo indisponível neste workspace.");
    service = data;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const now = new Date();
  const title =
    input.title?.trim() ||
    (deal?.name
      ? `${template.name} — ${deal.name}`
      : company?.name
        ? `${template.name} — ${company.name}`
        : template.name);

  const validityDays = source
    ? (proposalTerms?.validity_days ?? DEFAULT_VALIDITY_DAYS)
    : ((defaults.validity_days as number) ?? null);
  const startsAt =
    (defaults.starts_at as string) ?? (source ? now.toISOString().slice(0, 10) : null);
  const contract = {
    number: generateNumber(),
    title,
    starts_at: startsAt,
    ends_at:
      (defaults.ends_at as string) ??
      (startsAt && validityDays ? endFromValidity(startsAt, validityDays) : null),
    validity_days: validityDays,
    installments_count: proposalTerms?.installments_count ?? null,
    installments_due_day: proposalTerms?.installments_due_day ?? null,
    notice_days: (defaults.notice_days as number) ?? 30,
    total_value: source
      ? (source.proposal.total_amount ?? 0)
      : ((defaults.total_value as number) ?? deal?.value ?? service?.base_price ?? 0),
    monthly_value: (defaults.monthly_value as number) ?? null,
    currency: source
      ? (source.proposal.currency ?? "BRL")
      : ((defaults.currency as string) ?? deal?.currency ?? service?.currency ?? "BRL"),
    payment_day:
      (defaults.payment_day as number) ?? proposalTerms?.installments_due_day ?? null,
    payment_method: (defaults.payment_method as string) ?? null,
    readjustment_index: (defaults.readjustment_index as string) ?? null,
    penalty_percent: pickTerm<number>(
      null,
      defaults.penalty_percent as number | null,
      DEFAULT_PENALTY_PERCENT,
    ),
    service_type: template.service_type ?? service?.service_type ?? null,
    service_scope: (defaults.service_scope as string) ?? service?.description ?? null,
    service_location: (defaults.service_location as string) ?? null,
    jurisdiction: pickTerm<string>(
      null,
      defaults.jurisdiction as string | null,
      DEFAULT_JURISDICTION,
    ),
    governing_law: (defaults.governing_law as string) ?? null,
  };

  const ctx = {
    contract,
    proposal: source
      ? {
          id: source.proposal.id,
          title: source.proposal.title,
          version: source.proposal.version,
          decided_at: new Date(source.decided_at).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
        }
      : null,
    counterparty: {
      name: company?.name ?? null,
      cnpj: company?.cnpj ?? null,
      address: company?.address ?? null,
      city: company?.city ?? null,
      state: company?.state ?? null,
    },
    contracting: {
      name: entity?.name ?? null,
      cnpj: entity?.cnpj ?? null,
      address: legalEntityAddress(entity?.address_json),
    },
    signer: {
      full_name: signer
        ? [signer.first_name, signer.last_name].filter(Boolean).join(" ")
        : null,
      cpf: (signer?.custom_fields?.cpf as string) ?? null,
      email: signer?.email ?? null,
    },
    contact: {
      full_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : null,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
    },
    deal: { name: deal?.name ?? null, value: deal?.value ?? null },
    service: {
      name: service?.name ?? null,
      description: service?.description ?? null,
      unit: service?.unit ?? null,
      base_price: service?.base_price ?? null,
    },
    today: now.toLocaleDateString("pt-BR"),
    today_long: now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    agent: { name: profile?.full_name ?? null, email: profile?.email ?? null },
  };

  return { ctx, contract, company, deal, entity, source, requiresProposal };
}
