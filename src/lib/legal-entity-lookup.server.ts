import { onlyDigits } from "./cnpj";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeFinanceBusiness } from "./access-control/finance-business.server";
import { lookupPublicCnpj } from "./integrations/cnpj-lookup.server";
import {
  formatLegalEntityCep,
  readLegalEntityAddress,
  type LegalEntityCnpjData,
} from "./legal-entity-address";

async function publicJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Consulta bases públicas (BrasilAPI -> ReceitaWS) sem persistir dados. */
export async function fetchPublicCnpjRegistry(rawCnpj: string): Promise<LegalEntityCnpjData> {
  const result = await lookupPublicCnpj(rawCnpj);
  if (!result.ok) {
    if (result.reason === "invalid_cnpj") throw new Error("CNPJ inválido");
    if (result.reason === "not_found") {
      throw new Error(
        "CNPJ não encontrado nas bases públicas. Confira o número ou preencha os dados manualmente.",
      );
    }
    if (result.reason === "rate_limited") {
      throw new Error(
        "Não foi possível consultar o CNPJ porque o serviço público atingiu o limite temporário de requisições. Tente novamente em instantes ou preencha os dados manualmente.",
      );
    }
    throw new Error(
      "Não foi possível consultar o CNPJ porque o serviço público está temporariamente instável. Tente novamente em instantes ou preencha os dados manualmente.",
    );
  }
  return {
    name: result.data.razao_social,
    trade_name: result.data.nome_fantasia,
    source: result.data.source,
    address: readLegalEntityAddress({
      street: result.data.street,
      number: result.data.number,
      complement: result.data.complement,
      neighborhood: result.data.neighborhood,
      city: result.data.city,
      state: result.data.state,
      zip_code: formatLegalEntityCep(result.data.cep),
    }),
  };
}

export async function lookupLegalEntityCnpj(
  client: SupabaseClient,
  rawCnpj: string,
  id?: string,
): Promise<LegalEntityCnpjData> {
  await authorizeFinanceBusiness(client, "legal_entities", id ? "update" : "create", id);
  return fetchPublicCnpjRegistry(rawCnpj);
}

export async function lookupLegalEntityCep(client: SupabaseClient, rawCep: string, id?: string) {
  await authorizeFinanceBusiness(client, "legal_entities", id ? "update" : "create", id);
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) throw new Error("CEP deve ter oito dígitos");
  const d = await publicJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (!d || d["erro"])
    throw new Error(
      "CEP não encontrado ou consulta indisponível. Preencha o endereço manualmente.",
    );
  const text = (key: string) => (typeof d[key] === "string" ? d[key].trim() : "");
  return {
    street: text("logradouro"),
    neighborhood: text("bairro"),
    city: text("localidade"),
    state: text("uf"),
  };
}
