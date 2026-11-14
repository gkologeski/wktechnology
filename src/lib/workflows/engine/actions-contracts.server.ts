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
import { loadWorkflowAcceptedCommercialSource } from "./accepted-commercial-source.server";
import { authorizeWorkflowStep } from "./authorization.server";

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
  if (action.type === "open_contract_draft") return openContractDraft(supabase, ctx, at);
  if (action.type !== "create_contract_from_deal") return null;

  if (ctx.entity !== "deals") {
    throw new Error("Esta ação só pode ser usada em workflows de Negócios.");
  }

  const { deal } = await loadDealForContract(supabase, ctx.entityId);
  const { workRpc } = await import("@/lib/access-control/work-core.server");
  if (!deal.workspace_id || deal.workspace_id !== ctx.workspaceId || !ctx.ownerId)
    throw new Error("Origem ou responsável do workflow inválido.");
  const allowed = await workRpc<boolean>(supabase, "work_delegated_authorize", {
    p_ws: deal.workspace_id,
    p_actor: ctx.ownerId,
    p_kind: "contract_from_deal",
    p_record: deal.id,
    p_copy: action.copy_line_items !== false,
    p_template: action.template_id ?? null,
    p_status: action.status ?? "draft",
  });
  if (!allowed)
    throw new Error(
      "O responsável do workflow não possui as permissões atuais para criar este contrato e seus serviços.",
    );
  const kind = resolveKind(action.document_kind ?? action.role);
  const { document_kind, role } = kindToColumns(kind, action.role ?? null);
  const skipIfExists = action.skip_if_exists !== false;

  // Preserve idempotence for historical jobs without rewriting their old contracts.
  if (skipIfExists) {
    const { data: existing, error: existingError } = await supabase
      .from("contracts")
      .select("id,title")
      .eq("workspace_id", deal.workspace_id)
      .eq("deal_id", deal.id)
      .eq("document_kind", document_kind)
      .eq("role", role)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing)
      return {
        at,
        ok: true,
        action: "create_contract_from_deal",
        detail: { contract_id: existing.id, services: 0, title: existing.title, reused: true },
      };
  }
  const commercialSource =
    document_kind === "main" && role === "provider"
      ? await loadWorkflowAcceptedCommercialSource(
          supabase,
          deal.workspace_id,
          deal.id,
          ctx.ownerId,
        )
      : null;
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

  const workspaceId = deal.workspace_id;
  if (!workspaceId) throw new Error("workspace do negócio não encontrado");

  // Demais campos do contrato configurados no passo: tokens são resolvidos com
  // os dados do negócio e convertidos para os tipos das colunas.
  const resolvedExtra = resolveExtraFields(action.extra_fields, ctx.after, ctx.vars);
  const { values: extraValues, warnings } = coerceContractFields(resolvedExtra);

  const { contract, servicesCreated } = await createContractShared(supabase, {
    workspaceId,
    skipExisting: skipIfExists,
    delegation: {
      kind: "contract_from_deal",
      record: deal.id,
      template: action.template_id ?? null,
    },
    userId: ctx.ownerId,
    kind,
    role: action.role ?? null,
    fields: {
      ...(extraValues as Record<string, string | number | boolean | null>),
      ...(commercialSource?.fields ?? {}),
      title,
      starts_at:
        (commercialSource?.fields.starts_at as string | null) ??
        startsAt ??
        (extraValues["starts_at"] as string | null) ??
        null,
    },
    dealId: deal.id,
    copyLineItems: action.copy_line_items !== false,
    bodyHtml: commercialSource?.bodyHtml ?? bodyHtml,
    ...(commercialSource ? { items: commercialSource.items } : {}),
    status: action.status ?? "draft",
  });

  return {
    at,
    ok: true,
    action: "create_contract_from_deal",
    detail: {
      contract_id: (contract as { id: string }).id,
      services: servicesCreated,
      title,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  };
}

/**
 * ACEITE-MINUTA: abre a minuta da proposta aceita e avisa os aprovadores
 * jurídicos. Só em workflows de Propostas; idempotente por proposta.
 */
async function openContractDraft(
  supabase: SupabaseClient,
  ctx: RunCtx,
  at: string,
): Promise<LogStep> {
  if (ctx.entity !== "proposals")
    throw new Error("Esta ação só pode ser usada em workflows de Propostas.");
  if (!ctx.workspaceId || !ctx.ownerId)
    throw new Error("Origem ou responsável do workflow inválido.");
  // Revalida a versão publicada do workflow antes da RPC de serviço.
  await authorizeWorkflowStep(supabase, ctx);
  const { data, error } = await supabase.rpc(
    "contract_draft_open" as never,
    { p_ws: ctx.workspaceId, p_proposal: ctx.entityId, p_actor: ctx.ownerId } as never,
  );
  if (error) throw new Error(error.message);
  return {
    at,
    ok: true,
    action: "open_contract_draft",
    detail: (data ?? {}) as Record<string, unknown>,
  };
}
