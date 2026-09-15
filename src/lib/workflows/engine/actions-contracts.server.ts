// Ação "Criar contrato a partir do negócio": disparada por um workflow que o
// usuário configura (por exemplo, ao entrar na etapa de contratação). Lê o
// negócio no momento da execução, cria o contrato e converte cada item de linha
// em serviço do contrato mantendo a cobrança (forma, unidade, valor, percentual
// e recorrência). Idempotente: não recria se já existe contrato para o negócio.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type LogStep, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

type LineItemRow = {
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
};

const CADENCE_TO_TYPE: Record<string, string> = {
  one_time: "one_time",
  monthly: "recurring",
  quarterly: "recurring",
  yearly: "recurring",
  on_delivery: "milestone",
};

export async function handleContractAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  if (action.type !== "create_contract_from_deal") return null;

  if (ctx.entity !== "deals") {
    throw new Error("Esta ação só pode ser usada em workflows de Negócios.");
  }

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, name, currency, company_id, workspace_id, owner_id, assigned_to")
    .eq("id", ctx.entityId)
    .maybeSingle();
  if (dealErr) throw new Error(dealErr.message);
  if (!deal) throw new Error("negócio não encontrado");
  const d = deal as {
    id: string;
    name: string | null;
    currency: string | null;
    company_id: string | null;
    workspace_id: string;
    owner_id: string;
    assigned_to: string | null;
  };

  const documentKind = action.document_kind ?? "contract";
  const skipIfExists = action.skip_if_exists !== false;

  if (skipIfExists) {
    const { data: existing, error: exErr } = await supabase
      .from("contracts")
      .select("id")
      .eq("deal_id", d.id)
      .eq("document_kind", documentKind)
      .limit(1);
    if (exErr) throw new Error(exErr.message);
    if (existing && existing.length > 0) {
      return {
        at,
        ok: true,
        action: "create_contract_from_deal",
        detail: { skipped: true, contract_id: (existing[0] as { id: string }).id },
      };
    }
  }

  let bodyHtml: string | null = null;
  if (action.template_id) {
    const { data: tpl } = await supabase
      .from("contract_templates")
      .select("body_html")
      .eq("id", action.template_id)
      .maybeSingle();
    bodyHtml = (tpl as { body_html?: string | null } | null)?.body_html ?? null;
  }

  const title = action.title?.trim()
    ? String(renderTokens(action.title, ctx.after, ctx.vars)).trim()
    : `Contrato — ${d.name ?? "negócio"}`;
  const startsAt = action.starts_at?.trim()
    ? String(renderTokens(action.starts_at, ctx.after, ctx.vars)).trim()
    : null;

  const { data: created, error: insErr } = await supabase
    .from("contracts")
    .insert({
      workspace_id: d.workspace_id,
      owner_id: ctx.ownerId || d.owner_id,
      assigned_to: d.assigned_to,
      role: action.role ?? "provider",
      document_kind: documentKind,
      deal_id: d.id,
      counterparty_company_id: d.company_id,
      title,
      status: action.status ?? "draft",
      currency: d.currency ?? "BRL",
      starts_at: startsAt || null,
      body_html: bodyHtml,
    } as never)
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);
  const contractId = (created as { id: string } | null)?.id;
  if (!contractId) throw new Error("não foi possível criar o contrato");

  // Converte os itens de linha do negócio em serviços do contrato.
  const { data: rows, error: liErr } = await supabase
    .from("deal_line_items")
    .select(
      "id, name, description, quantity, unit_price, discount_pct, discount_amount, discount_type, tax_rate, unit, billing_model, percent, percent_base_amount, cadence, job_profile_id, seniority, service_catalog_id",
    )
    .eq("deal_id", d.id)
    .order("position");
  if (liErr) throw new Error(liErr.message);
  const items = (rows ?? []) as unknown as LineItemRow[];

  let servicesCreated = 0;
  if (items.length > 0 && action.copy_line_items !== false) {
    const payload = items.map((li) => ({
      workspace_id: d.workspace_id,
      owner_id: ctx.ownerId || d.owner_id,
      contract_id: contractId,
      role: action.role ?? "provider",
      name: li.name ?? "Serviço",
      description: li.description,
      type: CADENCE_TO_TYPE[li.cadence ?? "one_time"] ?? "one_time",
      status: "pending",
      quantity: li.quantity ?? 1,
      unit_price: li.unit_price ?? 0,
      currency: d.currency ?? "BRL",
      cadence: li.cadence,
      unit: li.unit,
      billing_model: li.billing_model,
      percent: li.percent,
      percent_base_amount: li.percent_base_amount,
      job_profile_id: li.job_profile_id,
      seniority: li.seniority,
      source_deal_line_item_id: li.id,
      starts_at: startsAt || null,
      metadata: {
        service_catalog_id: li.service_catalog_id,
        discount_type: li.discount_type,
        discount_pct: li.discount_pct,
        discount_amount: li.discount_amount,
        tax_rate: li.tax_rate,
      },
    }));
    const { error: svcErr } = await supabase.from("services").insert(payload as never);
    if (svcErr) throw new Error(svcErr.message);
    servicesCreated = payload.length;
  }

  return {
    at,
    ok: true,
    action: "create_contract_from_deal",
    detail: { contract_id: contractId, services: servicesCreated, title },
  };
}
