// Ação "Criar contrato a partir do negócio": disparada por um workflow que o
// usuário configura (por exemplo, ao entrar na etapa de contratação). Lê o
// negócio no momento da execução, aplica os padrões de contrato do workspace,
// cria o contrato e converte cada item de linha em serviço do contrato mantendo
// a cobrança. Idempotente: não recria se já existe contrato do mesmo tipo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type LogStep, renderTokens, resolveExtraFields } from "../engine-shared.server";
import { createContractShared, loadDealForContract } from "@/lib/contracts/contract-create.server";
import { isContractKind, kindToColumns, type ContractKind } from "@/lib/contracts/contract-kinds";
import { coerceContractFields } from "@/lib/contracts/contract-field-coerce";
import type { RunCtx, RunnableAction } from "./run-context";

/** Aceita tanto o novo formato (prestação/compra/aditivo) quanto o antigo. */
function resolveKind(raw: string | null | undefined): ContractKind {
  if (isContractKind(raw)) return raw;
  if (raw === "purchase") return "client";
  if (raw === "amendment") return "amendment";
  return "provider";
}

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

  const { deal } = await loadDealForContract(supabase, ctx.entityId);
  const kind = resolveKind(action.document_kind ?? action.role);
  const { document_kind } = kindToColumns(kind, action.role ?? null);
  const skipIfExists = action.skip_if_exists !== false;

  if (skipIfExists) {
    const { data: existing, error: exErr } = await supabase
      .from("contracts")
      .select("id")
      .eq("deal_id", deal.id)
      .eq("document_kind", document_kind)
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
    : `Contrato — ${deal.name ?? "negócio"}`;
  const startsAt = action.starts_at?.trim()
    ? String(renderTokens(action.starts_at, ctx.after, ctx.vars)).trim()
    : null;

  const workspaceId = deal.workspace_id ?? ctx.workspaceId;
  if (!workspaceId) throw new Error("workspace do negócio não encontrado");

  const { contract, servicesCreated } = await createContractShared(supabase, {
    workspaceId,
    userId: ctx.ownerId || deal.owner_id || "",
    kind,
    role: action.role ?? null,
    fields: { title, starts_at: startsAt },
    dealId: deal.id,
    copyLineItems: action.copy_line_items !== false,
    bodyHtml,
    status: action.status ?? "draft",
  });

  return {
    at,
    ok: true,
    action: "create_contract_from_deal",
    detail: { contract_id: (contract as { id: string }).id, services: servicesCreated, title },
  };
}
