// Conversões comerciais: Cotação -> Proposta -> Contrato.
// Sempre com o cliente autenticado do usuário (RLS aplicada).
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import type { DealLineItemRow } from "@/lib/contracts/contract-create.server";
import { describeBilling } from "@/lib/catalog/billing-model";
import {
  SERVICE_LINE_PROPOSAL_SECTIONS,
  isServiceLine,
  serviceLineFromCatalog,
  serviceLineLabel,
  type ServiceLine,
} from "@/lib/sales/service-line";

const QUOTE_ITEM_COLUMNS =
  "id, name, description, quantity, unit_price, discount_pct, discount_amount, discount_type, tax_rate, unit, billing_model, percent, percent_base_amount, cadence, job_profile_id, seniority, service_catalog_id, contracting_preset_id, position";

type QuoteRow = {
  id: string;
  number: string | null;
  title: string | null;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  currency: string | null;
  total: number | null;
  terms: string | null;
  notes: string | null;
  valid_until: string | null;
  service_line: string | null;
  assigned_to: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(v: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

async function loadQuote(supabase: SupabaseClient, quoteId: string) {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, number, title, deal_id, contact_id, company_id, currency, total, terms, notes, valid_until, service_line, assigned_to",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) throw new Error("Cotação não encontrada");
  const { data: items, error: iErr } = await supabase
    .from("quote_line_items")
    .select(QUOTE_ITEM_COLUMNS)
    .eq("quote_id", quoteId)
    .order("position");
  if (iErr) throw new Error(iErr.message);
  const rows = (items ?? []) as unknown as DealLineItemRow[];
  const catalog = await resolveCatalog(
    supabase,
    rows.map((li) => li.service_catalog_id),
  );
  const q = quote as unknown as QuoteRow;
  // A linha vem do Serviço do Catálogo; o campo antigo da cotação é só reserva.
  const line: ServiceLine | null =
    catalog.line ?? (isServiceLine(q.service_line) ? q.service_line : null);
  return { quote: q, items: rows, serviceIds: catalog.ids, line };
}

/** Serviços do catálogo usados nos itens e a linha de serviço predominante. */
async function resolveCatalog(supabase: SupabaseClient, raw: Array<string | null | undefined>) {
  const ids = [...new Set(raw.filter((v): v is string => !!v))];
  if (!ids.length) return { ids, line: null as ServiceLine | null };
  const { data } = await supabase.from("service_catalog").select("id, code, name").in("id", ids);
  const counts = new Map<ServiceLine, number>();
  for (const s of (data ?? []) as Array<{ code: string | null; name: string | null }>) {
    const l = serviceLineFromCatalog(s);
    if (l) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  let line: ServiceLine | null = null;
  let best = 0;
  for (const [l, n] of counts) if (n > best) [line, best] = [l, n];
  return { ids, line };
}

function proposalBodyFromQuote(
  quote: QuoteRow,
  items: DealLineItemRow[],
  line: ServiceLine | null,
): string {
  const currency = quote.currency ?? "BRL";
  const fmt = (v: number) => money(v, currency);
  const rows = items
    .map(
      (li) =>
        `<tr><td>${esc(li.name ?? "Item")}</td><td>${esc(describeBilling(li, fmt))}</td></tr>`,
    )
    .join("");
  const sections = line
    ? SERVICE_LINE_PROPOSAL_SECTIONS[line]
        .map((t) => `<h2>${esc(t.title)}</h2><p>${esc(t.text)}</p>`)
        .join("")
    : "<h2>Escopo</h2><p></p>";
  return [
    `<h1>${esc(quote.title || `Proposta — cotação ${quote.number ?? ""}`)}</h1>`,
    line ? `<p><strong>Linha de serviço:</strong> ${esc(serviceLineLabel(line) ?? "")}</p>` : "",
    `<h2>Itens e condições comerciais</h2><table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>${rows}</tbody></table>`,
    `<p><strong>Total:</strong> ${esc(fmt(Number(quote.total ?? 0)))}</p>`,
    sections,
    quote.terms ? `<h2>Termos</h2><p>${esc(quote.terms)}</p>` : "",
  ].join("");
}

export async function proposalFromQuote(supabase: SupabaseClient, userId: string, quoteId: string) {
  const workspaceId = await resolveActiveWorkspace(userId);
  const { quote, items, line } = await loadQuote(supabase, quoteId);

  const { data: existing } = await supabase
    .from("proposals")
    .select("id")
    .eq("quote_id", quoteId)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: (existing as { id: string }).id, reused: true };

  const { data: prop, error } = await supabase
    .from("proposals")
    .insert({
      owner_id: userId,
      workspace_id: workspaceId,
      title: quote.title || `Proposta — ${quote.number ?? "cotação"}`,
      body: proposalBodyFromQuote(quote, items, line),
      deal_id: quote.deal_id,
      contact_id: quote.contact_id,
      company_id: quote.company_id,
      total_amount: quote.total != null ? Number(quote.total) : null,
      currency: quote.currency ?? "BRL",
      expires_at: quote.valid_until,
      assigned_to: quote.assigned_to,
      quote_id: quote.id,
      variables: {},
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (prop as { id: string }).id, reused: false };
}

type ProposalOrigin = {
  id: string;
  title: string;
  deal_id: string | null;
  company_id: string | null;
  total_amount: number | null;
  currency: string | null;
  quote_id: string | null;
  assigned_to: string | null;
};

async function loadProposal(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("proposals")
    .select("id, title, deal_id, company_id, total_amount, currency, quote_id, assigned_to")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Proposta não encontrada");
  return data as unknown as ProposalOrigin;
}

/** Modelo de contrato vinculado aos serviços do catálogo (o publicado vence). */
async function findTemplateForServices(supabase: SupabaseClient, serviceIds: string[]) {
  if (!serviceIds.length) return null;
  const { data } = await supabase
    .from("contract_template_services")
    .select("template:contract_templates(id, name, role, status, is_default, body_html, defaults, service_type)")
    .in("service_catalog_id", serviceIds);
  type T = {
    id: string;
    role: string | null;
    status: string | null;
    is_default: boolean | null;
    body_html: string | null;
  } & Record<string, unknown>;
  const rank = (t: T) => (t.status === "published" ? 2 : 0) + (t.is_default ? 1 : 0);
  const list = ((data ?? []) as unknown as Array<{ template: T | null }>)
    .map((r) => r.template)
    .filter((t): t is T => !!t && t.status !== "archived" && (t.role ?? "provider") === "provider")
    .sort((x, y) => rank(y) - rank(x));
  return list[0] ?? null;
}

type ContractFromSalesInput = {
  proposalId?: string;
  quoteId?: string;
  /** Quando informado, gera um termo aditivo deste contrato principal. */
  mainContractId?: string | null;
};

export async function contractFromSales(
  supabase: SupabaseClient,
  userId: string,
  input: ContractFromSalesInput,
) {
  const workspaceId = await resolveActiveWorkspace(userId);
  await assertAnyPermission(supabase, userId, workspaceId, [
    "techcontracts.contracts.create.own",
    "techcontracts.contracts.create.workspace",
  ]);

  const proposal = input.proposalId ? await loadProposal(supabase, input.proposalId) : null;
  const quoteId = input.quoteId ?? proposal?.quote_id ?? null;
  const loaded = quoteId ? await loadQuote(supabase, quoteId) : null;

  // Evita duplicar contrato/aditivo para a mesma origem.
  const origin = proposal
    ? supabase.from("contracts").select("id, number, title").eq("proposal_id", proposal.id)
    : supabase
        .from("contracts")
        .select("id, number, title")
        .eq("quote_id", quoteId as string);
  const { data: dup } = await origin.limit(1).maybeSingle();
  if (dup) return { contract: dup as { id: string }, reused: true, servicesCreated: 0 };

  const quote = loaded?.quote;
  const companyId = proposal?.company_id ?? quote?.company_id ?? null;
  const dealId = proposal?.deal_id ?? quote?.deal_id ?? null;
  const baseTitle = proposal?.title || quote?.title || quote?.number || "cotação";
  const common = {
    counterparty_company_id: companyId,
    total_value:
      proposal?.total_amount != null
        ? Number(proposal.total_amount)
        : quote?.total != null
          ? Number(quote.total)
          : null,
    currency: proposal?.currency ?? quote?.currency ?? null,
    assigned_to: proposal?.assigned_to ?? quote?.assigned_to ?? null,
    service_type: serviceLineLabel(loaded?.line) ?? null,
    proposal_id: proposal?.id ?? null,
    quote_id: quoteId,
  };
  const { createContractShared } = await import("@/lib/contracts/contract-create.server");

  if (input.mainContractId) {
    const { data: main, error } = await supabase
      .from("contracts")
      .select("id, title, role, document_kind, counterparty_company_id")
      .eq("id", input.mainContractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const m = main as {
      id: string;
      title: string | null;
      role: string | null;
      document_kind: string | null;
      counterparty_company_id: string | null;
    } | null;
    if (!m) throw new Error("Contrato principal não encontrado.");
    if (m.document_kind === "amendment") throw new Error("Escolha um contrato principal.");
    if (companyId && m.counterparty_company_id && m.counterparty_company_id !== companyId) {
      throw new Error("O contrato principal pertence a outra empresa.");
    }
    const { count } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("amendment_of_id", m.id);
    const n = (count ?? 0) + 1;
    const result = await createContractShared(supabase, {
      workspaceId,
      userId,
      kind: "amendment",
      role: m.role === "client" ? "client" : "provider",
      fields: {
        ...common,
        title: `${n}º Termo Aditivo — ${m.title ?? baseTitle}`,
        amendment_of_id: m.id,
        amendment_number: String(n),
      },
      dealId,
      items: loaded ? loaded.items : null,
    });
    return { contract: result.contract, reused: false, servicesCreated: 0, amendment: n };
  }

  // Contrato principal: usa o modelo vinculado ao serviço do catálogo.
  const template = await findTemplateForServices(supabase, loaded?.serviceIds ?? []);
  let bodyHtml: string | null = null;
  if (template) {
    const { buildMergeContext } = await import("@/lib/contracts/template-merge.server");
    const { mergeTemplateBody } = await import("@/lib/contracts/template-tokens");
    const { ctx } = await buildMergeContext(
      supabase,
      workspaceId,
      userId,
      {
        templateId: template.id,
        dealId: dealId ?? undefined,
        companyId: companyId ?? undefined,
        serviceCatalogId: loaded?.serviceIds[0],
      },
      template,
    );
    bodyHtml = mergeTemplateBody(template.body_html ?? "", ctx);
  }

  const result = await createContractShared(supabase, {
    workspaceId,
    userId,
    kind: "provider",
    fields: { ...common, title: `Contrato — ${baseTitle}` },
    dealId,
    items: loaded ? loaded.items : null,
    bodyHtml,
  });
  return {
    contract: result.contract,
    reused: false,
    servicesCreated: result.servicesCreated,
    templateName: (template?.name as string | undefined) ?? null,
  };
}

/** Contratos principais ativos da empresa da proposta/cotação. */
export async function activeContractsForSales(
  supabase: SupabaseClient,
  input: { proposalId?: string; quoteId?: string },
) {
  let companyId: string | null = null;
  if (input.proposalId) companyId = (await loadProposal(supabase, input.proposalId)).company_id;
  if (!companyId && input.quoteId) {
    const { data } = await supabase
      .from("quotes")
      .select("company_id")
      .eq("id", input.quoteId)
      .maybeSingle();
    companyId = (data as { company_id: string | null } | null)?.company_id ?? null;
  }
  if (!companyId) return [];
  const { data, error } = await supabase
    .from("contracts")
    .select("id, number, title, total_value, currency, starts_at, ends_at")
    .eq("counterparty_company_id", companyId)
    .eq("document_kind", "main")
    .eq("role", "provider")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    number: string | null;
    title: string;
    total_value: number | null;
    currency: string | null;
    starts_at: string | null;
    ends_at: string | null;
  }>;
}

/** Propostas e cotações da mesma empresa ainda sem contrato, para gerar aditivo. */
export async function amendmentSourcesForContract(supabase: SupabaseClient, contractId: string) {
  const { data: c, error } = await supabase
    .from("contracts")
    .select("counterparty_company_id")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const companyId = (c as { counterparty_company_id: string | null } | null)
    ?.counterparty_company_id;
  if (!companyId) return { proposals: [], quotes: [], hasCompany: false };

  const [props, quotes, used] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, title, status, total_amount, currency, created_at")
      .eq("company_id", companyId)
      .not("status", "in", "(rejected,canceled,expired)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotes")
      .select("id, number, title, status, total, currency, created_at")
      .eq("company_id", companyId)
      .not("status", "in", "(declined,expired)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("contracts")
      .select("proposal_id, quote_id")
      .eq("counterparty_company_id", companyId),
  ]);
  if (props.error) throw new Error(props.error.message);
  if (quotes.error) throw new Error(quotes.error.message);
  const usedRows = (used.data ?? []) as Array<{ proposal_id: string | null; quote_id: string | null }>;
  const usedP = new Set(usedRows.map((r) => r.proposal_id).filter(Boolean));
  const usedQ = new Set(usedRows.map((r) => r.quote_id).filter(Boolean));
  type P = { id: string; title: string; status: string; total_amount: number | null; currency: string | null };
  type Q = { id: string; number: string | null; title: string | null; status: string; total: number | null; currency: string | null };
  return {
    hasCompany: true,
    proposals: ((props.data ?? []) as unknown as P[]).filter((p) => !usedP.has(p.id)),
    quotes: ((quotes.data ?? []) as unknown as Q[]).filter((q) => !usedQ.has(q.id)),
  };
}
