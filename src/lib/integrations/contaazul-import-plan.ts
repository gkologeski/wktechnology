// Planejamento puro (client-safe) da importação completa do Conta Azul.
// Recebe o que já existe no TechERP, os vínculos gravados e o que veio da API,
// e devolve o que vincular, criar ou mandar para revisão. Sem banco ou rede.
// Regra: registro existente nunca é reescrito; ambiguidade vira revisão.
import { parseDateOnly } from "./contaazul-map";
import {
  matchByName,
  normCompanyName,
  normText,
  reconcileEntries,
  toCents,
  type Direction,
  type EntryStatus,
  type MatchTier,
  type ReconEntry,
} from "./contaazul-reconcile";

type Raw = Record<string, unknown>;

export type LinkEntity =
  | "receivable"
  | "payable"
  | "transfer"
  | "category"
  | "cost_center"
  | "bank_account";

export type ExistingLink = {
  entity: LinkEntity;
  contaazulId: string;
  status: "matched" | "imported" | "review" | "ignored";
  decision: "same" | "new" | "ignore" | null;
  localId: string | null;
};

export const linkKey = (entity: LinkEntity, id: string) => `${entity}|${id}`;

/* -------------------------------------------------------------------------- */
/* Eventos financeiros (contas a receber/pagar)                               */
/* -------------------------------------------------------------------------- */

export type CaEvent = {
  id: string;
  direction: Direction;
  dueDate: string;
  competenceDate: string;
  amount: number;
  paid: number;
  /** Situação original do Conta Azul (ACQUITTED, PENDING, OVERDUE, LOST...). */
  caStatus: string;
  description: string;
  categoryId: string | null;
  costCenterId: string | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const firstId = (v: unknown): string | null => {
  if (!Array.isArray(v) || !v.length) return null;
  const id = (v[0] as Raw | null)?.["id"];
  return typeof id === "string" && id ? id : null;
};

/** Converte um item de `contas-a-receber/buscar` ou `contas-a-pagar/buscar`. */
export function mapCaEvent(raw: Raw, direction: Direction): CaEvent | null {
  const id = typeof raw["id"] === "string" ? raw["id"] : "";
  const dueDate = parseDateOnly(raw["data_vencimento"]);
  const amount = Math.abs(num(raw["total"]));
  if (!id || !dueDate || amount <= 0) return null;
  const party = (direction === "receivable" ? raw["cliente"] : raw["fornecedor"]) as Raw | null;
  const description = String(raw["descricao"] ?? "").trim();
  return {
    id,
    direction,
    dueDate,
    competenceDate: parseDateOnly(raw["data_competencia"]) ?? dueDate,
    amount,
    paid: Math.min(Math.abs(num(raw["pago"])), amount),
    caStatus: String(raw["status"] ?? "").toUpperCase(),
    description: (description || `Conta Azul ${id}`).slice(0, 500),
    categoryId: firstId(raw["categorias"]),
    costCenterId: firstId(raw["centros_de_custo"]),
    counterpartyId: typeof party?.["id"] === "string" ? (party["id"] as string) : null,
    counterpartyName: typeof party?.["nome"] === "string" ? (party["nome"] as string) : null,
  };
}

/** Situação TechFinance esperada para o evento (sem depender do relógio). */
export function caEventTargetStatus(e: CaEvent): EntryStatus {
  if (e.caStatus === "LOST" || e.caStatus === "CANCELLED" || e.caStatus === "CANCELED")
    return "cancelled";
  if (e.paid > 0 && toCents(e.paid) >= toCents(e.amount)) return "paid";
  if (e.paid > 0) return "partial";
  return e.caStatus === "OVERDUE" ? "overdue" : "open";
}

export type LocalEntry = {
  id: string;
  direction: Direction;
  dueDate: string;
  amount: number;
  paid: number;
  description: string;
  counterparty: string | null;
  status: EntryStatus;
};

export type EntryPlan = {
  /** Mesmo lançamento: só grava o vínculo; `topUpCents` é baixa nova registrada no Conta Azul. */
  match: Array<{
    apiId: string;
    localId: string;
    tier: MatchTier | "manual";
    topUpCents: number;
    cancel: boolean;
  }>;
  /** Não existe no TechERP: criar. */
  create: string[];
  /** Possível mesmo lançamento com data ou valor alterado, ou vários candidatos. */
  review: Array<{
    apiId: string;
    reason: "date_changed" | "amount_changed" | "ambiguous";
    localIds: string[];
  }>;
  /** Já vinculados ou ignorados em execuções anteriores. */
  skipped: number;
};

function matchDelta(api: CaEvent, local: LocalEntry) {
  const cancel =
    caEventTargetStatus(api) === "cancelled" && local.status !== "cancelled" && local.paid === 0;
  const topUp =
    local.status === "cancelled" || cancel
      ? 0
      : Math.max(0, toCents(api.paid) - toCents(local.paid));
  return { topUpCents: topUp, cancel };
}

const toRecon = (e: {
  id: string;
  direction: Direction;
  dueDate: string;
  amount: number;
  description: string;
  counterparty: string | null;
  status: EntryStatus;
}): ReconEntry => ({
  id: e.id,
  direction: e.direction,
  dueDate: e.dueDate,
  amountCents: toCents(e.amount),
  description: e.description,
  counterparty: e.counterparty,
  status: e.status,
});

export function planEntries(
  local: LocalEntry[],
  api: CaEvent[],
  links: Map<string, ExistingLink>,
): EntryPlan {
  const plan: EntryPlan = { match: [], create: [], review: [], skipped: 0 };
  const localById = new Map(local.map((l) => [l.id, l]));
  const apiById = new Map(api.map((a) => [a.id, a]));
  const usedLocal = new Set<string>();
  for (const l of links.values())
    if ((l.status === "matched" || l.status === "imported") && l.localId) usedLocal.add(l.localId);

  const pending: CaEvent[] = [];
  for (const a of api) {
    const link = links.get(linkKey(a.direction, a.id));
    if (!link) {
      pending.push(a);
      continue;
    }
    if (link.status !== "review") {
      plan.skipped++;
      continue;
    }
    if (link.decision === "ignore") plan.skipped++;
    else if (link.decision === "new") plan.create.push(a.id);
    else if (
      link.decision === "same" &&
      link.localId &&
      localById.has(link.localId) &&
      !usedLocal.has(link.localId)
    ) {
      usedLocal.add(link.localId);
      plan.match.push({
        apiId: a.id,
        localId: link.localId,
        tier: "manual",
        ...matchDelta(a, localById.get(link.localId)!),
      });
    } else pending.push(a); // revisão em aberto: recalcula
  }

  const pool = local.filter((l) => !usedLocal.has(l.id));
  const rec = reconcileEntries(
    pool.map(toRecon),
    pending.map((a) =>
      toRecon({ ...a, counterparty: a.counterpartyName, status: caEventTargetStatus(a) }),
    ),
  );
  for (const m of rec.matched) {
    if (m.tier === "date_amount") {
      // Só data e valor iguais: descrição e contraparte diferentes pedem conferência humana.
      plan.review.push({ apiId: m.apiId, reason: "ambiguous", localIds: [m.localId] });
      continue;
    }
    plan.match.push({
      apiId: m.apiId,
      localId: m.localId,
      tier: m.tier,
      ...matchDelta(apiById.get(m.apiId)!, localById.get(m.localId)!),
    });
  }
  for (const g of rec.review)
    for (const apiId of g.apiIds)
      plan.review.push({ apiId, reason: "ambiguous", localIds: g.localIds });

  // Sobras dos dois lados: mesmo texto/contraparte com data ou valor diferente → revisão.
  const localOnly = rec.localOnly.map((id) => localById.get(id)!);
  const keyText = (d: string, desc: string, cp: string | null) =>
    `${d}|${normText(desc)}|${normText(cp)}`;
  const byAmount = new Map<string, string[]>();
  const byDate = new Map<string, string[]>();
  for (const l of localOnly) {
    const base = keyText(l.direction, l.description, l.counterparty);
    const k1 = `${base}|${toCents(l.amount)}`;
    const k2 = `${base}|${l.dueDate}`;
    byAmount.set(k1, [...(byAmount.get(k1) ?? []), l.id]);
    byDate.set(k2, [...(byDate.get(k2) ?? []), l.id]);
  }
  for (const apiId of rec.apiOnly) {
    const a = apiById.get(apiId)!;
    const base = keyText(a.direction, a.description, a.counterpartyName);
    const sameAmount = byAmount.get(`${base}|${toCents(a.amount)}`);
    const sameDate = byDate.get(`${base}|${a.dueDate}`);
    if (sameAmount?.length)
      plan.review.push({ apiId, reason: "date_changed", localIds: sameAmount.slice(0, 5) });
    else if (sameDate?.length)
      plan.review.push({ apiId, reason: "amount_changed", localIds: sameDate.slice(0, 5) });
    else plan.create.push(apiId);
  }
  return plan;
}

/* -------------------------------------------------------------------------- */
/* Transferências entre contas                                                */
/* -------------------------------------------------------------------------- */

export type CaTransfer = {
  id: string;
  date: string;
  amount: number;
  description: string;
  fromAccountId: string | null;
  toAccountId: string | null;
};

export function mapCaTransfer(raw: Raw): CaTransfer | null {
  const id = typeof raw["id"] === "string" ? raw["id"] : "";
  const date = parseDateOnly(raw["data"]);
  const amount = Math.abs(num(raw["valor"]));
  if (!id || !date || amount <= 0) return null;
  const acc = (side: string) => {
    const v = ((raw[side] as Raw | null)?.["conta_financeira"] as Raw | null)?.["id"];
    return typeof v === "string" && v ? v : null;
  };
  return {
    id,
    date,
    amount,
    description: (String(raw["descricao"] ?? "").trim() || "Transferência entre contas").slice(
      0,
      500,
    ),
    fromAccountId: acc("origem"),
    toAccountId: acc("destino"),
  };
}

/** Transferência local: um par (saída + entrada) ou uma perna órfã. */
export type LocalTransfer = { key: string; localId: string; date: string; amount: number };

/** Pareia por data + valor (pernas idênticas são indistinguíveis); o resto é criado. */
export function planTransfers(
  local: LocalTransfer[],
  api: CaTransfer[],
  links: Map<string, ExistingLink>,
): { match: Array<{ apiId: string; localId: string }>; create: string[]; skipped: number } {
  const used = new Set<string>();
  for (const l of links.values()) if (l.entity === "transfer" && l.localId) used.add(l.localId);
  const pool = new Map<string, LocalTransfer[]>();
  for (const t of local) {
    if (used.has(t.localId)) continue;
    const k = `${t.date}|${toCents(t.amount)}`;
    pool.set(k, [...(pool.get(k) ?? []), t]);
  }
  const out = {
    match: [] as Array<{ apiId: string; localId: string }>,
    create: [] as string[],
    skipped: 0,
  };
  for (const a of api) {
    if (links.has(linkKey("transfer", a.id))) {
      out.skipped++;
      continue;
    }
    const cands = pool.get(`${a.date}|${toCents(a.amount)}`);
    const hit = cands?.shift();
    if (hit) out.match.push({ apiId: a.id, localId: hit.localId });
    else out.create.push(a.id);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Cadastros auxiliares                                                       */
/* -------------------------------------------------------------------------- */

export type CatalogPlan = {
  match: Array<{ remoteId: string; localId: string }>;
  create: string[];
  review: Array<{ remoteId: string; localIds: string[] }>;
  skipped: number;
};

export function planCatalog(
  entity: "category" | "cost_center" | "bank_account",
  remote: Array<{ id: string; name: string }>,
  local: Array<{ id: string; name: string; contaazulId?: string | null }>,
  links: Map<string, ExistingLink>,
): CatalogPlan {
  const plan: CatalogPlan = { match: [], create: [], review: [], skipped: 0 };
  const byExt = new Map(local.filter((l) => l.contaazulId).map((l) => [l.contaazulId!, l.id]));
  const used = new Set<string>();
  for (const l of links.values()) if (l.entity === entity && l.localId) used.add(l.localId);
  const todo: Array<{ id: string; name: string }> = [];
  for (const r of remote) {
    const link = links.get(linkKey(entity, r.id));
    if (link && link.status !== "review") plan.skipped++;
    else if (link?.decision === "new") plan.create.push(r.id);
    else if (link?.decision === "same" && link.localId)
      plan.match.push({ remoteId: r.id, localId: link.localId });
    else if (link?.decision === "ignore") plan.skipped++;
    else if (byExt.has(r.id)) plan.match.push({ remoteId: r.id, localId: byExt.get(r.id)! });
    else todo.push(r);
  }
  const free = local.filter((l) => !used.has(l.id));
  for (const m of matchByName(todo, free)) {
    if (m.outcome === "linked") plan.match.push({ remoteId: m.remoteId, localId: m.localIds[0]! });
    else if (m.outcome === "review")
      plan.review.push({ remoteId: m.remoteId, localIds: m.localIds });
    else plan.create.push(m.remoteId);
  }
  return plan;
}

/* -------------------------------------------------------------------------- */
/* Pessoas e baixas                                                           */
/* -------------------------------------------------------------------------- */

/** "Maria Eduarda Santos" → { first: "Maria", last: "Eduarda Santos" }. */
export function splitPersonName(name: string): { first: string; last: string | null } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { first: "Sem nome", last: null };
  return { first: words[0]!.slice(0, 100), last: words.slice(1).join(" ").slice(0, 200) || null };
}

/** CNPJ só quando tem 14 dígitos; nunca inventa documento. */
export function cnpjOrNull(doc: unknown): string | null {
  const d = String(doc ?? "").replace(/\D+/g, "");
  return d.length === 14 ? d : null;
}

export type PaymentPart = { paidAt: string; cents: number; accountId: string | null };

const pickPath = (raw: Raw, paths: string[]): unknown => {
  for (const p of paths) {
    const v = p
      .split(".")
      .reduce<unknown>(
        (acc, k) => (acc && typeof acc === "object" ? (acc as Raw)[k] : undefined),
        raw,
      );
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

/**
 * Extrai as baixas do detalhe da parcela. `targetCents` é o quanto falta baixar
 * no TechERP. Se o formato não for reconhecido, usa uma baixa única no
 * vencimento (marcada como estimada).
 */
export function paymentParts(
  detail: unknown,
  ev: CaEvent,
  targetCents: number,
): { parts: PaymentPart[]; estimated: boolean } {
  if (targetCents <= 0) return { parts: [], estimated: false };
  const parsed: PaymentPart[] = [];
  const list =
    detail && typeof detail === "object"
      ? ((detail as Raw)["baixas"] ?? (detail as Raw)["pagamentos"])
      : null;
  if (Array.isArray(list)) {
    for (const item of list as Raw[]) {
      const paidAt = parseDateOnly(pickPath(item, ["data_pagamento", "data", "data_baixa"]));
      const cents = toCents(
        pickPath(item, [
          "composicao_valor.valor_liquido",
          "valor_composicao.valor_liquido",
          "valor_pago",
          "valor",
        ]),
      );
      const acc = pickPath(item, ["conta_financeira.id", "id_conta_financeira"]);
      if (!paidAt || cents <= 0) {
        parsed.length = 0;
        break;
      }
      parsed.push({ paidAt, cents, accountId: typeof acc === "string" ? acc : null });
    }
  }
  const sum = parsed.reduce((s, p) => s + p.cents, 0);
  if (parsed.length && sum === targetCents) return { parts: parsed, estimated: false };
  if (parsed.length) {
    // Baixa parcial já existente: lança a diferença na data da última baixa.
    const last = [...parsed].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).at(-1)!;
    return { parts: [{ ...last, cents: targetCents }], estimated: true };
  }
  return { parts: [{ paidAt: ev.dueDate, cents: targetCents, accountId: null }], estimated: true };
}

/** Nome comparável de empresa, reexportado para a tela de revisão. */
export const comparableName = normCompanyName;

/* -------------------------------------------------------------------------- */
/* Quitação com desconto e vendas                                             */
/* -------------------------------------------------------------------------- */

/**
 * Conta Azul marca como quitado (ACQUITTED) com valor pago menor que o total
 * quando houve desconto. A diferença é desconto, não saldo em aberto.
 */
export function caDiscountCents(e: CaEvent): number {
  if (e.caStatus !== "ACQUITTED" || e.paid <= 0) return 0;
  return Math.max(0, toCents(e.amount) - toCents(e.paid));
}

/** Valor do lançamento no TechERP: o líquido quitado quando houve desconto. */
export function effectiveAmount(e: CaEvent): number {
  return caDiscountCents(e) > 0 ? e.paid : e.amount;
}

export type CaSale = {
  id: string;
  number: number | null;
  date: string | null;
  kind: string | null;
  itemsKind: string | null;
  status: string | null;
  statusLabel: string | null;
  total: number;
  customerId: string | null;
  customerName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const SALE_STATUS_PT: Record<string, string> = {
  APROVADO: "Aprovada",
  EM_ANDAMENTO: "Em andamento",
  EM_ABERTO: "Em aberto",
  CANCELADO: "Cancelada",
  FATURADO: "Faturada",
  ORCAMENTO: "Orçamento",
};

/** Converte um item de `/v1/venda/busca`. */
export function mapCaSale(raw: Raw): CaSale | null {
  const id = typeof raw["id"] === "string" ? raw["id"] : "";
  if (!id) return null;
  const sit = (raw["situacao"] ?? null) as Raw | null;
  const status = typeof sit?.["nome"] === "string" ? (sit["nome"] as string) : null;
  const customer = (raw["cliente"] ?? null) as Raw | null;
  const n = Number(raw["numero"]);
  const ts = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id,
    number: Number.isInteger(n) ? n : null,
    date: parseDateOnly(raw["data"]),
    kind: ts(raw["tipo"]),
    itemsKind: ts(raw["itens"]),
    status,
    statusLabel:
      (status && SALE_STATUS_PT[status]) ||
      (typeof sit?.["descricao"] === "string" ? (sit["descricao"] as string) : status),
    total: Math.round(num(raw["total"]) * 100) / 100,
    customerId: typeof customer?.["id"] === "string" ? (customer["id"] as string) : null,
    customerName: typeof customer?.["nome"] === "string" ? (customer["nome"] as string) : null,
    createdAt: ts(raw["criado_em"]),
    updatedAt: ts(raw["data_alteracao"]),
  };
}
