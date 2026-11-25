import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAnyArea } from "@/lib/access-control/sales-core.server";
import { normalizeCnpj, onlyDigits } from "@/lib/cnpj";
import { sourcePhone } from "@/lib/phone/phone-boundary";

export type CnpjLookupSource = "brasilapi" | "receitaws";

export type PublicCnpjRecord = {
  cnpj: string;
  source: CnpjLookupSource;
  razao_social: string;
  nome_fantasia: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  address_line: string;
  phone: string;
  email: string;
  industry: string;
  size: string;
};

export type CnpjLookupFailureReason =
  | "invalid_cnpj"
  | "not_found"
  | "rate_limited"
  | "service_unavailable";

export type CnpjLookupResult =
  | { ok: true; data: PublicCnpjRecord }
  | { ok: false; reason: CnpjLookupFailureReason; message: string };

type ProbeResult =
  | { status: "found"; data: PublicCnpjRecord }
  | { status: "not_found" | "rate_limited" | "service_unavailable" };

const LOOKUP_TIMEOUT_MS = 8000;

function text(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v.trim() : "";
}

function formatCep(raw: string): string {
  const d = onlyDigits(raw);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : "";
}

function joinAddressLine(parts: string[]): string {
  return parts.filter(Boolean).join(", ").trim();
}

function readBrasilApiSize(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const desc = (raw as Record<string, unknown>)["descricao"];
    if (typeof desc === "string") return desc.trim();
  }
  return "";
}

function readReceitaWsIndustry(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const first = raw[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const label = (first as Record<string, unknown>)["text"];
    if (typeof label === "string") return label.trim();
  }
  return "";
}

async function fetchProviderJson(
  url: string,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: "not_found" | "rate_limited" | "service_unavailable" }
> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      redirect: "manual",
    });
    if (r.status === 404) return { ok: false, status: "not_found" };
    if (r.status === 429) return { ok: false, status: "rate_limited" };
    if (!r.ok) return { ok: false, status: "service_unavailable" };
    const body: unknown = await r.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, status: "service_unavailable" };
    }
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return { ok: false, status: "service_unavailable" };
  }
}

async function probeBrasilApi(cnpj: string): Promise<ProbeResult> {
  const res = await fetchProviderJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) return { status: res.status };
  const d = res.body;
  const razaoSocial = text(d, "razao_social");
  const returnedCnpj = text(d, "cnpj");
  if (!razaoSocial && !returnedCnpj) return { status: "service_unavailable" };

  const prefix = text(d, "descricao_tipo_de_logradouro");
  const rawStreet = text(d, "logradouro");
  const street =
    prefix && !rawStreet.toUpperCase().startsWith(prefix.toUpperCase())
      ? `${prefix} ${rawStreet}`.trim()
      : rawStreet;
  const number = text(d, "numero");
  const complement = text(d, "complemento");
  const neighborhood = text(d, "bairro");

  return {
    status: "found",
    data: {
      cnpj,
      source: "brasilapi",
      razao_social: razaoSocial,
      nome_fantasia: text(d, "nome_fantasia"),
      street,
      number,
      complement,
      neighborhood,
      city: text(d, "municipio"),
      state: text(d, "uf"),
      cep: formatCep(text(d, "cep")),
      address_line: joinAddressLine([rawStreet, number, complement, neighborhood]),
      // Cadastro da Receita Federal: número brasileiro (país comprovado pela fonte).
      phone: sourcePhone(text(d, "ddd_telefone_1"), "BR") ?? "",
      email: text(d, "email"),
      industry: text(d, "cnae_fiscal_descricao"),
      size: readBrasilApiSize(d["porte"]),
    },
  };
}

async function probeReceitaWs(cnpj: string): Promise<ProbeResult> {
  const res = await fetchProviderJson(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
  if (!res.ok) return { status: res.status };
  const d = res.body;
  const status = text(d, "status").toUpperCase();
  if (status === "ERROR") {
    const msg = text(d, "message").toLowerCase();
    if (/too many|rate|limit|limite|muitas requisi/i.test(msg)) {
      return { status: "rate_limited" };
    }
    if (/não encontrado|nao encontrado|not found|inexistente|cnpj inv/i.test(msg)) {
      return { status: "not_found" };
    }
    return { status: "service_unavailable" };
  }
  const razaoSocial = text(d, "nome");
  if (!razaoSocial) return { status: "service_unavailable" };

  const street = text(d, "logradouro");
  const number = text(d, "numero");
  const complement = text(d, "complemento");
  const neighborhood = text(d, "bairro");

  return {
    status: "found",
    data: {
      cnpj,
      source: "receitaws",
      razao_social: razaoSocial,
      nome_fantasia: text(d, "fantasia"),
      street,
      number,
      complement,
      neighborhood,
      city: text(d, "municipio"),
      state: text(d, "uf"),
      cep: formatCep(text(d, "cep")),
      address_line: joinAddressLine([street, number, complement, neighborhood]),
      phone: sourcePhone(text(d, "telefone"), "BR") ?? "",
      email: text(d, "email"),
      industry: readReceitaWsIndustry(d["atividade_principal"]),
      size: text(d, "porte"),
    },
  };
}

export async function lookupPublicCnpj(
  rawCnpj: string | null | undefined,
): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj) {
    return {
      ok: false,
      reason: "invalid_cnpj",
      message: "CNPJ inválido. Confira os dígitos informados.",
    };
  }

  const primary = await probeBrasilApi(cnpj);
  if (primary.status === "found") return { ok: true, data: primary.data };

  const fallback = await probeReceitaWs(cnpj);
  if (fallback.status === "found") return { ok: true, data: fallback.data };

  if (primary.status === "not_found" && fallback.status === "not_found") {
    return {
      ok: false,
      reason: "not_found",
      message: "CNPJ não encontrado nas bases públicas.",
    };
  }

  if (primary.status === "rate_limited" || fallback.status === "rate_limited") {
    return {
      ok: false,
      reason: "rate_limited",
      message:
        "O serviço público de consulta de CNPJ (BrasilAPI/ReceitaWS) atingiu o limite temporário de requisições. Tente novamente em instantes.",
    };
  }

  return {
    ok: false,
    reason: "service_unavailable",
    message:
      "O serviço público de consulta de CNPJ (BrasilAPI/ReceitaWS) está temporariamente instável. Tente novamente em instantes.",
  };
}

/** Authorized CRM/TechSales CNPJ lookup wrapper (enforces active workspace permission before external IO). */
export async function lookupCompanyCnpjForSales(
  client: SupabaseClient,
  rawCnpj: string | null | undefined,
): Promise<CnpjLookupResult> {
  await assertSalesAnyArea(client, "techsales.prospecting_enrichment", "manage");
  return lookupPublicCnpj(rawCnpj);
}
