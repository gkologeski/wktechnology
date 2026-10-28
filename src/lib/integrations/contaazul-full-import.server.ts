// Importação completa Conta Azul → TechERP (somente servidor).
// Lê a API, concilia com o que já existe e grava apenas o que falta.
// Leituras amplas usam o cliente do servidor restrito ao workspace (após checar
// a permissão); gravações de negócio usam o cliente do usuário (RLS + regras do
// banco). Registros existentes nunca são reescritos: só ganham vínculo.
import type { SupabaseClient } from "@supabase/supabase-js";

import { caFetch, caFetchAll } from "./contaazul-api.server";
import { mapBankAccount } from "./contaazul-map";
import { assertPeopleAccess, tokenKeepingStatus } from "./contaazul-people.server";
import { normalizeEmailAddress } from "@/lib/email-address";
import {
  caEventTargetStatus,
  cnpjOrNull,
  linkKey,
  mapCaEvent,
  mapCaTransfer,
  paymentParts,
  planCatalog,
  planEntries,
  planTransfers,
  splitPersonName,
  type CaEvent,
  type CaTransfer,
  type ExistingLink,
  type LinkEntity,
  type LocalEntry,
  type LocalTransfer,
} from "./contaazul-import-plan";
import { toCents, type EntryStatus } from "./contaazul-reconcile";

type Raw = Record<string, unknown>;
type Ctx = { admin: SupabaseClient; client: SupabaseClient; workspaceId: string; userId: string };

const ENTITIES_REQUIRED = [
  "connection",
  "categories",
  "cost-centers",
  "bank-accounts",
  "receivable",
  "payable",
];

/** Exige: conciliar pessoas (cliente do usuário) + gestão/importação financeira do Conta Azul. */
export async function assertFullImportAccess(ctx: Ctx): Promise<void> {
  await assertPeopleAccess(ctx.client, ctx.workspaceId, ctx.userId, "manage");
  for (const entity of ENTITIES_REQUIRED) {
    const { data, error } = await ctx.admin.rpc("sales_contaazul_authorize", {
      p_user: ctx.userId,
      p_ws: ctx.workspaceId,
      p_entity: entity,
    });
    if (error || data !== true)
      throw new Error(
        "Sem permissão para importar dados financeiros do Conta Azul neste workspace.",
      );
  }
}

async function pageAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let res = await build(from, from + 999);
    // Erros temporários de rede/banco: até 3 novas tentativas por página.
    for (let attempt = 1; res.error && attempt <= 3; attempt++) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      res = await build(from, from + 999);
    }
    const { data, error } = res;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const chunks = <T>(list: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** O cliente do usuário no servidor lança erro em vez de devolvê-lo; normaliza. */
async function guarded(
  run: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<string | null> {
  try {
    const { error } = await run();
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                     */
/* -------------------------------------------------------------------------- */

/** Leituras da API com novas tentativas para quedas de conexão (erro de rede). */
async function withNetworkRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (err) {
      if (i >= attempts || !/fetch failed|ECONNRESET|socket|network/i.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

async function fetchApi(token: string) {
  const range = { data_vencimento_de: "2000-01-01", data_vencimento_ate: "2040-12-31" };
  const big = { pageSize: 500, maxPages: 1000 };
  const [rec, pag, cats, centers, accounts] = await Promise.all([
    caFetchAll({
      accessToken: token,
      path: "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar",
      query: range,
      ...big,
    }),
    caFetchAll({
      accessToken: token,
      path: "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar",
      query: range,
      ...big,
    }),
    caFetchAll({ accessToken: token, path: "/v1/categorias", pageSize: 100, maxPages: 100 }),
    caFetchAll({ accessToken: token, path: "/v1/centro-de-custo", pageSize: 100, maxPages: 100 }),
    caFetchAll({ accessToken: token, path: "/v1/conta-financeira", pageSize: 100, maxPages: 100 }),
  ]);
  const transfers: Raw[] = [];
  const lastYear = new Date().getUTCFullYear() + 1;
  for (let y = 2010; y <= lastYear; y++) {
    transfers.push(
      ...(await caFetchAll({
        accessToken: token,
        path: "/v1/financeiro/transferencias",
        query: { data_inicio: `${y}-01-01`, data_fim: `${y}-12-31` },
        pageSize: 100,
        maxPages: 200,
      })),
    );
  }
  const events: CaEvent[] = [];
  let invalid = 0;
  for (const r of rec) {
    const e = mapCaEvent(r, "receivable");
    if (e) events.push(e);
    else invalid++;
  }
  for (const r of pag) {
    const e = mapCaEvent(r, "payable");
    if (e) events.push(e);
    else invalid++;
  }
  const tr = transfers.map(mapCaTransfer).filter((t): t is CaTransfer => !!t);
  return { events, invalid, cats, centers, accounts, transfers: tr };
}

type LocalRow = {
  id: string;
  direction: "receivable" | "payable";
  due_date: string;
  amount: number | string;
  paid_amount: number | string | null;
  description: string;
  status: EntryStatus;
  external_ref: string | null;
  kind: string | null;
  pair: string | null;
  cp: string | null;
  caid: string | null;
};

async function loadLocal(ctx: Ctx) {
  const ws = ctx.workspaceId;
  const entries = await pageAll<LocalRow>((a, b) =>
    ctx.admin
      .from("financial_entries")
      .select(
        "id, direction, due_date, amount, paid_amount, description, status, external_ref, kind:metadata->>kind, pair:metadata->>transfer_pair_id, cp:metadata->contazul->>fornecedor, caid:metadata->>contaazul_id",
      )
      .eq("workspace_id", ws)
      .order("id")
      .range(a, b),
  );
  const links = await pageAll<{
    entity: LinkEntity;
    contaazul_id: string;
    status: ExistingLink["status"];
    decision: ExistingLink["decision"];
    local_id: string | null;
  }>((a, b) =>
    ctx.admin
      .from("contaazul_record_links")
      .select("entity, contaazul_id, status, decision, local_id")
      .eq("workspace_id", ws)
      .order("id")
      .range(a, b),
  );
  const people = await pageAll<{
    id: string;
    contaazul_id: string;
    name: string;
    person_kind: "company" | "person";
    status: string;
    match_by: string | null;
    document: string | null;
    email: string | null;
    local_company_id: string | null;
    local_contact_id: string | null;
  }>((a, b) =>
    ctx.admin
      .from("contaazul_person_links")
      .select(
        "id, contaazul_id, name, person_kind, status, match_by, document, email, local_company_id, local_contact_id",
      )
      .eq("workspace_id", ws)
      .order("id")
      .range(a, b),
  );
  const [cats, centers, banks] = await Promise.all([
    ctx.admin
      .from("financial_categories")
      .select("id, name, kind, ext:external_ids->>contaazul")
      .eq("workspace_id", ws),
    ctx.admin
      .from("financial_cost_centers")
      .select("id, name, ext:external_ids->>contaazul")
      .eq("workspace_id", ws),
    ctx.admin
      .from("financial_bank_accounts")
      .select("id, name, active, ext:metadata->>contaazul_id")
      .eq("workspace_id", ws),
  ]);
  for (const r of [cats, centers, banks]) if (r.error) throw new Error(r.error.message);
  return {
    entries,
    links: new Map<string, ExistingLink>(
      links.map((l) => [
        linkKey(l.entity, l.contaazul_id),
        {
          entity: l.entity,
          contaazulId: l.contaazul_id,
          status: l.status,
          decision: l.decision,
          localId: l.local_id,
        },
      ]),
    ),
    people,
    cats: (cats.data ?? []) as Array<{
      id: string;
      name: string;
      kind: "revenue" | "expense";
      ext: string | null;
    }>,
    centers: (centers.data ?? []) as Array<{ id: string; name: string; ext: string | null }>,
    banks: (banks.data ?? []) as Array<{
      id: string;
      name: string;
      active: boolean;
      ext: string | null;
    }>,
  };
}

/* -------------------------------------------------------------------------- */
/* Planejamento                                                                */
/* -------------------------------------------------------------------------- */

async function buildPlan(ctx: Ctx, token: string) {
  const [api, local] = await Promise.all([fetchApi(token), loadLocal(ctx)]);
  const num = (v: unknown) => Number(v ?? 0) || 0;

  const localEvents: LocalEntry[] = local.entries
    .filter((e) => !e.kind)
    .map((e) => ({
      id: e.id,
      direction: e.direction,
      dueDate: e.due_date,
      amount: num(e.amount),
      paid: num(e.paid_amount),
      description: e.description ?? "",
      counterparty: e.cp,
      status: e.status,
    }));
  const pairs = new Map<string, LocalTransfer>();
  for (const e of local.entries) {
    if (e.kind !== "transfer" && e.kind !== "transfer_orphan") continue;
    const key = e.kind === "transfer" && e.pair ? e.pair : e.id;
    if (!pairs.has(key))
      pairs.set(key, { key, localId: e.id, date: e.due_date, amount: num(e.amount) });
  }

  const catPlan = (["revenue", "expense"] as const).map((kind) =>
    planCatalog(
      "category",
      api.cats
        .filter(
          (c) =>
            (String(c["tipo"] ?? "").toUpperCase() === "RECEITA" ? "revenue" : "expense") === kind,
        )
        .map((c) => ({ id: String(c["id"]), name: String(c["nome"] ?? "") })),
      local.cats
        .filter((c) => c.kind === kind)
        .map((c) => ({ id: c.id, name: c.name, contaazulId: c.ext })),
      local.links,
    ),
  );
  const centerPlan = planCatalog(
    "cost_center",
    api.centers.map((c) => ({ id: String(c["id"]), name: String(c["nome"] ?? "") })),
    local.centers.map((c) => ({ id: c.id, name: c.name, contaazulId: c.ext })),
    local.links,
  );
  const bankPlan = planCatalog(
    "bank_account",
    api.accounts.map((c) => ({ id: String(c["id"]), name: String(c["nome"] ?? "") })),
    local.banks.map((c) => ({ id: c.id, name: c.name, contaazulId: c.ext })),
    local.links,
  );
  const entryPlan = planEntries(localEvents, api.events, local.links);
  const transferPlan = planTransfers([...pairs.values()], api.transfers, local.links);
  const peopleToCreate = local.people.filter(
    (p) =>
      p.status === "confirmed" &&
      p.match_by === "new_finance" &&
      !p.local_company_id &&
      !p.local_contact_id,
  );
  return {
    api,
    local,
    localEvents,
    catPlan,
    centerPlan,
    bankPlan,
    entryPlan,
    transferPlan,
    peopleToCreate,
  };
}

type Plan = Awaited<ReturnType<typeof buildPlan>>;

function summarize(plan: Plan) {
  const ev = new Map(plan.api.events.map((e) => [e.id, e]));
  const sumCents = (ids: string[]) =>
    ids.reduce((s, id) => s + toCents(ev.get(id)?.amount ?? 0), 0) / 100;
  const cat = {
    match: plan.catPlan.reduce((s, p) => s + p.match.length, 0),
    create: plan.catPlan.reduce((s, p) => s + p.create.length, 0),
    review: plan.catPlan.reduce((s, p) => s + p.review.length, 0),
  };
  const topUps = plan.entryPlan.match.filter((m) => m.topUpCents > 0);
  return {
    api: {
      events: plan.api.events.length,
      invalid: plan.api.invalid,
      transfers: plan.api.transfers.length,
    },
    categories: cat,
    costCenters: {
      match: plan.centerPlan.match.length,
      create: plan.centerPlan.create.length,
      review: plan.centerPlan.review.length,
    },
    bankAccounts: {
      match: plan.bankPlan.match.length,
      create: plan.bankPlan.create.length,
      review: plan.bankPlan.review.length,
    },
    people: {
      create: plan.peopleToCreate.length,
      companies: plan.peopleToCreate.filter((p) => p.person_kind === "company").length,
      contacts: plan.peopleToCreate.filter((p) => p.person_kind === "person").length,
      pendingSuggestions: plan.local.people.filter(
        (p) => p.status === "suggested" || p.status === "review",
      ).length,
    },
    entries: {
      match: plan.entryPlan.match.length,
      create: plan.entryPlan.create.length,
      createReceivable: plan.entryPlan.create.filter((id) => ev.get(id)?.direction === "receivable")
        .length,
      createPayable: plan.entryPlan.create.filter((id) => ev.get(id)?.direction === "payable")
        .length,
      createValue: sumCents(plan.entryPlan.create),
      review: plan.entryPlan.review.length,
      skipped: plan.entryPlan.skipped,
      paymentsToAdd: topUps.length,
      paymentsToAddValue: topUps.reduce((s, m) => s + m.topUpCents, 0) / 100,
      cancelledInContaAzul: plan.entryPlan.match.filter((m) => m.cancel).length,
      localOnly: (() => {
        const linked = new Set(plan.entryPlan.match.map((m) => m.localId));
        for (const l of plan.local.links.values()) if (l.localId) linked.add(l.localId);
        return plan.localEvents.filter((l) => !linked.has(l.id)).length;
      })(),
    },
    transfers: {
      match: plan.transferPlan.match.length,
      create: plan.transferPlan.create.length,
      skipped: plan.transferPlan.skipped,
    },
  };
}

export type FullImportSummary = ReturnType<typeof summarize> & {
  written?: Record<string, number>;
  errors?: string[];
  detailFormat?: string[];
  adopted_runs?: string[];
  adopted_by?: string;
};

/* -------------------------------------------------------------------------- */
/* Gravação                                                                    */
/* -------------------------------------------------------------------------- */

async function upsertLinks(ctx: Ctx, rows: Array<Record<string, unknown>>) {
  for (const part of chunks(rows, 500)) {
    const { error } = await ctx.admin
      .from("contaazul_record_links")
      .upsert(part, { onConflict: "workspace_id,entity,contaazul_id" });
    if (error) throw new Error(`Vínculos: ${error.message}`);
  }
}

async function detailOf(token: string, id: string): Promise<unknown> {
  try {
    return await caFetch({
      accessToken: token,
      path: `/v1/financeiro/eventos-financeiros/parcelas/${id}`,
    });
  } catch {
    return null;
  }
}

/** Formato do detalhe (só nomes de campos, sem valores), para conferência. */
export function describeShape(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const top = Object.keys(detail as Raw);
  const baixas = (detail as Raw)["baixas"];
  const inner =
    Array.isArray(baixas) && baixas[0] && typeof baixas[0] === "object"
      ? Object.keys(baixas[0] as Raw).map((k) => `baixas.${k}`)
      : [];
  return [...top, ...inner].slice(0, 60);
}

export async function previewFullImport(ctx: Ctx): Promise<FullImportSummary> {
  await assertFullImportAccess(ctx);
  const token = await tokenKeepingStatus(ctx.admin, ctx.workspaceId);
  const plan = await buildPlan(ctx, token);
  const sample =
    plan.api.events.find((e) => e.paid > 0 && plan.entryPlan.create.includes(e.id)) ??
    plan.api.events.find((e) => e.paid > 0);
  return {
    ...summarize(plan),
    detailFormat: sample ? describeShape(await detailOf(token, sample.id)) : [],
  };
}

export async function applyFullImport(
  ctx: Ctx,
): Promise<{ runId: string; summary: FullImportSummary }> {
  await assertFullImportAccess(ctx);
  const token = await tokenKeepingStatus(ctx.admin, ctx.workspaceId);
  // Uma execução por vez: duas em paralelo criariam cadastros em dobro.
  const { data: active } = await ctx.admin
    .from("contaazul_import_runs")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(1);
  if (active?.length)
    throw new Error("Já existe uma importação do Conta Azul em andamento. Aguarde ela terminar.");
  const { data: run, error: runErr } = await ctx.admin
    .from("contaazul_import_runs")
    .insert({ workspace_id: ctx.workspaceId, started_by: ctx.userId })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "Falha ao registrar a execução.");
  const runId = (run as { id: string }).id;
  // Execuções interrompidas antes desta passam a ser desfeitas junto com ela.
  const { data: failedRuns } = await ctx.admin
    .from("contaazul_import_runs")
    .select("id, summary")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "failed")
    .neq("id", runId);
  const adopted: string[] = [];
  for (const r of (failedRuns ?? []) as Array<{
    id: string;
    summary: Record<string, unknown> | null;
  }>) {
    if (r.summary?.["adopted_by"]) continue;
    adopted.push(r.id);
    await ctx.admin
      .from("contaazul_import_runs")
      .update({ summary: { ...(r.summary ?? {}), adopted_by: runId } })
      .eq("id", r.id);
  }
  const written: Record<string, number> = {};
  const errors: string[] = [];
  const bump = (k: string, n = 1) => (written[k] = (written[k] ?? 0) + n);
  const fail = (msg: string) => {
    if (errors.length < 50) errors.push(msg.slice(0, 300));
  };
  let summary: FullImportSummary | null = null;
  let phase = "leitura e planejamento";
  try {
    const plan = await buildPlan(ctx, token);
    phase = "cadastros auxiliares";
    summary = summarize(plan);
    const ws = ctx.workspaceId;
    const now = () => new Date().toISOString();
    const links: Array<Record<string, unknown>> = [];
    const link = (entity: LinkEntity, contaazulId: string, rest: Record<string, unknown>) =>
      links.push({
        workspace_id: ws,
        entity,
        contaazul_id: contaazulId,
        run_id: runId,
        updated_at: now(),
        candidates: [],
        decision: null,
        ...rest,
      });

    /* ---- Cadastros auxiliares ---- */
    const catMap = new Map<string, string>(); // id Conta Azul → id local
    const centerMap = new Map<string, string>();
    const bankMap = new Map<string, string>();
    const bankActive = new Map(plan.local.banks.map((b) => [b.id, b.active]));
    const rawCat = new Map(plan.api.cats.map((c) => [String(c["id"]), c]));
    for (const l of plan.local.links.values()) {
      if (!l.localId || l.status === "review") continue;
      if (l.entity === "category") catMap.set(l.contaazulId, l.localId);
      if (l.entity === "cost_center") centerMap.set(l.contaazulId, l.localId);
      if (l.entity === "bank_account") bankMap.set(l.contaazulId, l.localId);
    }
    const catalogs = [
      {
        entity: "category" as const,
        plans: plan.catPlan,
        map: catMap,
        table: "financial_categories",
      },
      {
        entity: "cost_center" as const,
        plans: [plan.centerPlan],
        map: centerMap,
        table: "financial_cost_centers",
      },
      {
        entity: "bank_account" as const,
        plans: [plan.bankPlan],
        map: bankMap,
        table: "financial_bank_accounts",
      },
    ];
    const remoteName = new Map<string, string>();
    for (const r of [...plan.api.cats, ...plan.api.centers, ...plan.api.accounts])
      remoteName.set(String(r["id"]), String(r["nome"] ?? ""));
    const rawAccount = new Map(plan.api.accounts.map((a) => [String(a["id"]), a]));
    const rawCenter = new Map(plan.api.centers.map((a) => [String(a["id"]), a]));
    for (const c of catalogs) {
      for (const p of c.plans) {
        for (const m of p.match) {
          c.map.set(m.remoteId, m.localId);
          link(c.entity, m.remoteId, {
            status: "matched",
            local_id: m.localId,
            tier: "name",
            label: remoteName.get(m.remoteId),
          });
        }
        for (const r of p.review)
          link(c.entity, r.remoteId, {
            status: "review",
            label: remoteName.get(r.remoteId),
            candidates: r.localIds.map((id) => ({ id })),
          });
        for (const id of p.create) {
          const name = (remoteName.get(id) || "Sem nome").slice(0, 200);
          let payload: Record<string, unknown>;
          if (c.entity === "category") {
            const raw = rawCat.get(id)!;
            payload = {
              workspace_id: ws,
              name,
              kind: String(raw["tipo"] ?? "").toUpperCase() === "RECEITA" ? "revenue" : "expense",
              external_ids: { contaazul: id, contaazul_run: runId },
            };
          } else if (c.entity === "cost_center") {
            payload = {
              workspace_id: ws,
              name,
              active: rawCenter.get(id)?.["ativo"] !== false,
              external_ids: { contaazul: id, contaazul_run: runId },
            };
          } else {
            const raw = rawAccount.get(id)!;
            const mapped = mapBankAccount(raw);
            payload = {
              workspace_id: ws,
              name,
              kind: mapped?.kind ?? "bank",
              initial_balance: 0,
              active: raw["ativo"] !== false,
              metadata: { contaazul_id: id, contaazul_run: runId, source: "contaazul" },
            };
          }
          const { data, error } = await ctx.client
            .from(c.table)
            .insert(payload)
            .select("id")
            .single();
          if (error || !data) {
            fail(`${c.entity} ${name}: ${error?.message}`);
            continue;
          }
          const localId = (data as { id: string }).id;
          c.map.set(id, localId);
          if (c.entity === "bank_account") bankActive.set(localId, payload["active"] as boolean);
          bump(`${c.entity}_created`);
          link(c.entity, id, { status: "imported", local_id: localId, label: name });
        }
      }
    }
    // Hierarquia apenas para categorias criadas agora.
    for (const p of plan.catPlan)
      for (const id of p.create) {
        const parent = rawCat.get(id)?.["categoria_pai"];
        const localId = catMap.get(id);
        const parentLocal = typeof parent === "string" ? catMap.get(parent) : undefined;
        if (localId && parentLocal && parentLocal !== localId) {
          const { error } = await ctx.client
            .from("financial_categories")
            .update({ parent_id: parentLocal })
            .eq("id", localId);
          if (error) fail(`Categoria pai ${id}: ${error.message}`);
        }
      }

    let linksWritten = 0;
    const flushLinks = async () => {
      const batch = links.splice(0);
      await upsertLinks(ctx, batch);
      linksWritten += batch.length;
    };
    await flushLinks();

    /* ---- Clientes e fornecedores somente financeiros ---- */
    phase = "clientes e fornecedores";
    const companyByCa = new Map<string, string>();
    const contactByCa = new Map<string, string>();
    for (const p of plan.local.people) {
      if (p.status !== "confirmed" && p.status !== "linked") continue;
      if (p.local_company_id) companyByCa.set(p.contaazul_id, p.local_company_id);
      if (p.local_contact_id) contactByCa.set(p.contaazul_id, p.local_contact_id);
    }
    const personUpdates: Array<{
      id: string;
      local_company_id?: string;
      local_contact_id?: string;
    }> = [];
    const createPeople = async (kind: "company" | "person") => {
      const list = plan.peopleToCreate.filter((p) => p.person_kind === kind);
      const table = kind === "company" ? "companies" : "contacts";
      const payloadOf = (p: (typeof list)[number], withDoc = true): Record<string, unknown> => {
        const ext = { contaazul: p.contaazul_id, contaazul_run: runId };
        if (kind === "company")
          return {
            workspace_id: ws,
            owner_id: ctx.userId,
            name: p.name.slice(0, 300),
            audience: "finance",
            cnpj: withDoc ? cnpjOrNull(p.document) : null,
            external_ids: ext,
          };
        const n = splitPersonName(p.name);
        return {
          workspace_id: ws,
          owner_id: ctx.userId,
          first_name: n.first,
          last_name: n.last,
          email: normalizeEmailAddress(p.email),
          audience: "finance",
          external_ids: ext,
        };
      };
      const record = (rows: Array<{ id: string; ext: string | null }>) => {
        const byCa = new Map(list.map((p) => [p.contaazul_id, p]));
        for (const r of rows) {
          const p = r.ext ? byCa.get(r.ext) : undefined;
          if (!p) continue;
          (kind === "company" ? companyByCa : contactByCa).set(p.contaazul_id, r.id);
          personUpdates.push(
            kind === "company"
              ? { id: p.id, local_company_id: r.id }
              : { id: p.id, local_contact_id: r.id },
          );
          bump(kind === "company" ? "companies_created" : "contacts_created");
        }
      };
      // Retomada: cadastros criados por execução interrompida só ganham o vínculo.
      const already: Array<{ id: string; ext: string | null }> = [];
      for (const part of chunks(
        list.map((p) => p.contaazul_id),
        200,
      )) {
        const { data, error } = await ctx.admin
          .from(table)
          .select("id, ext:external_ids->>contaazul")
          .eq("workspace_id", ws)
          .is("deleted_at", null)
          .in("external_ids->>contaazul", part);
        if (error) throw new Error(error.message);
        already.push(...((data ?? []) as Array<{ id: string; ext: string | null }>));
      }
      const resumedIds = new Set(already.map((r) => r.ext));
      const before = written[kind === "company" ? "companies_created" : "contacts_created"] ?? 0;
      record(already);
      if (before) written[kind === "company" ? "companies_created" : "contacts_created"] = before;
      else delete written[kind === "company" ? "companies_created" : "contacts_created"];
      if (already.length)
        bump(kind === "company" ? "companies_resumed" : "contacts_resumed", already.length);
      const todo = list.filter((p) => !resumedIds.has(p.contaazul_id));
      // Contatos passam por gatilhos pesados (vínculo por domínio); lotes menores evitam o limite de 8 s.
      for (const part of chunks(todo, kind === "company" ? 100 : 15)) {
        const { data, error } = await ctx.client
          .from(table)
          .insert(part.map((p) => payloadOf(p)))
          .select("id, ext:external_ids->>contaazul");
        if (!error) {
          record((data ?? []) as Array<{ id: string; ext: string | null }>);
          continue;
        }
        // Lote recusado: tenta um a um (ex.: CNPJ já usado) sem perder os demais.
        for (const p of part) {
          let res = await ctx.client
            .from(table)
            .insert(payloadOf(p))
            .select("id, ext:external_ids->>contaazul");
          if (res.error && kind === "company" && cnpjOrNull(p.document))
            res = await ctx.client
              .from(table)
              .insert(payloadOf(p, false))
              .select("id, ext:external_ids->>contaazul");
          if (res.error)
            fail(`${kind === "company" ? "Empresa" : "Contato"} ${p.name}: ${res.error.message}`);
          else record((res.data ?? []) as Array<{ id: string; ext: string | null }>);
        }
      }
    };
    await createPeople("company");
    await createPeople("person");
    await mapLimit(personUpdates, 8, async (u) => {
      const { id, ...patch } = u;
      const { error } = await ctx.admin
        .from("contaazul_person_links")
        .update({ ...patch, updated_at: now() })
        .eq("id", id)
        .eq("workspace_id", ws);
      if (error) fail(`Vínculo de pessoa ${id}: ${error.message}`);
    });

    /* ---- Lançamentos ---- */
    phase = "lançamentos";
    await ctx.admin
      .from("contaazul_import_runs")
      .update({ summary: { ...summary, written, errors, phase } })
      .eq("id", runId);
    const ev = new Map(plan.api.events.map((e) => [e.id, e]));
    const localById = new Map(plan.localEvents.map((l) => [l.id, l]));
    const today = new Date().toISOString().slice(0, 10);
    const fmt = (l: LocalEntry) =>
      `${l.dueDate} · R$ ${l.amount.toFixed(2)} · ${l.description}${l.counterparty ? ` · ${l.counterparty}` : ""}`;
    const evLabel = (e: CaEvent) =>
      `${e.dueDate} · R$ ${e.amount.toFixed(2)} · ${e.description}${e.counterpartyName ? ` · ${e.counterpartyName}` : ""}`;

    const payments: Array<{ entryId: string; ev: CaEvent; targetCents: number }> = [];
    for (const m of plan.entryPlan.match) {
      const e = ev.get(m.apiId)!;
      const l = localById.get(m.localId)!;
      link(e.direction, e.id, {
        status: "matched",
        local_id: m.localId,
        tier: m.tier,
        label: evLabel(e),
        previous: m.topUpCents > 0 ? { status: l.status, paid_amount: l.paid } : null,
      });
      if (m.topUpCents > 0) payments.push({ entryId: m.localId, ev: e, targetCents: m.topUpCents });
    }
    for (const r of plan.entryPlan.review) {
      const e = ev.get(r.apiId)!;
      link(e.direction, e.id, {
        status: "review",
        tier: r.reason,
        label: evLabel(e),
        candidates: r.localIds.map((id) => ({
          id,
          label: localById.get(id) ? fmt(localById.get(id)!) : id,
        })),
      });
    }

    // Referências já usadas (ex.: execução interrompida) viram vínculo, não duplicata.
    const createRefs = plan.entryPlan.create.map(
      (id) => `contaazul:${ev.get(id)!.direction}:${id}`,
    );
    const existingRef = new Map<string, { id: string; paid: number; status: string }>();
    for (const part of chunks(createRefs, 60)) {
      const query = () =>
        ctx.admin
          .from("financial_entries")
          .select("id, external_ref, paid_amount, status")
          .eq("workspace_id", ws)
          .in("external_ref", part);
      let { data, error } = await query();
      for (let attempt = 1; error && attempt <= 3; attempt++) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        ({ data, error } = await query());
      }
      if (error) throw new Error(`conferência de referências: ${error.message}`);
      for (const r of (data ?? []) as Array<{
        id: string;
        external_ref: string;
        paid_amount: number | string | null;
        status: string;
      }>)
        existingRef.set(r.external_ref, {
          id: r.id,
          paid: Number(r.paid_amount ?? 0),
          status: r.status,
        });
    }
    const toInsert: CaEvent[] = [];
    for (const id of plan.entryPlan.create) {
      const e = ev.get(id)!;
      const ref = `contaazul:${e.direction}:${id}`;
      if (!existingRef.has(ref)) toInsert.push(e);
    }
    const created = new Map<string, string>(); // id Conta Azul → lançamento
    // Retomada: lançamentos criados por execução interrompida completam baixas/rateio.
    const resumed = new Map<string, { id: string; paid: number; status: string }>();
    for (const id of plan.entryPlan.create) {
      const found = existingRef.get(`contaazul:${ev.get(id)!.direction}:${id}`);
      if (found) resumed.set(id, found);
    }
    if (resumed.size) bump("entries_resumed", resumed.size);
    for (const part of chunks(toInsert, 100)) {
      const rows = part.map((e) => ({
        workspace_id: ws,
        owner_id: ctx.userId,
        direction: e.direction,
        origin_type: "manual",
        description: e.description,
        amount: e.amount,
        paid_amount: 0,
        currency: "BRL",
        due_date: e.dueDate,
        competence_date: e.competenceDate,
        status: e.dueDate < today ? "overdue" : "open",
        category_id: (e.categoryId && catMap.get(e.categoryId)) || null,
        counterparty_company_id: (e.counterpartyId && companyByCa.get(e.counterpartyId)) || null,
        external_ref: `contaazul:${e.direction}:${e.id}`,
        metadata: {
          import_source: "contaazul_api",
          contaazul_id: e.id,
          contaazul_run: runId,
          contaazul_status: e.caStatus,
          counterparty_name: e.counterpartyName,
          counterparty_contact_id: (e.counterpartyId && contactByCa.get(e.counterpartyId)) || null,
        },
      }));
      const { data, error } = await ctx.client
        .from("financial_entries")
        .insert(rows)
        .select("id, external_ref");
      if (error) {
        fail(`Lançamentos (lote de ${rows.length}): ${error.message}`);
        continue;
      }
      for (const r of (data ?? []) as Array<{ id: string; external_ref: string }>) {
        const caId = r.external_ref.split(":")[2]!;
        created.set(caId, r.id);
      }
    }
    bump("entries_created", created.size);
    const withAlloc = new Set<string>();
    for (const part of chunks(
      [...resumed.values()].map((r) => r.id),
      150,
    )) {
      const { data, error } = await ctx.admin
        .from("financial_entry_allocations")
        .select("entry_id")
        .in("entry_id", part);
      if (error) throw new Error(`conferência de rateios: ${error.message}`);
      for (const r of (data ?? []) as Array<{ entry_id: string }>) withAlloc.add(r.entry_id);
    }
    const allocations: Array<Record<string, unknown>> = [];
    for (const [caId, r] of resumed) {
      const e = ev.get(caId)!;
      link(e.direction, caId, { status: "imported", local_id: r.id, label: evLabel(e) });
      const cc = e.costCenterId ? centerMap.get(e.costCenterId) : undefined;
      if (cc && !withAlloc.has(r.id))
        allocations.push({ entry_id: r.id, cost_center_id: cc, amount: e.amount });
      const missing = toCents(e.paid) - toCents(r.paid);
      if (missing > 0 && r.status !== "cancelled" && caEventTargetStatus(e) !== "cancelled")
        payments.push({ entryId: r.id, ev: e, targetCents: missing });
    }
    for (const [caId, entryId] of created) {
      const e = ev.get(caId)!;
      link(e.direction, caId, { status: "imported", local_id: entryId, label: evLabel(e) });
      const cc = e.costCenterId ? centerMap.get(e.costCenterId) : undefined;
      if (cc) allocations.push({ entry_id: entryId, cost_center_id: cc, amount: e.amount });
      if (e.paid > 0 && caEventTargetStatus(e) !== "cancelled")
        payments.push({ entryId, ev: e, targetCents: toCents(e.paid) });
    }
    // Lançamentos criados pela importação (inclusive em execuções anteriores) sem rateio.
    const ours = plan.local.entries.filter((e) => e.caid && !e.kind);
    const oursWithAlloc = new Set<string>();
    for (const part of chunks(
      ours.map((e) => e.id),
      150,
    )) {
      const { data, error } = await ctx.admin
        .from("financial_entry_allocations")
        .select("entry_id")
        .in("entry_id", part);
      if (error) throw new Error(`conferência de rateios: ${error.message}`);
      for (const r of (data ?? []) as Array<{ entry_id: string }>) oursWithAlloc.add(r.entry_id);
    }
    const queued = new Set(allocations.map((a) => a["entry_id"] as string));
    for (const e of ours) {
      if (oursWithAlloc.has(e.id) || queued.has(e.id)) continue;
      const api = ev.get(e.caid!);
      const cc = api?.costCenterId ? centerMap.get(api.costCenterId) : undefined;
      if (api && cc) allocations.push({ entry_id: e.id, cost_center_id: cc, amount: api.amount });
    }
    // Lotes pequenos: cada rateio passa pela regra financeira do banco (limite de 8 s).
    for (const part of chunks(allocations, 20)) {
      const error = await guarded(() =>
        ctx.client.from("financial_entry_allocations").insert(part),
      );
      if (error) fail(`Rateio por centro de custo: ${error}`);
      else bump("allocations_created", part.length);
    }

    // Baixas: datas e contas reais do detalhe da parcela; sem detalhe, vencimento (marcado).
    const paymentRows: Array<Record<string, unknown>> = [];
    let estimated = 0;
    await mapLimit(payments, 4, async (p) => {
      const detail = await detailOf(token, p.ev.id);
      const { parts, estimated: est } = paymentParts(detail, p.ev, p.targetCents);
      if (est) estimated++;
      for (const part of parts) {
        const bank = part.accountId ? bankMap.get(part.accountId) : undefined;
        paymentRows.push({
          workspace_id: ws,
          entry_id: p.entryId,
          bank_account_id: bank && bankActive.get(bank) ? bank : null,
          paid_at: part.paidAt,
          amount: part.cents / 100,
          reference: `contaazul:${runId}:${p.ev.id}`,
          notes: est
            ? "Baixa importada do Conta Azul (data estimada)"
            : "Baixa importada do Conta Azul",
          created_by: ctx.userId,
        });
      }
    });
    for (const part of chunks(paymentRows, 50)) {
      const error = await guarded(() => ctx.client.from("financial_payments").insert(part));
      if (!error) {
        bump("payments_created", part.length);
        continue;
      }
      for (const row of part) {
        const e1 = await guarded(() => ctx.client.from("financial_payments").insert(row));
        if (e1) fail(`Baixa ${String(row["reference"])}: ${e1}`);
        else bump("payments_created");
      }
    }
    bump("payments_estimated_date", estimated);
    // Perdidos/cancelados no Conta Azul: só os lançamentos criados agora.
    const toCancel = [
      ...created,
      ...[...resumed]
        .filter(([, r]) => r.status !== "cancelled" && r.paid === 0)
        .map(([caId, r]) => [caId, r.id] as [string, string]),
    ];
    for (const [caId, entryId] of toCancel) {
      if (caEventTargetStatus(ev.get(caId)!) !== "cancelled") continue;
      const { error } = await ctx.client
        .from("financial_entries")
        .update({ status: "cancelled" })
        .eq("id", entryId);
      if (error) fail(`Cancelar ${caId}: ${error.message}`);
      else bump("entries_cancelled");
    }

    await flushLinks();

    /* ---- Transferências ---- */
    phase = "transferências";
    const trById = new Map(plan.api.transfers.map((t) => [t.id, t]));
    for (const m of plan.transferPlan.match)
      link("transfer", m.apiId, {
        status: "matched",
        local_id: m.localId,
        tier: "date_amount",
        label: trById.get(m.apiId)?.description,
      });
    const catByName = (name: string, kind: "revenue" | "expense") =>
      plan.local.cats.find(
        (c) => c.kind === kind && c.name.trim().toLowerCase() === name.toLowerCase(),
      )?.id ?? null;
    const outCat = catByName("Transferência de Saída", "expense");
    const inCat = catByName("Transferência de Entrada", "revenue");
    for (const id of plan.transferPlan.create) {
      const t = trById.get(id)!;
      const pair = crypto.randomUUID();
      const leg = (direction: "payable" | "receivable") => ({
        workspace_id: ws,
        owner_id: ctx.userId,
        direction,
        origin_type: "manual",
        description: t.description,
        amount: t.amount,
        paid_amount: 0,
        currency: "BRL",
        due_date: t.date,
        competence_date: t.date,
        status: t.date < today ? "overdue" : "open",
        category_id: direction === "payable" ? outCat : inCat,
        external_ref: `contaazul:transfer:${id}:${direction === "payable" ? "out" : "in"}`,
        metadata: {
          import_source: "contaazul_api",
          kind: "transfer",
          transfer_pair_id: pair,
          contaazul_id: id,
          contaazul_run: runId,
        },
      });
      const { data, error } = await ctx.client
        .from("financial_entries")
        .insert([leg("payable"), leg("receivable")])
        .select("id, direction");
      if (error || !data) {
        fail(`Transferência ${id}: ${error?.message}`);
        continue;
      }
      const rows = data as Array<{ id: string; direction: string }>;
      const out = rows.find((r) => r.direction === "payable")!;
      const inn = rows.find((r) => r.direction === "receivable")!;
      const acc = (caAcc: string | null) => {
        const b = caAcc ? bankMap.get(caAcc) : undefined;
        return b && bankActive.get(b) ? b : null;
      };
      const pay = (entryId: string, account: string | null) => ({
        workspace_id: ws,
        entry_id: entryId,
        bank_account_id: account,
        paid_at: t.date,
        amount: t.amount,
        reference: `contaazul:${runId}:${id}`,
        notes: "Transferência importada do Conta Azul",
        created_by: ctx.userId,
      });
      const { error: pErr } = await ctx.client
        .from("financial_payments")
        .insert([pay(out.id, acc(t.fromAccountId)), pay(inn.id, acc(t.toAccountId))]);
      if (pErr) fail(`Baixa da transferência ${id}: ${pErr.message}`);
      bump("transfers_created");
      link("transfer", id, {
        status: "imported",
        local_id: out.id,
        local_pair_id: inn.id,
        label: t.description,
      });
    }

    await flushLinks();
    bump("links_written", linksWritten);
    const final: FullImportSummary = { ...summary, written, errors, adopted_runs: adopted };
    await ctx.admin
      .from("contaazul_import_runs")
      .update({ status: "completed", summary: final, finished_at: now() })
      .eq("id", runId);
    return { runId, summary: final };
  } catch (err) {
    const where = err instanceof Error ? (err.stack ?? "").split("\n").slice(1, 4).join(" | ") : "";
    const message = `${phase}: ${err instanceof Error ? err.message : String(err)} [${where.slice(0, 300)}]`;
    await ctx.admin
      .from("contaazul_import_runs")
      .update({
        status: "failed",
        error: message.slice(0, 500),
        summary: { ...(summary ?? {}), written, errors },
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw new Error(
      `Importação interrompida: ${message}. O que já foi gravado pode ser desfeito pela execução registrada.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Desfazer uma execução                                                      */
/* -------------------------------------------------------------------------- */

export async function rollbackFullImport(ctx: Ctx, runId: string): Promise<Record<string, number>> {
  await assertFullImportAccess(ctx);
  const ws = ctx.workspaceId;
  const { data: run } = await ctx.admin
    .from("contaazul_import_runs")
    .select("id, status, summary")
    .eq("id", runId)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (!run) throw new Error("Execução não encontrada neste workspace.");
  if ((run as { status: string }).status === "rolled_back")
    throw new Error("Esta execução já foi desfeita.");
  const runSummary = ((run as { summary: Record<string, unknown> | null }).summary ?? {}) as {
    adopted_runs?: string[];
    adopted_by?: string;
  };
  if (runSummary.adopted_by)
    throw new Error("Esta execução foi retomada por outra; desfaça a execução mais recente.");
  const runIds = [runId, ...(runSummary.adopted_runs ?? [])];
  const done: Record<string, number> = {};
  const bump = (k: string, n: number) => (done[k] = (done[k] ?? 0) + n);

  // 1) Baixas lançadas pela execução (inclusive em lançamentos já existentes).
  const pays = await pageAll<{ id: string }>((a, b) =>
    ctx.admin
      .from("financial_payments")
      .select("id")
      .eq("workspace_id", ws)
      .or(runIds.map((r) => `reference.like.contaazul:${r}:*`).join(","))
      .order("id")
      .range(a, b),
  );
  for (const part of chunks(
    pays.map((p) => p.id),
    200,
  )) {
    const { error } = await ctx.client.from("financial_payments").delete().in("id", part);
    if (error) throw new Error(`Baixas: ${error.message}`);
    bump("payments_removed", part.length);
  }
  // 2) Lançamentos criados (rateios primeiro).
  const entries = await pageAll<{ id: string }>((a, b) =>
    ctx.admin
      .from("financial_entries")
      .select("id")
      .eq("workspace_id", ws)
      .in("metadata->>contaazul_run", runIds)
      .order("id")
      .range(a, b),
  );
  for (const part of chunks(
    entries.map((e) => e.id),
    200,
  )) {
    await ctx.client.from("financial_entry_allocations").delete().in("entry_id", part);
    const { error } = await ctx.client.from("financial_entries").delete().in("id", part);
    if (error) throw new Error(`Lançamentos: ${error.message}`);
    bump("entries_removed", part.length);
  }
  // 3) Empresas e contatos somente financeiros criados: exclusão lógica.
  for (const table of ["companies", "contacts"] as const) {
    const rows = await pageAll<{ id: string }>((a, b) =>
      ctx.admin
        .from(table)
        .select("id")
        .eq("workspace_id", ws)
        .in("external_ids->>contaazul_run", runIds)
        .is("deleted_at", null)
        .order("id")
        .range(a, b),
    );
    for (const part of chunks(
      rows.map((r) => r.id),
      200,
    )) {
      const { error } = await ctx.client
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .in("id", part);
      if (error) throw new Error(`${table}: ${error.message}`);
      const col = table === "companies" ? "local_company_id" : "local_contact_id";
      await ctx.admin
        .from("contaazul_person_links")
        .update({ [col]: null })
        .eq("workspace_id", ws)
        .in(col, part);
      bump(`${table}_removed`, part.length);
    }
  }
  // 4) Cadastros auxiliares criados (se ainda não usados por outros lançamentos).
  for (const [table, path] of [
    ["financial_categories", "external_ids->>contaazul_run"],
    ["financial_cost_centers", "external_ids->>contaazul_run"],
    ["financial_bank_accounts", "metadata->>contaazul_run"],
  ] as const) {
    const { data } = await ctx.admin
      .from(table)
      .select("id")
      .eq("workspace_id", ws)
      .in(path, runIds);
    for (const r of (data ?? []) as Array<{ id: string }>) {
      const { error } = await ctx.client.from(table).delete().eq("id", r.id);
      if (!error) bump(`${table}_removed`, 1);
    }
  }
  // 5) Vínculos da execução.
  const { error: lErr } = await ctx.admin
    .from("contaazul_record_links")
    .delete()
    .eq("workspace_id", ws)
    .in("run_id", runIds);
  if (lErr) throw new Error(`Vínculos: ${lErr.message}`);
  await ctx.admin
    .from("contaazul_import_runs")
    .update({
      status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: ctx.userId,
    })
    .eq("workspace_id", ws)
    .in("id", runIds);
  return done;
}

/* -------------------------------------------------------------------------- */
/* Revisão de lançamentos                                                     */
/* -------------------------------------------------------------------------- */

export async function decideRecordLinks(
  ctx: Ctx,
  ids: string[],
  decision: "same" | "new" | "ignore",
  localId: string | null,
): Promise<number> {
  await assertFullImportAccess(ctx);
  const { data, error } = await ctx.admin
    .from("contaazul_record_links")
    .select("id, entity, status, candidates")
    .eq("workspace_id", ctx.workspaceId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  let changed = 0;
  for (const row of (data ?? []) as Array<{
    id: string;
    entity: LinkEntity;
    status: string;
    candidates: Array<{ id: string }>;
  }>) {
    if (row.status !== "review") continue;
    let target: string | null = null;
    if (decision === "same") {
      target = localId ?? (row.candidates.length === 1 ? row.candidates[0]!.id : null);
      if (!target || !row.candidates.some((c) => c.id === target))
        throw new Error("Escolha um dos lançamentos sugeridos.");
    }
    const { error: upErr } = await ctx.admin
      .from("contaazul_record_links")
      .update({
        decision,
        local_id: target,
        decided_by: ctx.userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("workspace_id", ctx.workspaceId);
    if (upErr) throw new Error(upErr.message);
    changed++;
  }
  return changed;
}

export const __test = { pageAll, chunks };
