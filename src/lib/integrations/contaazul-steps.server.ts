// Sincronização Conta Azul → TechFinance, por entidade (step), idempotente.
// Cada step é reexecutável: registros são casados por identificador externo.
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CA_ENDPOINTS,
  type CaEntity,
  type NormalizedEntry,
  mapBankAccount,
  mapCategory,
  mapCostCenter,
  mapEntry,
  mapStatementTx,
} from "./contaazul-map";
import { caFetchAll, getValidAccessToken, markIntegrationError } from "./contaazul-api.server";

export type StepResult = {
  entity: CaEntity;
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
};

export type StepCtx = {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
  /** ISO date/datetime — sincronização incremental. */
  since?: string | null;
};

const nowIso = () => new Date().toISOString();

function emptyResult(entity: CaEntity): StepResult {
  return { entity, imported: 0, updated: 0, failed: 0, errors: [] };
}

function pushError(result: StepResult, message: string) {
  result.failed += 1;
  if (result.errors.length < 20) result.errors.push(message.slice(0, 300));
}

/* -------------------------------------------------------------------------- */
/* Estado de sincronização                                                    */
/* -------------------------------------------------------------------------- */

export async function loadSyncState(supabase: SupabaseClient, workspaceId: string) {
  const { data, error } = await supabase
    .from("contaazul_sync_state")
    .select("entity, last_synced_at, imported_count, failed_count, last_error, updated_at")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveSyncState(
  supabase: SupabaseClient,
  workspaceId: string,
  result: StepResult,
) {
  const { error } = await supabase.from("contaazul_sync_state").upsert(
    {
      workspace_id: workspaceId,
      entity: result.entity,
      last_synced_at: nowIso(),
      imported_count: result.imported + result.updated,
      failed_count: result.failed,
      last_error: result.errors[0] ?? null,
      updated_at: nowIso(),
    },
    { onConflict: "workspace_id,entity" },
  );
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Helpers de upsert por identificador externo                                */
/* -------------------------------------------------------------------------- */

type ExternalMap = Map<string, string>; // externalId → id local

async function loadExternalMap(
  supabase: SupabaseClient,
  table: "financial_categories" | "financial_cost_centers",
  workspaceId: string,
): Promise<ExternalMap> {
  const { data, error } = await supabase
    .from(table)
    .select("id, external_ids")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  const map: ExternalMap = new Map();
  for (const row of (data ?? []) as Array<{
    id: string;
    external_ids: Record<string, unknown> | null;
  }>) {
    const ext = row.external_ids?.["contaazul"];
    if (typeof ext === "string" && ext) map.set(ext, row.id);
  }
  return map;
}

async function loadBankAccountMap(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ExternalMap> {
  const { data, error } = await supabase
    .from("financial_bank_accounts")
    .select("id, metadata")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  const map: ExternalMap = new Map();
  for (const row of (data ?? []) as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
  }>) {
    const ext = row.metadata?.["contaazul_id"];
    if (typeof ext === "string" && ext) map.set(ext, row.id);
  }
  return map;
}

/** Garante a conexão bancária "contaazul" usada pelos extratos importados. */
async function ensureBankConnection(ctx: StepCtx): Promise<string> {
  const { data: existing, error } = await ctx.supabase
    .from("bank_connections")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "contaazul")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return (existing as { id: string }).id;

  const { data: created, error: insertError } = await ctx.supabase
    .from("bank_connections")
    .insert({
      workspace_id: ctx.workspaceId,
      provider: "contaazul",
      status: "connected",
      mode: "api",
      display_name: "Conta Azul",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return (created as { id: string }).id;
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

async function syncCategories(ctx: StepCtx, accessToken: string): Promise<StepResult> {
  const result = emptyResult("categories");
  const rows = await caFetchAll({ accessToken, path: CA_ENDPOINTS.categories });
  const map = await loadExternalMap(ctx.supabase, "financial_categories", ctx.workspaceId);

  for (const raw of rows) {
    const mapped = mapCategory(raw);
    if (!mapped) {
      pushError(result, `Categoria sem id/nome: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    const localId = map.get(mapped.externalId);
    const payload = {
      workspace_id: ctx.workspaceId,
      name: mapped.name,
      kind: mapped.kind,
      external_ids: { contaazul: mapped.externalId, contaazul_code: mapped.code },
      updated_at: nowIso(),
    };
    if (localId) {
      const { error } = await ctx.supabase
        .from("financial_categories")
        .update(payload)
        .eq("id", localId);
      if (error) pushError(result, `Categoria ${mapped.name}: ${error.message}`);
      else result.updated += 1;
    } else {
      const { data, error } = await ctx.supabase
        .from("financial_categories")
        .insert(payload)
        .select("id")
        .single();
      if (error) pushError(result, `Categoria ${mapped.name}: ${error.message}`);
      else {
        map.set(mapped.externalId, (data as { id: string }).id);
        result.imported += 1;
      }
    }
  }
  return result;
}

async function syncCostCenters(ctx: StepCtx, accessToken: string): Promise<StepResult> {
  const result = emptyResult("cost-centers");
  const rows = await caFetchAll({ accessToken, path: CA_ENDPOINTS["cost-centers"] });
  const map = await loadExternalMap(ctx.supabase, "financial_cost_centers", ctx.workspaceId);

  for (const raw of rows) {
    const mapped = mapCostCenter(raw);
    if (!mapped) {
      pushError(result, `Centro de custo sem id/nome: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    const payload = {
      workspace_id: ctx.workspaceId,
      name: mapped.name,
      active: mapped.active,
      external_ids: { contaazul: mapped.externalId, contaazul_code: mapped.code },
      updated_at: nowIso(),
    };
    const localId = map.get(mapped.externalId);
    if (localId) {
      const { error } = await ctx.supabase
        .from("financial_cost_centers")
        .update(payload)
        .eq("id", localId);
      if (error) pushError(result, `Centro de custo ${mapped.name}: ${error.message}`);
      else result.updated += 1;
    } else {
      const { data, error } = await ctx.supabase
        .from("financial_cost_centers")
        .insert(payload)
        .select("id")
        .single();
      if (error) pushError(result, `Centro de custo ${mapped.name}: ${error.message}`);
      else {
        map.set(mapped.externalId, (data as { id: string }).id);
        result.imported += 1;
      }
    }
  }
  return result;
}

async function syncBankAccounts(ctx: StepCtx, accessToken: string): Promise<StepResult> {
  const result = emptyResult("bank-accounts");
  const rows = await caFetchAll({ accessToken, path: CA_ENDPOINTS["bank-accounts"] });
  const map = await loadBankAccountMap(ctx.supabase, ctx.workspaceId);

  for (const raw of rows) {
    const mapped = mapBankAccount(raw);
    if (!mapped) {
      pushError(result, `Conta bancária sem id/nome: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    const payload = {
      workspace_id: ctx.workspaceId,
      name: mapped.name,
      kind: mapped.kind,
      initial_balance: mapped.initialBalance,
      active: mapped.active,
      metadata: { contaazul_id: mapped.externalId, source: "contaazul" },
      updated_at: nowIso(),
    };
    const localId = map.get(mapped.externalId);
    if (localId) {
      const { error } = await ctx.supabase
        .from("financial_bank_accounts")
        .update(payload)
        .eq("id", localId);
      if (error) pushError(result, `Conta ${mapped.name}: ${error.message}`);
      else result.updated += 1;
    } else {
      const { data, error } = await ctx.supabase
        .from("financial_bank_accounts")
        .insert(payload)
        .select("id")
        .single();
      if (error) pushError(result, `Conta ${mapped.name}: ${error.message}`);
      else {
        map.set(mapped.externalId, (data as { id: string }).id);
        result.imported += 1;
      }
    }
  }
  return result;
}

/** Insere/atualiza lançamentos financeiros a partir de itens normalizados. */
export async function persistEntries(
  ctx: StepCtx,
  entity: CaEntity,
  entries: NormalizedEntry[],
): Promise<StepResult> {
  const result = emptyResult(entity);
  if (!entries.length) return result;

  const categoryMap = await loadExternalMap(ctx.supabase, "financial_categories", ctx.workspaceId);
  const costCenterMap = await loadExternalMap(
    ctx.supabase,
    "financial_cost_centers",
    ctx.workspaceId,
  );

  const refs = entries.map((e) => e.externalRef);
  const existing = new Map<string, string>();
  for (let i = 0; i < refs.length; i += 200) {
    const chunk = refs.slice(i, i + 200);
    const { data, error } = await ctx.supabase
      .from("financial_entries")
      .select("id, external_ref")
      .eq("workspace_id", ctx.workspaceId)
      .in("external_ref", chunk);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{ id: string; external_ref: string | null }>) {
      if (row.external_ref) existing.set(row.external_ref, row.id);
    }
  }

  for (const entry of entries) {
    const categoryId = entry.categoryExternalId
      ? (categoryMap.get(entry.categoryExternalId) ?? null)
      : null;
    const costCenterId = entry.costCenterExternalId
      ? (costCenterMap.get(entry.costCenterExternalId) ?? null)
      : null;

    const payload = {
      workspace_id: ctx.workspaceId,
      owner_id: ctx.workspaceId,
      direction: entry.direction,
      origin_type: "manual" as const,
      description: entry.description,
      amount: entry.amount,
      paid_amount: entry.paidAmount,
      currency: "BRL",
      due_date: entry.dueDate,
      competence_date: entry.competenceDate,
      status: entry.status,
      category_id: categoryId,
      payment_method: entry.paymentMethod,
      installment_number: entry.installmentNumber,
      installment_total: entry.installmentTotal,
      external_ref: entry.externalRef,
      metadata: {
        source: "contaazul",
        contaazul_id: entry.externalId,
        counterparty_name: entry.counterpartyName,
        counterparty_doc: entry.counterpartyDoc,
        cost_center_contaazul_id: entry.costCenterExternalId,
      },
      updated_at: nowIso(),
    };

    const localId = existing.get(entry.externalRef);
    let entryId = localId ?? null;
    if (localId) {
      const { error } = await ctx.supabase
        .from("financial_entries")
        .update(payload)
        .eq("id", localId);
      if (error) pushError(result, `Lançamento ${entry.externalId}: ${error.message}`);
      else result.updated += 1;
    } else {
      const { data, error } = await ctx.supabase
        .from("financial_entries")
        .insert(payload)
        .select("id")
        .single();
      if (error) pushError(result, `Lançamento ${entry.externalId}: ${error.message}`);
      else {
        entryId = (data as { id: string }).id;
        result.imported += 1;
      }
    }

    // Centro de custo é vinculado por alocação (100% do valor quando único).
    if (entryId && costCenterId) {
      await ctx.supabase.from("financial_entry_allocations").delete().eq("entry_id", entryId);
      const { error } = await ctx.supabase
        .from("financial_entry_allocations")
        .insert({ entry_id: entryId, cost_center_id: costCenterId, amount: entry.amount });
      if (error) pushError(result, `Alocação ${entry.externalId}: ${error.message}`);
    }
  }
  return result;
}

async function syncFinancialEvents(
  ctx: StepCtx,
  accessToken: string,
  direction: "receivable" | "payable",
): Promise<StepResult> {
  const entity: CaEntity = direction;
  const rows = await caFetchAll({
    accessToken,
    path: CA_ENDPOINTS[entity],
    query: ctx.since ? { data_alteracao_de: ctx.since } : undefined,
  });
  const today = new Date().toISOString().slice(0, 10);
  const entries: NormalizedEntry[] = [];
  const result = emptyResult(entity);
  for (const raw of rows) {
    const mapped = mapEntry(raw, direction, today);
    if (!mapped) {
      pushError(result, `Lançamento sem id: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    entries.push(mapped);
  }
  const persisted = await persistEntries(ctx, entity, entries);
  return {
    entity,
    imported: persisted.imported,
    updated: persisted.updated,
    failed: result.failed + persisted.failed,
    errors: [...result.errors, ...persisted.errors].slice(0, 20),
  };
}

async function syncStatements(ctx: StepCtx, accessToken: string): Promise<StepResult> {
  const result = emptyResult("statements");
  const connectionId = await ensureBankConnection(ctx);
  const accountMap = await loadBankAccountMap(ctx.supabase, ctx.workspaceId);
  const rows = await caFetchAll({
    accessToken,
    path: CA_ENDPOINTS.statements,
    query: ctx.since
      ? { data_inicio: ctx.since.slice(0, 10), data_fim: new Date().toISOString().slice(0, 10) }
      : undefined,
  });

  for (const raw of rows) {
    const tx = mapStatementTx(raw);
    if (!tx) {
      pushError(result, `Transação sem id: ${JSON.stringify(raw).slice(0, 120)}`);
      continue;
    }
    const bankAccountId = tx.bankAccountExternalId
      ? (accountMap.get(tx.bankAccountExternalId) ?? null)
      : null;

    const { error } = await ctx.supabase.from("bank_statement_transactions").upsert(
      {
        workspace_id: ctx.workspaceId,
        connection_id: connectionId,
        external_id: `contaazul:${tx.externalId}`,
        posted_at: tx.postedAt,
        amount: tx.amount,
        direction: tx.direction === "out" ? "debit" : "credit",
        description: tx.description,
        counterparty: tx.counterparty,
        balance_after: tx.balanceAfter,
        bank_account_id: bankAccountId,
        raw: tx.raw as unknown as Record<string, unknown>,

        updated_at: nowIso(),
      },
      { onConflict: "connection_id,external_id" },
    );
    if (error) pushError(result, `Transação ${tx.externalId}: ${error.message}`);
    else result.imported += 1;
  }

  await ctx.supabase
    .from("bank_connections")
    .update({ last_statement_sync_at: nowIso(), last_error: result.errors[0] ?? null })
    .eq("id", connectionId);

  return result;
}

/** Executa um step específico. */
export async function runContaAzulStep(ctx: StepCtx, entity: CaEntity): Promise<StepResult> {
  const accessToken = await getValidAccessToken(ctx.supabase, ctx.workspaceId);
  let result: StepResult;
  try {
    switch (entity) {
      case "categories":
        result = await syncCategories(ctx, accessToken);
        break;
      case "cost-centers":
        result = await syncCostCenters(ctx, accessToken);
        break;
      case "bank-accounts":
        result = await syncBankAccounts(ctx, accessToken);
        break;
      case "receivable":
        result = await syncFinancialEvents(ctx, accessToken, "receivable");
        break;
      case "payable":
        result = await syncFinancialEvents(ctx, accessToken, "payable");
        break;
      case "statements":
        result = await syncStatements(ctx, accessToken);
        break;
      default:
        result = emptyResult(entity);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { ...emptyResult(entity), failed: 1, errors: [message.slice(0, 300)] };
    await markIntegrationError(ctx.supabase, ctx.workspaceId, message);
  }
  await saveSyncState(ctx.supabase, ctx.workspaceId, result);
  return result;
}

/** Ordem recomendada: dependências (plano de contas/bancos) antes dos lançamentos. */
export const STEP_ORDER: CaEntity[] = [
  "categories",
  "cost-centers",
  "bank-accounts",
  "receivable",
  "payable",
  "statements",
];

export async function runContaAzulSteps(ctx: StepCtx, entities: CaEntity[]): Promise<StepResult[]> {
  const ordered = STEP_ORDER.filter((e) => entities.includes(e));
  const results: StepResult[] = [];
  for (const entity of ordered) {
    results.push(await runContaAzulStep(ctx, entity));
  }
  return results;
}
