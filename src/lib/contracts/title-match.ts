// Semelhança entre o título do contrato e o nome da pessoa.
// Módulo client-safe: usado para ordenar o seletor de contrato de prestação
// na alocação de pessoas (apresentação apenas, nada é escondido).

const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "la"]);

/** Remove acentos, pontuação e normaliza espaços/caixa. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Remove prefixos entre colchetes, ex.: "[PRESTAÇÃO] [ADITIVO 2] ...". */
function stripTitlePrefixes(title: string): string {
  return title.replace(/\[[^\]]*\]/g, " ");
}

function nameTokens(personName: string): string[] {
  return normalize(personName)
    .split(" ")
    .filter((t) => t.length > 1 && !PARTICLES.has(t));
}

/**
 * Pontuação de 0 (nenhuma relação) a 100.
 *  - nome completo (todos os tokens relevantes) presente no título → maior peso;
 *  - sobrenomes presentes → peso médio;
 *  - apenas primeiro nome → peso menor.
 */
export function scoreContractTitleForPerson(
  title: string | null | undefined,
  personName: string | null | undefined,
): number {
  const tokens = nameTokens(personName ?? "");
  if (!tokens.length) return 0;
  const haystack = normalize(stripTitlePrefixes(title ?? ""));
  if (!haystack) return 0;

  const present = tokens.filter((t) => haystack.includes(t));
  if (!present.length) return 0;

  const first = tokens[0] as string;
  const surnames = tokens.slice(1);
  const surnamesPresent = surnames.filter((t) => haystack.includes(t)).length;

  if (present.length === tokens.length) return 100;
  if (surnamesPresent > 0 && present.includes(first)) {
    return 70 + Math.round((surnamesPresent / Math.max(surnames.length, 1)) * 20);
  }
  if (surnamesPresent > 0) {
    return 40 + Math.round((surnamesPresent / Math.max(surnames.length, 1)) * 20);
  }
  return 25;
}

/** Divide a lista em prováveis (score > 0, ordem decrescente) e o restante. */
export function splitContractsByPersonMatch<T>(
  items: T[],
  personName: string | null | undefined,
  getTitle: (item: T) => string,
): { likely: T[]; others: T[] } {
  const scored = items.map((item, index) => ({
    item,
    index,
    score: scoreContractTitleForPerson(getTitle(item), personName),
  }));
  const likely = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.item);
  const others = scored.filter((s) => s.score === 0).map((s) => s.item);
  return { likely, others };
}

// ===================== Ranqueamento por documento/contraparte =====================
// Além do título, o seletor de contratos de prestação usa o CPF/CNPJ da pessoa
// e o nome/documento da contraparte do contrato para ranquear os mais relevantes.

export type PersonMatchInput = {
  /** Nome completo da pessoa. */
  name?: string | null;
  /** CPF/CNPJ (qualquer formatação) da pessoa/PJ dela. */
  docs?: Array<string | null | undefined>;
  /** Razão social / nome fantasia da PJ da pessoa. */
  companyNames?: Array<string | null | undefined>;
};

export type ContractMatchInput = {
  title?: string | null;
  /** Nome da contraparte (empresa vinculada ou extraída do documento). */
  counterpartyName?: string | null;
  /** CNPJ/CPF da contraparte. */
  counterpartyDocs?: Array<string | null | undefined>;
};

export type ContractMatchResult = { score: number; reason: string | null };

/** Só dígitos; retorna null quando não houver documento utilizável. */
export function docDigits(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length >= 11 ? digits : null;
}

function normalizedDocs(values: Array<string | null | undefined> | undefined): string[] {
  const out = new Set<string>();
  for (const v of values ?? []) {
    const d = docDigits(v);
    if (d) out.add(d);
  }
  return [...out];
}

/** Score de nome (0..100) reaproveitando a heurística de tokens do título. */
function scoreName(haystack: string | null | undefined, personName: string | null | undefined) {
  return scoreContractTitleForPerson(haystack, personName);
}

/**
 * Pontuação combinada (0..100) do contrato para a pessoa:
 *  - documento (CPF/CNPJ) da pessoa igual ao da contraparte, ou presente no título → 100;
 *  - nome da contraparte igual/parecido com o nome da pessoa (ou da PJ dela) → até 95;
 *  - nome da pessoa presente no título → heurística existente (até 100 → limitado a 90).
 */
export function scoreContractForPerson(
  contract: ContractMatchInput,
  person: PersonMatchInput,
): ContractMatchResult {
  const personDocs = normalizedDocs(person.docs);
  const contractDocs = normalizedDocs(contract.counterpartyDocs);
  const titleDigits = (contract.title ?? "").replace(/\D+/g, "");

  for (const d of personDocs) {
    if (contractDocs.includes(d)) return { score: 100, reason: "CPF/CNPJ da contraparte" };
  }
  for (const d of personDocs) {
    if (d.length >= 11 && titleDigits.includes(d)) {
      return { score: 98, reason: "CPF/CNPJ no título" };
    }
  }

  const names = [person.name, ...(person.companyNames ?? [])].filter(
    (n): n is string => typeof n === "string" && n.trim().length > 0,
  );

  let best: ContractMatchResult = { score: 0, reason: null };
  for (const name of names) {
    const counterparty = scoreName(contract.counterpartyName, name);
    if (counterparty > 0) {
      const score = Math.min(95, 60 + Math.round(counterparty * 0.35));
      if (score > best.score) best = { score, reason: "Contraparte semelhante" };
    }
    const title = scoreName(contract.title, name);
    if (title > 0) {
      const score = Math.min(90, title);
      if (score > best.score) best = { score, reason: "Nome no título" };
    }
  }
  return best;
}

/** Divide em prováveis (com motivo) e o restante, usando nome + documentos. */
export function splitContractsForPerson<T>(
  items: T[],
  person: PersonMatchInput,
  toMatchInput: (item: T) => ContractMatchInput,
): {
  likely: Array<{ item: T; score: number; reason: string | null }>;
  others: T[];
} {
  const scored = items.map((item, index) => ({
    item,
    index,
    ...scoreContractForPerson(toMatchInput(item), person),
  }));
  const likely = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item, score, reason }) => ({ item, score, reason }));
  const others = scored.filter((s) => s.score === 0).map((s) => s.item);
  return { likely, others };
}
