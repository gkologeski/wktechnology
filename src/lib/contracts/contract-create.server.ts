// Criação de contrato compartilhada pelo formulário manual, pela criação a
// partir do negócio e pela ação de workflow. Concentra a leitura do negócio,
// a aplicação dos padrões do workspace e a cópia dos itens de linha como
// serviços do contrato (mantendo a cobrança).
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyDefaults,
  effectiveDefaults,
  type ContractDefaultsMap,
} from "./contract-defaults-shared";
import { loadContractDefaults } from "./contract-defaults.server";
import { kindToColumns, type ContractKind } from "./contract-kinds";

const CADENCE_TO_TYPE: Record<string, string> = {
  one_time: "one_time",
  monthly: "recurring",
  quarterly: "recurring",
  yearly: "recurring",
  on_delivery: "milestone",
};

export type DealLineItemRow = {
  id: string;
  name: string | null;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount_pct: number | null;
  discount_amount: number | null;
  discount_type: string | null;
  tax_rate: number | null;
  unit: string | null;
  billing_model: string | null;
  percent: number | null;
  percent_base_amount: number | null;
  cadence: string | null;
  job_profile_id: string | null;
  seniority: string | null;
  service_catalog_id: string | null;
  contracting_preset_id: string | null;
  service_name?: string | null;
  preset_name?: string | null;
};

export const DEAL_LINE_ITEM_COLUMNS =
  "id, name, description, quantity, unit_price, discount_pct, discount_amount, discount_type, tax_rate, unit, billing_model, percent, percent_base_amount, cadence, job_profile_id, seniority, service_catalog_id, contracting_preset_id, service:service_catalog(name), preset:contracting_presets(name)";

export type DealSnapshot = {
  id: string;
  name: string | null;
  currency: string | null;
  company_id: string | null;
  value: number | null;
  assigned_to: string | null;
  owner_id?: string | null;
  workspace_id?: string | null;
};

function tokenValue() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

/** Lê o negócio (snapshot no momento da criação) e seus itens de linha. */
export async function loadDealForContract(
  supabase: SupabaseClient,
  dealId: string,
): Promise<{ deal: DealSnapshot; items: DealLineItemRow[] }> {
  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, name, currency, company_id, value, assigned_to, owner_id, workspace_id")
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deal) throw new Error("Negócio não encontrado");

  const { data: rows, error: liErr } = await supabase
    .from("deal_line_items")
    .select(DEAL_LINE_ITEM_COLUMNS)
    .eq("deal_id", dealId)
    .order("position");
  if (liErr) throw new Error(liErr.message);

  return {
    deal: deal as unknown as DealSnapshot,
    items: ((rows ?? []) as unknown as Array<DealLineItemRow & {
      service?: { name: string | null } | null;
      preset?: { name: string | null } | null;
    }>).map((item) => ({
      ...item,
      service_name: item.service?.name ?? null,
      preset_name: item.preset?.name ?? null,
    })),
  };
}

/** Campos do contrato derivados do negócio e dos itens de linha. */
export function contractFieldsFromDeal(
  deal: DealSnapshot,
  items: DealLineItemRow[],
): ContractDefaultsMap {
  const monthly = items
    .filter((li) => li.cadence === "monthly")
    .reduce((sum, li) => sum + Number(li.quantity ?? 1) * Number(li.unit_price ?? 0), 0);
  const hours = items
    .filter((li) => li.billing_model === "per_hour")
    .reduce((sum, li) => sum + Number(li.quantity ?? 0), 0);

  return {
    deal_id: deal.id,
    counterparty_company_id: deal.company_id ?? null,
    currency: deal.currency ?? null,
    assigned_to: deal.assigned_to ?? null,
    total_value: deal.value != null ? Number(deal.value) : null,
    monthly_value: monthly > 0 ? monthly : null,
    hours_per_month: hours > 0 ? hours : null,
  };
}

export type CreateContractArgs = {
  workspaceId: string;
  userId: string;
  kind: ContractKind;
  /** Papel do aditivo (o tipo "amendment" não define papel por si só). */
  role?: "provider" | "client" | null;
  /** Campos preenchidos pelo usuário/ação — têm prioridade sobre tudo. */
  fields: ContractDefaultsMap;
  dealId?: string | null;
  /** Copiar itens de linha do negócio como serviços do contrato. */
  copyLineItems?: boolean;
  /** Se informado, copia só estes itens de linha. */
  lineItemIds?: string[] | null;
  bodyHtml?: string | null;
  status?: string;
};

const INSERTABLE = new Set([
  "title",
  "counterparty_company_id",
  "contracting_legal_entity_id",
  "parent_contract_id",
  "amendment_of_id",
  "amendment_number",
  "amendment_effective_at",
  "deal_id",
  "assigned_to",
  "starts_at",
  "ends_at",
  "auto_renew",
  "notice_days",
  "trial_period_days",
  "total_value",
  "monthly_value",
  "hours_per_month",
  "currency",
  "payment_day",
  "payment_method",
  "payment_terms",
  "late_fee_percent",
  "late_interest_monthly_percent",
  "expense_reimbursement_days",
  "readjustment_index",
  "readjustment_period",
  "service_type",
  "service_location",
  "service_scope",
  "governing_law",
  "jurisdiction",
  "penalty_percent",
  "cure_period_days",
  "unilateral_termination_notice_days",
  "confidentiality_term_months",
  "signature_provider",
]);

function pickInsertable(values: ContractDefaultsMap): ContractDefaultsMap {
  const out: ContractDefaultsMap = {};
  for (const [k, v] of Object.entries(values)) {
    if (!INSERTABLE.has(k)) continue;
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Cria o contrato aplicando a precedência
 * padrão do workspace < dados do negócio < campos informados,
 * e converte os itens de linha em serviços do contrato.
 */
export async function createContractShared(
  supabase: SupabaseClient,
  args: CreateContractArgs,
): Promise<{
  contract: { id: string; number: string | null; title: string | null };
  servicesCreated: number;
}> {
  const { document_kind, role } = kindToColumns(args.kind, args.role ?? null);

  let dealFields: ContractDefaultsMap = {};
  let items: DealLineItemRow[] = [];
  if (args.dealId) {
    const loaded = await loadDealForContract(supabase, args.dealId);
    dealFields = contractFieldsFromDeal(loaded.deal, loaded.items);
    items = args.lineItemIds?.length
      ? loaded.items.filter((li) => args.lineItemIds?.includes(li.id))
      : loaded.items;
  }

  const bundle = await loadContractDefaults(supabase, args.workspaceId);
  const defaults = effectiveDefaults(bundle, args.kind);

  const merged = applyDefaults(
    applyDefaults(pickInsertable(args.fields), pickInsertable(dealFields)),
    defaults,
  );

  const payload = {
    ...merged,
    workspace_id: args.workspaceId,
    owner_id: args.userId,
    role,
    document_kind,
    currency: (merged["currency"] as string) ?? "BRL",
    total_value: merged["total_value"] ?? 0,
    body_html: args.bodyHtml ?? null,
    number: generateNumber(),
    public_token: tokenValue(),
    status: args.status ?? "draft",
  };

  const { data: inserted, error } = await supabase
    .from("contracts")
    .insert(payload as never)
    .select("id, number, title")
    .single();
  if (error) throw new Error(error.message);
  const contract = inserted as unknown as {
    id: string;
    number: string | null;
    title: string | null;
  } | null;
  const contractId = contract?.id;
  if (!contract || !contractId) throw new Error("Não foi possível criar o contrato");

  let servicesCreated = 0;
  // Serviço só pode ser associado a contrato de prestação.
  const canHaveServices = role === "provider" && document_kind === "main";
  if (canHaveServices && args.copyLineItems !== false && items.length > 0) {
    const startsAt = (merged["starts_at"] as string | null) ?? null;
    const servicePayload = items.map((li) => ({
      workspace_id: args.workspaceId,
      owner_id: args.userId,
      contract_id: contractId,
      role,
      name: li.name ?? "Serviço",
      description: li.description,
      type: CADENCE_TO_TYPE[li.cadence ?? "one_time"] ?? "one_time",
      status: "pending",
      quantity: li.quantity ?? 1,
      unit_price: li.unit_price ?? 0,
      currency: (payload.currency as string) ?? "BRL",
      cadence: li.cadence,
      unit: li.unit,
      billing_model: li.billing_model,
      percent: li.percent,
      percent_base_amount: li.percent_base_amount,
      job_profile_id: li.job_profile_id,
      seniority: li.seniority,
      source_deal_line_item_id: li.id,
      starts_at: startsAt,
      metadata: {
        service_catalog_id: li.service_catalog_id,
        service_name: li.service_name,
        contracting_preset_id: li.contracting_preset_id,
        preset_name: li.preset_name,
        discount_type: li.discount_type,
        discount_pct: li.discount_pct,
        discount_amount: li.discount_amount,
        tax_rate: li.tax_rate,
      },
    }));
    const { error: svcErr } = await supabase.from("services").insert(servicePayload as never);
    if (svcErr) throw new Error(svcErr.message);
    servicesCreated = servicePayload.length;
  }

  return { contract, servicesCreated };
}
