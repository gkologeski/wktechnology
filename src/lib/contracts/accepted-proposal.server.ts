import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { DealLineItemRow } from "./contract-create.server";

export type AcceptedProposalSource = {
  workspace_id: string;
  decided_at: string;
  proposal: {
    id: string;
    title: string;
    body: string;
    version: number;
    company_id: string | null;
    deal_id: string | null;
    quote_id: string | null;
    total_amount: number | null;
    currency: string | null;
    assigned_to: string | null;
  };
  company: {
    id: string;
    name: string;
    cnpj: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone?: string | null;
  } | null;
  agent: string | null;
  items: DealLineItemRow[];
};

/** User client only: the RPC enforces accepted status and both tables' RLS. */
export async function loadAcceptedProposalSource(
  client: SupabaseClient,
  workspaceId: string,
  id: string,
) {
  const source = await workRpc<AcceptedProposalSource>(client, "proposal_contract_source", {
    p_id: id,
  });
  if (!source || source.workspace_id !== workspaceId)
    throw new Error("Proposta Comercial indisponível neste workspace.");
  return source;
}

export function legalEntityAddress(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as Record<string, unknown>;
  const parts = [
    a.street ?? a.logradouro,
    a.number ?? a.numero,
    a.complement ?? a.complemento,
    a.neighborhood ?? a.bairro,
    a.city ?? a.cidade,
    a.state ?? a.uf,
    a.zip_code ?? a.zip ?? a.cep,
  ];
  return (
    parts
      .filter((p) => typeof p === "string" || typeof p === "number")
      .map(String)
      .filter((p) => p.trim())
      .join(", ") || null
  );
}
