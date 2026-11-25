import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { assertHrCreate, assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import { fetchPublicCnpjRegistry } from "@/lib/legal-entity-lookup.server";

export type PersonCnpjLookupResult = {
  legal_entity_name: string;
  trade_name: string;
  source: "brasilapi" | "receitaws";
};

/**
 * Consulta CNPJ em bases públicas (BrasilAPI -> ReceitaWS) para sugerir
 * Razão Social e Nome Fantasia na ficha de Prestador PJ.
 * Exige membership ativo, workspace ativo e permissão de edição/criação em TechPeople;
 * não grava nada no banco.
 */
export async function lookupPersonCnpj(
  client: SupabaseClient,
  userId: string,
  rawCnpj: string,
  personId?: string,
): Promise<PersonCnpjLookupResult> {
  if (personId) {
    await getActiveWorkspaceId(client, userId);
    await assertHrRecordAccess(client, "people", "update", personId);
  } else {
    await assertHrCreate(client, userId, "techpeople.people");
  }

  const data = await fetchPublicCnpjRegistry(rawCnpj);
  return {
    legal_entity_name: data.name,
    trade_name: data.trade_name,
    source: data.source,
  };
}
