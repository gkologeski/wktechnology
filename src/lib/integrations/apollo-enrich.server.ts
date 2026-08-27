/**
 * Enriquecimento Apollo.io em cascata (server-only).
 *
 * Estratégia:
 *  1) descobrir o domínio da empresa (site, e-mail corporativo ou busca por nome);
 *  2) enriquecer a empresa pelo domínio (dado mais confiável);
 *  3) enriquecer a pessoa por LinkedIn / e-mail / nome + domínio.
 *
 * As chamadas passam pelo connector gateway da Lovable quando há
 * LOVABLE_API_KEY (padrão do projeto); sem ela, caem para a API direta.
 */

import { getPublicAppUrl } from "@/lib/app-url";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";

const APOLLO_BASE = "https://api.apollo.io";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "me.com",
  "protonmail.com",
  "aol.com",
]);

export type ApolloCompanyData = {
  name?: string | null;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedin_company_page?: string | null;
  facebook_company_page?: string | null;
  twitterhandle?: string | null;
  annualrevenue?: number | null;
  description?: string | null;
  address?: string | null;
  cep?: string | null;
  timezone?: string | null;
};

export type ApolloPersonData = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  twitter_handle?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  cep?: string | null;
};

type ApolloOrg = {
  name?: string | null;
  primary_domain?: string | null;
  website_url?: string | null;
  industry?: string | null;
  estimated_num_employees?: number | null;
  phone?: string | null;
  primary_phone?: { number?: string | null } | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  annual_revenue?: number | null;
  short_description?: string | null;
  seo_description?: string | null;
  street_address?: string | null;
  raw_address?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
};

type ApolloPerson = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  present_raw_address?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  phone_numbers?: { sanitized_number?: string; raw_number?: string; type?: string }[];
  organization?: ApolloOrg | null;
};

/**
 * URL do webhook de telefone da Apollo (entrega assíncrona do número revelado).
 *
 * A Apollo exige `webhook_url` sempre que `reveal_phone_number` é usado e não
 * envia headers customizados — por isso o segredo (`APOLLO_WEBHOOK_SECRET`)
 * viaja na querystring, exatamente como a rota pública espera. Sem o segredo
 * configurado a rota recusaria a entrega (503/401), então preferimos não pedir
 * a revelação a queimar crédito em um número que nunca chegaria.
 */
export function apolloPhoneWebhookUrl(): string | null {
  const secret = process.env["APOLLO_WEBHOOK_SECRET"];
  if (!secret || !secret.trim()) return null;

  const configured = process.env["APOLLO_PHONE_WEBHOOK_URL"];
  const candidate =
    configured && configured.trim()
      ? configured.trim()
      : `${getPublicAppUrl()}/api/public/hooks/apollo-phone`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    url.searchParams.set("secret", secret.trim());
    return url.toString();
  } catch {
    return null;
  }
}

/** Mensagem de diagnóstico quando a revelação de telefone não pode ser pedida. */
export const APOLLO_PHONE_WEBHOOK_MISSING =
  "Revelação de telefone desativada: configure APOLLO_WEBHOOK_SECRET (e um host público https) para receber os números da Apollo.";


export class ApolloNotConfiguredError extends Error {
  constructor() {
    super("Apollo.io não conectado. Conecte o Apollo em Configurações → Conectores.");
    this.name = "ApolloNotConfiguredError";
  }
}

/** Créditos do Apollo esgotados — enriquecimento indisponível, não é bug. */
export class ApolloCreditsError extends Error {
  constructor() {
    super("Créditos do Apollo.io esgotados. Atualize o plano para voltar a enriquecer.");
    this.name = "ApolloCreditsError";
  }
}

/** Chave sem permissão para o endpoint (ex.: people search exige master key). */
export class ApolloAccessError extends Error {
  constructor(detail: string) {
    super(`A chave do Apollo.io não tem acesso a este endpoint. ${detail}`.trim());
    this.name = "ApolloAccessError";
  }
}

async function apolloFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown },
): Promise<T> {
  const connectionKey = process.env.APOLLO_API_KEY;
  if (!connectionKey) throw new ApolloNotConfiguredError();
  const lovableKey = process.env.LOVABLE_API_KEY;

  const base = lovableKey ? GATEWAY_URL : APOLLO_BASE;
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v) url.searchParams.append(k, v);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (lovableKey) {
    headers.Authorization = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = connectionKey;
  } else {
    headers["X-Api-Key"] = connectionKey;
  }
  if (init.method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: init.method,
    headers,
    ...(init.method === "POST" && init.body !== undefined
      ? { body: JSON.stringify(init.body) }
      : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 422 && /insufficient credits/i.test(text)) {
      throw new ApolloCreditsError();
    }
    if (res.status === 401 || res.status === 403) {
      throw new ApolloAccessError(text.slice(0, 200));
    }
    throw new Error(`Apollo erro [${res.status}]: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/** Extrai o host de uma URL/valor livre; retorna null se não parecer domínio. */
export function normalizeDomain(raw?: string | null): string | null {
  if (!raw) return null;
  let v = String(raw).trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split("/")[0]!.split("?")[0]!.split("#")[0]!;
  if (!v.includes(".") || v.includes(" ")) return null;
  return v;
}

/** Domínio de um e-mail corporativo (ignora provedores gratuitos). */
export function domainFromEmail(email?: string | null): string | null {
  const at = String(email ?? "").split("@")[1];
  const d = normalizeDomain(at);
  if (!d || FREE_EMAIL_DOMAINS.has(d)) return null;
  return d;
}

/** Extrai o @handle de uma URL de rede social (ex.: twitter.com/acme → acme). */
function handleFromUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const m = String(raw).trim().replace(/\/+$/, "").split("/").pop();
  return m ? m.replace(/^@/, "") : null;
}

function mapOrg(org?: ApolloOrg | null): ApolloCompanyData | null {
  if (!org) return null;
  return {
    name: org.name ?? null,
    domain: normalizeDomain(org.primary_domain ?? org.website_url ?? null),
    website: org.website_url ?? (org.primary_domain ? `https://${org.primary_domain}` : null),
    industry: org.industry ?? null,
    size: org.estimated_num_employees ? String(org.estimated_num_employees) : null,
    phone: org.primary_phone?.number ?? org.phone ?? null,
    city: org.city ?? null,
    state: org.state ?? null,
    country: org.country ?? null,
    linkedin_company_page: org.linkedin_url ?? null,
    facebook_company_page: org.facebook_url ?? null,
    twitterhandle: handleFromUrl(org.twitter_url),
    annualrevenue: typeof org.annual_revenue === "number" ? org.annual_revenue : null,
    description: org.short_description ?? org.seo_description ?? null,
    address: org.street_address ?? org.raw_address ?? null,
    cep: org.postal_code ?? null,
    timezone: org.timezone ?? null,
  };
}

/** Busca o domínio da empresa pelo nome (Apollo company search). */
export async function apolloFindDomainByName(companyName: string): Promise<string | null> {
  const data = await apolloFetch<{ organizations?: ApolloOrg[]; accounts?: ApolloOrg[] }>(
    "/api/v1/mixed_companies/search",
    {
      method: "POST",
      // O endpoint aceita os filtros na query string, mas alguns ambientes só
      // consideram o corpo — enviamos nos dois para não falhar em silêncio.
      query: { q_organization_name: companyName, per_page: "5", page: "1" },
      body: { q_organization_name: companyName, per_page: 5, page: 1 },
    },
  );

  const list = [...(data.organizations ?? []), ...(data.accounts ?? [])];
  for (const org of list) {
    const d = normalizeDomain(org.primary_domain ?? org.website_url ?? null);
    if (d) return d;
  }
  return null;
}

/** Enriquecimento da empresa pelo domínio. */
export async function apolloOrganizationEnrich(domain: string): Promise<ApolloCompanyData | null> {
  const data = await apolloFetch<{ organization?: ApolloOrg }>("/api/v1/organizations/enrich", {
    method: "GET",
    query: { domain },
  });
  return mapOrg(data.organization);
}

/** Enriquecimento da pessoa: LinkedIn > e-mail > nome + domínio > nome + empresa. */
export async function apolloPeopleMatch(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  domain?: string | null;
  company_name?: string | null;
}): Promise<{
  person: ApolloPersonData;
  company: ApolloCompanyData | null;
  /** Id da pessoa na Apollo — chave de correlação do webhook de telefone. */
  personId: string | null;
  /** Indica se a revelação assíncrona de telefone foi solicitada. */
  phoneRevealRequested: boolean;
} | null> {
  const params: Record<string, unknown> = {
    reveal_personal_emails: true,
  };
  // A Apollo rejeita `reveal_phone_number` sem `webhook_url` (400
  // SEARCH.VALIDATION.WEBHOOK_URL_REQUIRED). Só pedimos a revelação quando
  // há um webhook https válido para receber os números de forma assíncrona.
  const webhookUrl = apolloPhoneWebhookUrl();
  if (webhookUrl) {
    params.reveal_phone_number = true;
    params.webhook_url = webhookUrl;
  }

  if (input.linkedin_url) params.linkedin_url = input.linkedin_url;
  else if (input.email) params.email = input.email;
  else if (input.first_name && (input.domain || input.company_name)) {
    params.first_name = input.first_name;
    if (input.last_name) params.last_name = input.last_name;
    if (input.domain) params.domain = input.domain;
    if (input.company_name) params.organization_name = input.company_name;
  } else {
    return null;
  }

  const data = await apolloFetch<{ person?: ApolloPerson }>("/api/v1/people/match", {
    method: "POST",
    body: params,
  });
  const p = data.person;
  if (!p) return null;

  const phones = p.phone_numbers ?? [];
  const isMobile = (n: { type?: string }) => (n.type ?? "").toLowerCase().includes("mobile");
  const work = phones.find((n) => !isMobile(n));
  const mobile = phones.find(isMobile);
  const num = (n?: { sanitized_number?: string; raw_number?: string }) =>
    n?.sanitized_number ?? n?.raw_number ?? null;
  const mobileNumber = num(mobile);
  const workNumber = num(work) ?? num(phones[0]);

  return {
    person: {
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      email: p.email ?? null,
      // Celular tem prioridade; o corporativo entra como alternativa.
      phone: mobileNumber ?? workNumber,
      mobile_phone: mobileNumber,

      job_title: p.title ?? null,
      linkedin_url: p.linkedin_url ?? null,
      twitter_handle: handleFromUrl(p.twitter_url),
      city: p.city ?? null,
      state: p.state ?? null,
      country: p.country ?? null,
      address: p.street_address ?? p.present_raw_address ?? null,
      cep: p.postal_code ?? null,
    },
    company: mapOrg(p.organization),
    personId: p.id ?? null,
    phoneRevealRequested: !!webhookUrl,
  };
}

export type ApolloCascadeResult = {
  domain: string | null;
  domainSource: "website" | "email" | "company_search" | null;
  person: ApolloPersonData | null;
  company: ApolloCompanyData | null;
  /** Id da pessoa na Apollo (correlação da entrega assíncrona de telefone). */
  personId?: string | null;
  /** Revelação de telefone pedida à Apollo (chega depois, via webhook). */
  phoneRevealRequested?: boolean;
  /** Falhas parciais do provedor (créditos, permissão, indisponibilidade). */
  warnings: string[];
};

/**
 * Cascata completa: resolve o domínio, enriquece a empresa e depois a pessoa.
 *
 * Cada etapa é tolerante a falhas: erros do provedor (créditos esgotados,
 * permissão da chave, indisponibilidade) viram avisos, para que o
 * enriquecimento parcial ainda seja aproveitado e a qualificação não quebre.
 * Apenas a ausência de conexão (`ApolloNotConfiguredError`) sobe.
 */
export async function runApolloCascade(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  company_name?: string | null;
  website?: string | null;
  domain?: string | null;
}): Promise<ApolloCascadeResult> {
  const warnings: string[] = [];

  async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApolloNotConfiguredError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      if (!warnings.includes(message)) warnings.push(message);
      console.warn(`[apollo] ${label} falhou: ${message}`);
      return null;
    }
  }

  let domain = normalizeDomain(input.domain) ?? normalizeDomain(input.website);
  let domainSource: ApolloCascadeResult["domainSource"] = domain ? "website" : null;

  if (!domain) {
    const fromEmail = domainFromEmail(input.email);
    if (fromEmail) {
      domain = fromEmail;
      domainSource = "email";
    }
  }
  if (!domain && input.company_name) {
    const found = await step("busca de domínio por nome", () =>
      apolloFindDomainByName(input.company_name!),
    );
    if (found) {
      domain = found;
      domainSource = "company_search";
    }
  }

  let company: ApolloCompanyData | null = null;
  if (domain) {
    company = await step("enriquecimento da empresa", () => apolloOrganizationEnrich(domain!));
  }

  // `people/match` consome crédito mesmo quando devolve apenas o eco da
  // entrada. Só chamamos quando há sinal com chance real de acerto:
  // LinkedIn, e-mail corporativo ou nome + domínio resolvido.
  const corporateEmail = !!domainFromEmail(input.email);
  const hasSignal = !!input.linkedin_url || corporateEmail || (!!input.first_name && !!domain);

  let matched: Awaited<ReturnType<typeof apolloPeopleMatch>> | null = null;
  if (hasSignal) {
    matched = await step("enriquecimento da pessoa", () =>
      apolloPeopleMatch({
        first_name: input.first_name,
        last_name: input.last_name,
        email: corporateEmail ? input.email : null,
        linkedin_url: input.linkedin_url,
        domain,
        company_name: input.company_name,
      }),
    );
  } else {
    warnings.push(
      "Sem dados suficientes para enriquecer: informe o site da empresa, um e-mail corporativo ou o LinkedIn do contato.",
    );
  }

  if (!company && matched?.company) company = matched.company;
  if (!domain && company?.domain) {
    domain = company.domain;
    domainSource = "company_search";
  }

  // A Apollo nunca devolve telefone na resposta do match: ele chega depois,
  // pelo webhook. Se a revelação não pôde ser pedida, isso é dito
  // explicitamente para não parecer "a Apollo não tem o número".
  if (matched && !matched.phoneRevealRequested && !warnings.includes(APOLLO_PHONE_WEBHOOK_MISSING)) {
    warnings.push(APOLLO_PHONE_WEBHOOK_MISSING);
  }

  return {
    domain,
    domainSource,
    person: matched?.person ?? null,
    company,
    personId: matched?.personId ?? null,
    phoneRevealRequested: !!matched?.phoneRevealRequested,
    warnings,
  };
}

