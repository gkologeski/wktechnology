// Helpers server-only da importação de contratos:
// - normalização/casamento de números de contrato (vínculo prestação ↔ compra);
// - identificação de contratos cujo CONTRATANTE é uma entidade legal do workspace
//   (elegíveis para associação em TechPeople).
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

/** Normaliza número de contrato para comparação tolerante (C-202608/0031 → C2026080031). */
export function normalizeContractNumber(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export type OwnEntity = {
  id: string;
  name: string;
  cnpjDigits: string;
  tradeName: string | null;
};

/** Entidades legais (CNPJs próprios) do workspace. */
export async function loadOwnLegalEntities(
  supabase: Client,
  workspaceId: string,
): Promise<OwnEntity[]> {
  const { data, error } = await supabase
    .from("legal_entities")
    .select("id, name, trade_name, cnpj")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as { id: string; name: string; trade_name: string | null; cnpj: string | null };
    return {
      id: row.id,
      name: row.name,
      tradeName: row.trade_name,
      cnpjDigits: onlyDigits(row.cnpj),
    } satisfies OwnEntity;
  });
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a|cia|e)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Retorna a entidade legal do workspace correspondente ao CONTRATANTE do contrato.
 * Casa primeiro por CNPJ (14 dígitos) e, na ausência dele, pelo nome/nome fantasia.
 */
export function matchOwnEntity(
  entities: OwnEntity[],
  contractingCnpj: string | null | undefined,
  contractingName: string | null | undefined,
): OwnEntity | null {
  const digits = onlyDigits(contractingCnpj);
  if (digits.length === 14) {
    const byCnpj = entities.find((e) => e.cnpjDigits === digits);
    if (byCnpj) return byCnpj;
  }
  const name = normalizeName(contractingName);
  if (name.length >= 4) {
    const byName = entities.find((e) => {
      const a = normalizeName(e.name);
      const b = normalizeName(e.tradeName);
      return (
        (a.length >= 4 && (a === name || a.includes(name) || name.includes(a))) ||
        (b.length >= 4 && (b === name || b.includes(name) || name.includes(b)))
      );
    });
    if (byName) return byName;
  }
  return null;
}

export type LinkCandidate = {
  id: string;
  number: string | null;
  selfNumber: string | null;
};

/**
 * Resolve o contrato de prestação citado por um contrato de compra.
 * Compara os números citados com `contracts.number` e com o número impresso
 * no documento original (`metadata.self_contract_number`).
 */
export function resolveReferencedContract(
  referenced: string[],
  candidates: LinkCandidate[],
): { id: string; matchedNumber: string } | null {
  const refs = referenced.map(normalizeContractNumber).filter((r) => r.length >= 4);
  if (!refs.length) return null;
  for (const ref of refs) {
    const hit = candidates.find((c) => {
      const a = normalizeContractNumber(c.number);
      const b = normalizeContractNumber(c.selfNumber);
      return (
        (a.length >= 4 && (a === ref || a.endsWith(ref) || ref.endsWith(a))) ||
        (b.length >= 4 && (b === ref || b.endsWith(ref) || ref.endsWith(b)))
      );
    });
    if (hit) return { id: hit.id, matchedNumber: ref };
  }
  return null;
}
