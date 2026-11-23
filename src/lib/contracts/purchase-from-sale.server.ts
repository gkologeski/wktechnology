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
    if (input.counterpartyKind === "person" && c.company_id)
      throw new Error("Para pessoa física, escolha um contato sem empresa vinculada.");
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

/** Aplica um modelo de compra publicado ao rascunho de compra, com a contraparte do próprio contrato. */
export async function fillPurchaseBody(
  supabase: SupabaseClient,
  userId: string,
  input: { contractId: string; templateId: string },
) {
  const workspaceId = await resolveActiveWorkspace(userId);
  await assertAnyPermission(supabase, userId, workspaceId, [
    "techcontracts.contracts.update.own",
    "techcontracts.contracts.update.team",
    "techcontracts.contracts.update.workspace",
  ]);
  const sb = supabase as any;
  const { data: c, error } = await sb
    .from("contracts")
    .select(
      "id,role,status,title,starts_at,counterparty_kind,counterparty_company_id,counterparty_contact_id,contracting_legal_entity_id,metadata",
    )
    .eq("id", input.contractId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.role !== "client") throw new Error("Use esta opção apenas em contratos de compra.");
  if (c.status !== "draft") throw new Error("Só é possível preencher contratos em rascunho.");
  const { data: t, error: te } = await sb
    .from("contract_templates")
    .select("*")
    .eq("id", input.templateId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (te) throw new Error(te.message);
  if (!t) throw new Error("Modelo não encontrado.");
  if (t.status !== "published") throw new Error("Publique o modelo antes de usá-lo.");
  if (t.role !== "client") throw new Error("Escolha um modelo do tipo Compra.");

  const [{ buildMergeContext }, { mergeTemplateBody, templateFieldStatus }] = await Promise.all([
    import("./template-merge.server"),
    import("./template-tokens"),
  ]);
  const person = c.counterparty_kind === "person";
  const { ctx, contract } = await buildMergeContext(
    supabase,
    workspaceId,
    userId,
    {
      templateId: t.id,
      title: c.title ?? undefined,
      ...(person && c.counterparty_contact_id
        ? { personContactId: c.counterparty_contact_id }
        : {}),
      ...(!person && c.counterparty_company_id ? { companyId: c.counterparty_company_id } : {}),
      ...(!person && c.counterparty_contact_id ? { contactId: c.counterparty_contact_id } : {}),
      ...(c.contracting_legal_entity_id
        ? { contractingLegalEntityId: c.contracting_legal_entity_id }
        : {}),
    },
    t,
  );
  const startsAt = c.starts_at ?? contract.starts_at;
  const merged = { ...ctx, contract: { ...contract, title: c.title, starts_at: startsAt } };
  const body = mergeTemplateBody(t.body_html ?? "", merged, { keepUnknown: true });
  // Gravação pela RPC oficial de contratos (mesmas regras de acesso da ficha).
  const { workRpc } = await import("@/lib/access-control/work-core.server");
  await workRpc(supabase, "contract_mutate", {
    p_contract: c.id,
    p_patch: {
      body_html: body,
      starts_at: startsAt,
      metadata: {
        ...(c.metadata ?? {}),
        contract_template_id: t.id,
        contract_template_name: t.name,
      },
    },
  });
  return {
    missing: templateFieldStatus(t.body_html ?? "", merged)
      .filter((f: { missing: boolean }) => f.missing)
      .map((f: { label: string }) => f.label),
  };
}

/** Modelos de compra publicados do workspace ativo (RLS do usuário). */
export async function listPurchaseTemplates(supabase: SupabaseClient, userId: string) {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { data, error } = await (supabase as any)
    .from("contract_templates")
    .select("id,name")
    .eq("workspace_id", workspaceId)
    .eq("role", "client")
    .eq("status", "published")
    .order("name")
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}
