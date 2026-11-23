// Contrato de compra (fornecedor PJ ou profissional PF) criado a partir de um
// contrato de venda. Usa o cliente do usuário (RLS) e a proposta aceita da venda
// como anexo técnico; os gatilhos do banco validam workspace, contato e origem.
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

export type PurchaseFromSaleInput = {
  saleContractId: string;
  counterpartyKind: "company" | "person";
  companyId?: string | null;
  contactId?: string | null;
  title?: string | null;
};

type Sale = {
  id: string;
  title: string | null;
  number: string | null;
  role: string | null;
  document_kind: string | null;
  workspace_id: string;
  proposal_id: string | null;
  quote_id: string | null;
  deal_id: string | null;
  contracting_legal_entity_id: string | null;
  currency: string | null;
};

export function purchaseTitle(saleTitle: string | null, supplier: string): string {
  const base = (saleTitle ?? "").replace(/^\[(VENDA|PRESTAÇÃO|PRESTACAO)\]\s*/i, "").trim();
  return `[COMPRA] ${supplier}${base ? ` — ${base}` : ""}`.slice(0, 300);
}

export async function purchaseFromSale(
  supabase: SupabaseClient,
  userId: string,
  input: PurchaseFromSaleInput,
) {
  const workspaceId = await resolveActiveWorkspace(userId);
  await assertAnyPermission(supabase, userId, workspaceId, [
    "techcontracts.contracts.create.own",
    "techcontracts.contracts.create.workspace",
  ]);
  if (input.counterpartyKind === "company" && !input.companyId)
    throw new Error("Escolha a empresa fornecedora.");
  if (input.counterpartyKind === "person" && !input.contactId)
    throw new Error("Escolha o profissional (pessoa física).");

  const { data: saleRow, error } = await supabase
    .from("contracts")
    .select(
      "id,title,number,role,document_kind,workspace_id,proposal_id,quote_id,deal_id,contracting_legal_entity_id,currency",
    )
    .eq("id", input.saleContractId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sale = saleRow as Sale | null;
  if (!sale) throw new Error("Contrato de venda não encontrado.");
  if (sale.role !== "provider" || sale.document_kind === "amendment")
    throw new Error("Escolha um contrato de venda principal.");

  let supplierName = "";
  if (input.counterpartyKind === "company") {
    const { data: co, error: e } = await supabase
      .from("companies")
      .select("id,name")
      .eq("id", input.companyId!)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (e) throw new Error(e.message);
    if (!co) throw new Error("Empresa fornecedora não encontrada neste workspace.");
    supplierName = (co as { name: string | null }).name ?? "Fornecedor";
  }
  if (input.contactId) {
    const { data: ct, error: e } = await supabase
      .from("contacts")
      .select("id,first_name,last_name,company_id")
      .eq("id", input.contactId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (e) throw new Error(e.message);
    const c = ct as {
      first_name: string | null;
      last_name: string | null;
      company_id: string | null;
    } | null;
    if (!c) throw new Error("Contato não encontrado neste workspace.");
    if (input.counterpartyKind === "company" && c.company_id !== input.companyId)
      throw new Error("O contato precisa pertencer à empresa fornecedora.");
    if (input.counterpartyKind === "person")
      supplierName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Profissional";
  }

  const { createContractShared } = await import("@/lib/contracts/contract-create.server");
  const result = await createContractShared(supabase, {
    workspaceId,
    userId,
    kind: "client",
    fields: {
      title: input.title?.trim() || purchaseTitle(sale.title, supplierName),
      counterparty_kind: input.counterpartyKind,
      counterparty_company_id: input.counterpartyKind === "company" ? input.companyId! : null,
      counterparty_contact_id: input.contactId ?? null,
      parent_contract_id: sale.id,
      proposal_id: sale.proposal_id,
      quote_id: sale.quote_id,
      deal_id: sale.deal_id,
      contracting_legal_entity_id: sale.contracting_legal_entity_id,
      currency: sale.currency ?? "BRL",
      total_value: 0,
    },
  });
  return { contract: result.contract };
}
