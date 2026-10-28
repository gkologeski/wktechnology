// Conciliação pura (client-safe) entre registros já existentes no TechERP
// (ex.: carga por planilha) e os registros lidos da API do Conta Azul.
// Sem banco, rede ou segredos. Nunca decide por aproximação ambígua:
// quando há mais de um candidato possível, o item vai para revisão.

export type Direction = "receivable" | "payable";
export type EntryStatus = "open" | "partial" | "paid" | "overdue" | "cancelled";

/** Texto comparável: minúsculas, sem acentos, só letras/dígitos separados por espaço. */
export function normText(input: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COMPANY_SUFFIXES = new Set([
  "ltda",
  "me",
  "epp",
  "eireli",
  "sa",
  "s",
  "a",
  "ss",
  "mei",
  "limitada",
  "cia",
]);

/** Nome de empresa comparável: remove sufixos societários comuns no fim. */
export function normCompanyName(input: unknown): string {
  const words = normText(input).split(" ").filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1]!)) words.pop();
  return words.join(" ");
}

export function digits(input: unknown): string {
  return String(input ?? "").replace(/\D+/g, "");
}

export function toCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : 0;
}

/** Situação do evento financeiro do Conta Azul → situação do TechFinance. */
export function mapCaEventStatus(raw: unknown, paid: number, total: number): EntryStatus {
  switch (String(raw ?? "").toUpperCase()) {
    case "ACQUITTED":
      return "paid";
    case "OVERDUE":
      return paid > 0 ? "partial" : "overdue";
    case "PENDING":
      return paid > 0 ? "partial" : "open";
    case "PARTIAL":
    case "PARTIALLY_ACQUITTED":
      return "partial";
    case "LOST":
    case "CANCELLED":
    case "CANCELED":
      return "cancelled";
    default:
      if (total > 0 && paid + 0.005 >= total) return "paid";
      return paid > 0 ? "partial" : "open";
  }
}

export type ReconEntry = {
  id: string;
  direction: Direction;
  dueDate: string;
  amountCents: number;
  description: string;
  counterparty: string | null;
  status: EntryStatus;
};

export type MatchTier = "exact" | "no_counterparty" | "no_description" | "date_amount";

export type EntryReconciliation = {
  matched: Array<{ apiId: string; localId: string; tier: MatchTier; statusDiffers: boolean }>;
  /** Existem só na API: candidatos a lançamento novo. */
  apiOnly: string[];
  /** Existem só no TechERP: preservados, nunca apagados. */
  localOnly: string[];
  /** Mesma data e valor com mais de um candidato diferente: decisão humana. */
  review: Array<{ apiIds: string[]; localIds: string[] }>;
};

type KeyFn = (e: ReconEntry) => string;

const base = (e: ReconEntry) => `${e.direction}|${e.dueDate}|${e.amountCents}`;
const TIERS: Array<{ tier: MatchTier; key: KeyFn }> = [
  {
    tier: "exact",
    key: (e) => `${base(e)}|${normText(e.description)}|${normText(e.counterparty)}`,
  },
  { tier: "no_counterparty", key: (e) => `${base(e)}|${normText(e.description)}` },
  { tier: "no_description", key: (e) => `${base(e)}|${normText(e.counterparty)}` },
];

function groupBy(items: ReconEntry[], key: KeyFn): Map<string, ReconEntry[]> {
  const map = new Map<string, ReconEntry[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Concilia lançamentos. Nas três primeiras camadas os candidatos são
 * idênticos nos campos comparados, então o pareamento é seguro (prioriza a
 * mesma situação). Na última (só data + valor) só pareia quando há exatamente
 * um candidato de cada lado; caso contrário, o grupo vai para revisão.
 */
export function reconcileEntries(local: ReconEntry[], api: ReconEntry[]): EntryReconciliation {
  const result: EntryReconciliation = { matched: [], apiOnly: [], localOnly: [], review: [] };
  let restLocal = [...local];
  let restApi = [...api];

  for (const { tier, key } of TIERS) {
    const localGroups = groupBy(restLocal, key);
    const usedLocal = new Set<string>();
    const usedApi = new Set<string>();
    for (const [k, apiGroup] of groupBy(restApi, key)) {
      const localGroup = localGroups.get(k);
      if (!localGroup?.length) continue;
      const pool = [...localGroup];
      for (const a of apiGroup) {
        if (!pool.length) break;
        let idx = pool.findIndex((l) => l.status === a.status);
        if (idx < 0) idx = 0;
        const [l] = pool.splice(idx, 1);
        result.matched.push({
          apiId: a.id,
          localId: l!.id,
          tier,
          statusDiffers: l!.status !== a.status,
        });
        usedLocal.add(l!.id);
        usedApi.add(a.id);
      }
    }
    restLocal = restLocal.filter((l) => !usedLocal.has(l.id));
    restApi = restApi.filter((a) => !usedApi.has(a.id));
  }

  const localByBase = groupBy(restLocal, base);
  const reviewedLocal = new Set<string>();
  for (const [k, apiGroup] of groupBy(restApi, base)) {
    const localGroup = localByBase.get(k);
    if (!localGroup?.length) {
      result.apiOnly.push(...apiGroup.map((a) => a.id));
      continue;
    }
    if (apiGroup.length === 1 && localGroup.length === 1) {
      result.matched.push({
        apiId: apiGroup[0]!.id,
        localId: localGroup[0]!.id,
        tier: "date_amount",
        statusDiffers: apiGroup[0]!.status !== localGroup[0]!.status,
      });
    } else {
      result.review.push({
        apiIds: apiGroup.map((a) => a.id),
        localIds: localGroup.map((l) => l.id),
      });
    }
    for (const l of localGroup) reviewedLocal.add(l.id);
  }
  result.localOnly = restLocal.filter((l) => !reviewedLocal.has(l.id)).map((l) => l.id);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Pessoas (clientes/fornecedores) → Empresas/Contatos                        */
/* -------------------------------------------------------------------------- */

export type CaPerson = {
  id: string;
  name: string;
  kind: "company" | "person";
  document: string | null;
  email: string | null;
};

export type LocalCompany = { id: string; name: string; cnpj: string | null };
export type LocalContact = { id: string; fullName: string; email: string | null };

export type PersonMatch =
  | { personId: string; outcome: "linked"; by: "document" | "email" | "name"; localId: string }
  | { personId: string; outcome: "review"; reason: "multiple_candidates"; localIds: string[] }
  | { personId: string; outcome: "new" };

function indexBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Casa pessoas do Conta Azul com Empresas (CNPJ → nome) e Contatos
 * (e-mail → nome). Vínculo só com candidato único; nunca sobrescreve.
 */
export function matchPeople(
  people: CaPerson[],
  companies: LocalCompany[],
  contacts: LocalContact[],
): PersonMatch[] {
  const byCnpj = indexBy(companies, (c) => (digits(c.cnpj).length === 14 ? digits(c.cnpj) : ""));
  const byCompanyName = indexBy(companies, (c) => normCompanyName(c.name));
  const byEmail = indexBy(contacts, (c) => (c.email ?? "").trim().toLowerCase());
  const byContactName = indexBy(contacts, (c) => normText(c.fullName));

  return people.map((p): PersonMatch => {
    const pick = (
      candidates: Array<{ id: string }> | undefined,
      by: "document" | "email" | "name",
    ): PersonMatch | null => {
      if (!candidates?.length) return null;
      const ids = [...new Set(candidates.map((c) => c.id))];
      if (ids.length === 1) return { personId: p.id, outcome: "linked", by, localId: ids[0]! };
      return { personId: p.id, outcome: "review", reason: "multiple_candidates", localIds: ids };
    };
    if (p.kind === "company") {
      const doc = digits(p.document);
      return (
        (doc.length === 14 ? pick(byCnpj.get(doc), "document") : null) ??
        pick(byCompanyName.get(normCompanyName(p.name)), "name") ?? {
          personId: p.id,
          outcome: "new",
        }
      );
    }
    const email = (p.email ?? "").trim().toLowerCase();
    return (
      (email ? pick(byEmail.get(email), "email") : null) ??
      pick(byContactName.get(normText(p.name)), "name") ?? { personId: p.id, outcome: "new" }
    );
  });
}

/** Casa cadastros auxiliares (categorias, centros, contas) pelo nome normalizado. */
export function matchByName<T extends { id: string; name: string }>(
  remote: Array<{ id: string; name: string }>,
  local: T[],
): Array<{ remoteId: string; outcome: "linked" | "review" | "new"; localIds: string[] }> {
  const byName = indexBy(local, (l) => normText(l.name));
  return remote.map((r) => {
    const ids = [...new Set((byName.get(normText(r.name)) ?? []).map((l) => l.id))];
    if (ids.length === 1) return { remoteId: r.id, outcome: "linked" as const, localIds: ids };
    if (ids.length > 1) return { remoteId: r.id, outcome: "review" as const, localIds: ids };
    return { remoteId: r.id, outcome: "new" as const, localIds: [] };
  });
}

/* -------------------------------------------------------------------------- */
/* Nomes parecidos → sugestão (nunca vínculo automático)                      */
/* -------------------------------------------------------------------------- */

const NAME_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "the",
  "and",
  "comercio",
  "servicos",
  "industria",
  "brasil",
  "grupo",
]);

const ABBREVIATIONS: Record<string, string> = {
  tec: "tecnologia",
  tecnol: "tecnologia",
  sist: "sistemas",
  sistemas: "sistemas",
  com: "comercio",
  serv: "servicos",
  ind: "industria",
  adm: "administracao",
  cons: "consultoria",
  inf: "informatica",
  info: "informatica",
};

export function nameTokens(input: unknown): string[] {
  return normCompanyName(input)
    .split(" ")
    .map((w) => ABBREVIATIONS[w] ?? w)
    .filter((w) => w.length > 1 && !NAME_STOPWORDS.has(w));
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Semelhança 0–1 entre nomes, insensível a acentos, sufixos, abreviações e ordem. */
export function nameSimilarity(a: unknown, b: unknown): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const sa = [...ta].sort().join(" ");
  const sb = [...tb].sort().join(" ");
  if (sa === sb) return 1;
  // Tokens casam se iguais ou quase iguais (erros de digitação).
  const used = new Set<number>();
  let common = 0;
  for (const t of ta) {
    let best = -1;
    let bestScore = 0;
    tb.forEach((u, i) => {
      if (used.has(i)) return;
      const sc = t === u ? 1 : jaroWinkler(t, u);
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    });
    if (best >= 0 && bestScore >= 0.92) {
      used.add(best);
      common += bestScore;
    }
  }
  const dice = (2 * common) / (ta.length + tb.length);
  // Um nome contido no outro (ex.: "Solutcom" x "Solutcom Informática") pede revisão.
  const contained = common >= Math.min(ta.length, tb.length) - 0.0001 ? 0.8 : 0;
  const jw = jaroWinkler(sa, sb);
  return Math.round(Math.max(dice, contained, 0.6 * dice + 0.4 * jw) * 10000) / 10000;
}

export const SUGGEST_MIN = 0.9;
export const REVIEW_MIN = 0.75;

export type NameSuggestion = {
  outcome: "suggested" | "review" | "new";
  score: number | null;
  candidates: Array<{ id: string; name: string; score: number }>;
};

/** Índice por token para evitar comparar cada nome com todas as empresas. */
export function buildNameIndex<T extends { id: string; name: string }>(items: T[]) {
  const byToken = new Map<string, T[]>();
  for (const item of items) {
    for (const t of new Set(nameTokens(item.name))) {
      if (t.length < 3) continue;
      const list = byToken.get(t);
      if (list) list.push(item);
      else byToken.set(t, [item]);
    }
  }
  return byToken;
}

export function suggestByName<T extends { id: string; name: string }>(
  name: string,
  index: Map<string, T[]>,
  maxCandidates = 5,
): NameSuggestion {
  const pool = new Map<string, T>();
  for (const t of new Set(nameTokens(name))) {
    const list = index.get(t);
    if (!list || list.length > 400) continue; // token comum demais não ajuda
    for (const item of list) pool.set(item.id, item);
  }
  const scored = [...pool.values()]
    .map((c) => ({ id: c.id, name: c.name, score: nameSimilarity(name, c.name) }))
    .filter((c) => c.score >= REVIEW_MIN)
    .sort((x, y) => y.score - x.score)
    .slice(0, maxCandidates);
  if (!scored.length) return { outcome: "new", score: null, candidates: [] };
  const [best, second] = scored;
  const unique = !second || second.score < REVIEW_MIN + 0.1;
  return {
    outcome: best!.score >= SUGGEST_MIN && unique ? "suggested" : "review",
    score: best!.score,
    candidates: scored,
  };
}
