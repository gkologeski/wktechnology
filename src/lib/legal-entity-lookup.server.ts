import { isValidCnpj, onlyDigits } from "./cnpj";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeFinanceBusiness } from "./access-control/finance-business.server";
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
  const cnpj = onlyDigits(rawCnpj);
  if (!isValidCnpj(cnpj)) throw new Error("CNPJ inválido");
  for (const source of ["brasilapi", "receitaws"] as const) {
    const d = await publicJson(
      source === "brasilapi"
        ? `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
        : `https://receitaws.com.br/v1/cnpj/${cnpj}`,
    );
    if (!d || d["status"] === "ERROR") continue;
    const text = (key: string) => (typeof d[key] === "string" ? d[key].trim() : "");
    const name = text(source === "brasilapi" ? "razao_social" : "nome");
    if (!name) continue;
    const prefix = text("descricao_tipo_de_logradouro");
    const street = text("logradouro");
    return {
      name,
      trade_name: text(source === "brasilapi" ? "nome_fantasia" : "fantasia"),
      source,
      address: readLegalEntityAddress({
        street:
          prefix && !street.toUpperCase().startsWith(prefix.toUpperCase())
            ? `${prefix} ${street}`.trim()
            : street,
        number: text("numero"),
        complement: text("complemento"),
        neighborhood: text("bairro"),
        city: text("municipio"),
        state: text("uf"),
        zip_code: formatLegalEntityCep(text("cep")),
      }),
    };
  }
  throw new Error(
    "Não foi possível consultar o CNPJ. Tente novamente ou preencha os dados manualmente.",
  );
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
