// Contrato de compra (fornecedor PJ ou profissional PF) criado a partir de um
// contrato de venda. O vínculo de origem é interno: documentos e preços de venda
// não são herdados pela compra nem apresentados à fornecedora.
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

export type PurchaseFromSaleInput = {
  saleContractId: string;
  counterpartyKind: "company" | "person";
  companyId?: string | null;
  contactId?: string | null;
  title?: string | null;
  /** Outras vendas (contratos ou aditivos com negócio próprio) atendidas pela mesma compra. */
  extraSaleIds?: string[];
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
  legal_entity_id?: string | null;
  currency: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export function purchaseTitle(_saleTitle: string | null, supplier: string): string {
  return `[COMPRA] ${supplier}`.slice(0, 300);
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
      "id,title,number,role,document_kind,workspace_id,proposal_id,quote_id,deal_id,contracting_legal_entity_id,legal_entity_id,currency,starts_at,ends_at",
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

  const extraIds = [...new Set(input.extraSaleIds ?? [])].filter((id) => id !== sale.id);
  let extras: { starts_at: string | null; ends_at: string | null }[] = [];
  if (extraIds.length) {
    const { data: ex, error: ee } = await supabase
      .from("contracts")
      .select("id,starts_at,ends_at,role")
      .eq("workspace_id", workspaceId)
      .in("id", extraIds);
    if (ee) throw new Error(ee.message);
    const ok = (ex ?? []).filter((r: { role: string | null }) => r.role === "provider");
    if (ok.length !== extraIds.length)
      throw new Error("Uma das vendas adicionais não foi encontrada.");
    extras = ok as typeof extras;
  }

  // Vigência: venda + vendas adicionais + aditivos ativos + projetos ligados à venda/negócio.
  const [{ data: amendments }, { data: projects }] = await Promise.all([
    supabase
      .from("contracts")
      .select("starts_at,ends_at,status")
      .eq("workspace_id", workspaceId)
      .eq("parent_contract_id", sale.id)
      .eq("document_kind", "amendment")
      .not("status", "in", "(terminated,draft)"),
    supabase
      .from("projects")
      .select("starts_at,due_at,status")
      .eq("workspace_id", workspaceId)
      .or(
        sale.deal_id
          ? `contract_id.eq.${sale.id},deal_id.eq.${sale.deal_id}`
          : `contract_id.eq.${sale.id}`,
      )
      .neq("status", "cancelled"),
  ]);
  const { suggestPurchaseTerm } = await import("./purchase-term");
  const term = suggestPurchaseTerm(
    [
      sale,
      ...extras,
      ...((amendments ?? []) as { starts_at: string | null; ends_at: string | null }[]),
      ...((projects ?? []) as { starts_at: string | null; due_at: string | null }[]).map((p) => ({
        starts_at: p.starts_at,
        ends_at: p.due_at,
      })),
    ],
    new Date().toISOString(),
  );

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
      // The parent and contract_purchase_sales preserve internal traceability.
      // A sale's quote/proposal/deal must never become a supplier's document.
      proposal_id: null,
      quote_id: null,
      deal_id: null,
      contracting_legal_entity_id: sale.contracting_legal_entity_id ?? sale.legal_entity_id ?? null,
      currency: sale.currency ?? "BRL",
      total_value: 0,
      starts_at: term.starts_at,
      ends_at: term.ends_at,
    },
  });
  if (extraIds.length) {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    for (const saleId of extraIds)
      await workRpc(supabase, "contract_purchase_sale_set", {
        p_purchase: (result.contract as { id: string }).id,
        p_sale: saleId,
        p_link: true,
      });
  }
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
      "id,role,status,title,starts_at,counterparty_kind,counterparty_company_id,counterparty_contact_id,contracting_legal_entity_id,legal_entity_id,metadata",
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
      ...((c.contracting_legal_entity_id ?? c.legal_entity_id)
        ? { contractingLegalEntityId: c.contracting_legal_entity_id ?? c.legal_entity_id }
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

// Vendas atendidas por uma compra: principal (parent_contract_id) + adicionais (contract_purchase_sales).
export type PurchaseSaleRow = {
  id: string;
  number: string | null;
  title: string | null;
  status: string;
  total_value: number;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  deal_id: string | null;
  deal_title: string | null;
  primary: boolean;
};

const COLS =
  "id,number,title,status,total_value,currency,starts_at,ends_at,deal_id,role,parent_contract_id";

export async function listPurchaseSalesFor(supabase: SupabaseClient, contractId: string) {
  const sb = supabase as any;
  const { data: c, error } = await sb
    .from("contracts")
    .select(COLS)
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Contrato não encontrado.");
  let ids: string[] = [];
  let primaryId: string | null = null;
  if (c.role === "client") {
    const { data: links, error: e } = await sb
      .from("contract_purchase_sales")
      .select("sale_contract_id")
      .eq("purchase_contract_id", contractId);
    if (e) throw new Error(e.message);
    primaryId = c.parent_contract_id;
    ids = [primaryId, ...(links ?? []).map((l: any) => l.sale_contract_id)].filter(Boolean);
  } else {
    const { data: links, error: e } = await sb
      .from("contract_purchase_sales")
      .select("purchase_contract_id")
      .eq("sale_contract_id", contractId);
    if (e) throw new Error(e.message);
    ids = (links ?? []).map((l: any) => l.purchase_contract_id);
  }
  if (!ids.length) return { role: c.role as string, rows: [] as PurchaseSaleRow[] };
  const { data: rows, error: re } = await sb.from("contracts").select(COLS).in("id", ids);
  if (re) throw new Error(re.message);
  const dealIds = [...new Set((rows ?? []).map((r: any) => r.deal_id).filter(Boolean))];
  const deals = new Map<string, string>();
  if (dealIds.length) {
    const { data: d } = await sb.from("deals").select("id,name").in("id", dealIds);
    for (const x of d ?? []) deals.set(x.id, x.name);
  }
  return {
    role: c.role as string,
    rows: (rows ?? [])
      .map(
        (r: any): PurchaseSaleRow => ({
          id: r.id,
          number: r.number,
          title: r.title,
          status: r.status,
          total_value: Number(r.total_value ?? 0),
          currency: r.currency ?? "BRL",
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          deal_id: r.deal_id,
          deal_title: r.deal_id ? (deals.get(r.deal_id) ?? null) : null,
          primary: r.id === primaryId,
        }),
      )
      .sort((a: PurchaseSaleRow, b: PurchaseSaleRow) => Number(b.primary) - Number(a.primary)),
  };
}
