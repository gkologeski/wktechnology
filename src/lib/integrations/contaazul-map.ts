// Mapeamento puro (client-safe) dos dados do Conta Azul para o TechFinance.
// Sem acesso a banco, rede ou segredos — testável isoladamente.

export type CaEntity =
  | "categories"
  | "cost-centers"
  | "bank-accounts"
  | "receivable"
  | "payable"
  | "statements";

export const CA_ENTITIES: CaEntity[] = [
  "categories",
  "cost-centers",
  "bank-accounts",
  "receivable",
  "payable",
  "statements",
];

export const CA_ENTITY_LABELS: Record<CaEntity, string> = {
  categories: "Categorias (plano de contas)",
  "cost-centers": "Centros de custo",
  "bank-accounts": "Contas bancárias",
  receivable: "Contas a receber",
  payable: "Contas a pagar",
  statements: "Extratos bancários",
};

/**
 * Caminhos da API do Conta Azul por entidade. Centralizados aqui para que
 * ajustes de versão da API não exijam mudança na lógica de importação.
 */
export const CA_ENDPOINTS: Record<CaEntity, string> = {
  categories: "/categories",
  "cost-centers": "/cost-centers",
  "bank-accounts": "/bank-accounts",
  receivable: "/financial-events/receivables",
  payable: "/financial-events/payables",
  statements: "/bank-accounts/statements",
};

export type Money = number;

/** Converte "1.234,56", "1234.56", 1234.56 → 1234.56. Retorna null se inválido. */
export function parseBrNumber(input: unknown): Money | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  let s = raw.replace(/[()\s]/g, "").replace(/^-/, "").replace(/R\$/gi, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Formato brasileiro: ponto é separador de milhar.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  s = s.replace(/[^0-9.]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Converte "2026-08-25", "25/08/2026" ou ISO com hora → "2026-08-25". */
export function parseDateOnly(input: unknown): string | null {
  if (!input) return null;
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  const raw = String(input).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(raw);
  if (br) {
    const [, d, m, y] = br;
    const year = y!.length === 2 ? `20${y}` : y!;
    return `${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export function onlyDigits(input: unknown): string {
  return String(input ?? "").replace(/\D+/g, "");
}

/** Normaliza CPF/CNPJ para comparação (apenas dígitos). Vazio → null. */
export function normalizeDoc(input: unknown): string | null {
  const digits = onlyDigits(input);
  if (digits.length !== 11 && digits.length !== 14) return digits.length ? digits : null;
  return digits;
}

type Raw = Record<string, unknown>;

/** Lê a primeira chave existente e não vazia. */
export function pick(raw: Raw, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function nested(raw: Raw, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Raw)[part];
    return undefined;
  }, raw);
}

export function pickDeep(raw: Raw, paths: string[]): unknown {
  for (const p of paths) {
    const v = p.includes(".") ? nested(raw, p) : raw[p];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export type EntryStatus = "open" | "partial" | "paid" | "overdue" | "cancelled";

const STATUS_MAP: Record<string, EntryStatus> = {
  paid: "paid",
  pago: "paid",
  received: "paid",
  recebido: "paid",
  settled: "paid",
  liquidado: "paid",
  partial: "partial",
  parcial: "partial",
  partially_paid: "partial",
  overdue: "overdue",
  vencido: "overdue",
  atrasado: "overdue",
  late: "overdue",
  canceled: "cancelled",
  cancelled: "cancelled",
  cancelado: "cancelled",
  open: "open",
  aberto: "open",
  pending: "open",
  pendente: "open",
};

export function mapEntryStatus(
  rawStatus: unknown,
  opts: { amount: number; paid: number; dueDate: string | null; today?: string },
): EntryStatus {
  const key = String(rawStatus ?? "")
    .trim()
    .toLowerCase();
  const mapped = STATUS_MAP[key];
  if (mapped) return mapped;
  const paid = opts.paid;
  if (paid > 0 && paid + 0.005 >= opts.amount) return "paid";
  if (paid > 0) return "partial";
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  if (opts.dueDate && opts.dueDate < today) return "overdue";
  return "open";
}

export type NormalizedEntry = {
  externalId: string;
  externalRef: string;
  direction: "receivable" | "payable";
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  competenceDate: string;
  status: EntryStatus;
  installmentNumber: number | null;
  installmentTotal: number | null;
  categoryExternalId: string | null;
  costCenterExternalId: string | null;
  counterpartyName: string | null;
  counterpartyDoc: string | null;
  paymentMethod: string | null;
  raw: Raw;
};

export function entryExternalRef(direction: "receivable" | "payable", externalId: string): string {
  return `contaazul:${direction}:${externalId}`;
}

/** Mapeia um evento financeiro do Conta Azul para o formato interno. */
export function mapEntry(
  raw: Raw,
  direction: "receivable" | "payable",
  today?: string,
): NormalizedEntry | null {
  const externalId = String(pick(raw, ["id", "uuid", "financial_event_id", "codigo"]) ?? "").trim();
  if (!externalId) return null;

  const amount =
    parseBrNumber(pick(raw, ["value", "total", "amount", "valor", "valor_total"])) ?? 0;
  const paidAmount =
    parseBrNumber(pick(raw, ["paid_value", "value_paid", "valor_pago", "paid_amount"])) ?? 0;
  const dueDate =
    parseDateOnly(pick(raw, ["due_date", "dueDate", "data_vencimento", "vencimento", "date"])) ??
    parseDateOnly(pick(raw, ["created_at"])) ??
    (today ?? new Date().toISOString().slice(0, 10));
  const competenceDate =
    parseDateOnly(pick(raw, ["competence_date", "issue_date", "data_competencia", "emission"])) ??
    dueDate;

  const description =
    String(
      pick(raw, ["description", "descricao", "notes", "observation", "title"]) ??
        `Conta Azul ${direction === "receivable" ? "a receber" : "a pagar"} ${externalId}`,
    ).slice(0, 500) || `Conta Azul ${externalId}`;

  const installmentNumber = Number(pick(raw, ["installment", "parcela", "installment_number"]) ?? 0);
  const installmentTotal = Number(
    pick(raw, ["installments", "total_parcelas", "installment_total"]) ?? 0,
  );

  return {
    externalId,
    externalRef: entryExternalRef(direction, externalId),
    direction,
    description,
    amount: Math.abs(amount),
    paidAmount: Math.abs(paidAmount),
    dueDate,
    competenceDate,
    status: mapEntryStatus(pick(raw, ["status", "situacao"]), {
      amount: Math.abs(amount),
      paid: Math.abs(paidAmount),
      dueDate,
      today,
    }),
    installmentNumber: installmentNumber > 0 ? installmentNumber : null,
    installmentTotal: installmentTotal > 0 ? installmentTotal : null,
    categoryExternalId:
      (pickDeep(raw, ["category.id", "category_id", "categoria.id", "categoria_id"]) as
        | string
        | undefined) ?? null,
    costCenterExternalId:
      (pickDeep(raw, [
        "cost_center.id",
        "cost_center_id",
        "centro_custo.id",
        "centro_custo_id",
      ]) as string | undefined) ?? null,
    counterpartyName:
      (pickDeep(raw, [
        "customer.name",
        "supplier.name",
        "person.name",
        "cliente.nome",
        "fornecedor.nome",
        "counterparty_name",
      ]) as string | undefined) ?? null,
    counterpartyDoc: normalizeDoc(
      pickDeep(raw, [
        "customer.document",
        "supplier.document",
        "person.document",
        "cliente.documento",
        "fornecedor.documento",
        "document",
        "cnpj",
        "cpf",
      ]),
    ),
    paymentMethod: (pick(raw, ["payment_method", "forma_pagamento"]) as string | undefined) ?? null,
    raw,
  };
}

export type NormalizedCategory = {
  externalId: string;
  name: string;
  kind: "revenue" | "expense";
  parentExternalId: string | null;
  code: string | null;
};

export function mapCategory(raw: Raw): NormalizedCategory | null {
  const externalId = String(pick(raw, ["id", "uuid", "codigo"]) ?? "").trim();
  const name = String(pick(raw, ["name", "nome", "description"]) ?? "").trim();
  if (!externalId || !name) return null;
  const rawKind = String(pick(raw, ["type", "kind", "tipo", "nature"]) ?? "").toLowerCase();
  const isRevenue = /revenue|receita|income|entrada|credit/.test(rawKind);
  return {
    externalId,
    name: name.slice(0, 200),
    kind: isRevenue ? "revenue" : "expense",
    parentExternalId:
      (pickDeep(raw, ["parent.id", "parent_id", "pai_id"]) as string | undefined) ?? null,
    code: (pick(raw, ["code", "codigo_contabil"]) as string | undefined) ?? null,
  };
}

export type NormalizedCostCenter = {
  externalId: string;
  name: string;
  code: string | null;
  active: boolean;
};

export function mapCostCenter(raw: Raw): NormalizedCostCenter | null {
  const externalId = String(pick(raw, ["id", "uuid", "codigo"]) ?? "").trim();
  const name = String(pick(raw, ["name", "nome", "description"]) ?? "").trim();
  if (!externalId || !name) return null;
  const status = String(pick(raw, ["status", "situacao"]) ?? "").toLowerCase();
  return {
    externalId,
    name: name.slice(0, 200),
    code: (pick(raw, ["code", "codigo"]) as string | undefined) ?? null,
    active: !/inactive|inativo|disabled/.test(status),
  };
}

export type NormalizedBankAccount = {
  externalId: string;
  name: string;
  kind: string;
  initialBalance: number;
  active: boolean;
};

export function mapBankAccount(raw: Raw): NormalizedBankAccount | null {
  const externalId = String(pick(raw, ["id", "uuid", "codigo"]) ?? "").trim();
  const name = String(pick(raw, ["name", "nome", "description", "bank_name"]) ?? "").trim();
  if (!externalId || !name) return null;
  const rawKind = String(pick(raw, ["type", "kind", "tipo"]) ?? "").toLowerCase();
  const kind = /cash|caixa|dinheiro/.test(rawKind)
    ? "cash"
    : /card|cartao|cartão/.test(rawKind)
      ? "card"
      : "bank";
  const status = String(pick(raw, ["status", "situacao"]) ?? "").toLowerCase();
  return {
    externalId,
    name: name.slice(0, 200),
    kind,
    initialBalance: parseBrNumber(pick(raw, ["initial_balance", "saldo_inicial", "balance"])) ?? 0,
    active: !/inactive|inativo|disabled/.test(status),
  };
}

export type NormalizedStatementTx = {
  externalId: string;
  postedAt: string;
  amount: number;
  direction: "in" | "out";
  description: string | null;
  counterparty: string | null;
  bankAccountExternalId: string | null;
  balanceAfter: number | null;
  raw: Raw;
};

export function mapStatementTx(raw: Raw): NormalizedStatementTx | null {
  const externalId = String(pick(raw, ["id", "uuid", "transaction_id"]) ?? "").trim();
  if (!externalId) return null;
  const rawAmount = parseBrNumber(pick(raw, ["value", "amount", "valor"])) ?? 0;
  const rawType = String(pick(raw, ["type", "kind", "tipo", "direction"]) ?? "").toLowerCase();
  const isOut = rawAmount < 0 || /debit|debito|débito|out|saida|saída|pagamento/.test(rawType);
  const postedAt =
    parseDateOnly(pick(raw, ["date", "posted_at", "data", "transaction_date"])) ??
    new Date().toISOString().slice(0, 10);
  return {
    externalId,
    postedAt,
    amount: Math.abs(rawAmount),
    direction: isOut ? "out" : "in",
    description:
      (pick(raw, ["description", "descricao", "history", "historico"]) as string | undefined) ??
      null,
    counterparty:
      (pickDeep(raw, ["counterparty", "person.name", "cliente.nome"]) as string | undefined) ?? null,
    bankAccountExternalId:
      (pickDeep(raw, ["bank_account.id", "bank_account_id", "conta_id"]) as string | undefined) ??
      null,
    balanceAfter: parseBrNumber(pick(raw, ["balance", "saldo", "balance_after"])),
    raw,
  };
}

/* -------------------------------------------------------------------------- */
/* Importação por arquivo (CSV/planilha exportada do Conta Azul)              */
/* -------------------------------------------------------------------------- */

/** Detecta o separador mais provável (`;` no padrão brasileiro). */
export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length) ?? "";
  const counts: Array<[string, number]> = [
    [";", (firstLine.match(/;/g) ?? []).length],
    [",", (firstLine.match(/,/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ";";
}

/** Parser CSV tolerante a campos entre aspas e quebras de linha internas. */
export function parseDelimited(
  text: string,
  delimiter?: string,
): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "");
  const delim = delimiter ?? detectDelimiter(clean);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delim) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((c) => c.length)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field.trim());
  if (row.some((c) => c.length)) rows.push(row);

  const headers = rows.shift() ?? [];
  return { headers, rows };
}

export type FileField =
  | "external_id"
  | "description"
  | "amount"
  | "paid_amount"
  | "due_date"
  | "competence_date"
  | "status"
  | "category"
  | "cost_center"
  | "counterparty_name"
  | "counterparty_doc"
  | "payment_method";

export const FILE_FIELD_LABELS: Record<FileField, string> = {
  external_id: "Identificador de origem",
  description: "Descrição",
  amount: "Valor",
  paid_amount: "Valor pago",
  due_date: "Vencimento",
  competence_date: "Competência",
  status: "Situação",
  category: "Categoria",
  cost_center: "Centro de custo",
  counterparty_name: "Cliente/Fornecedor",
  counterparty_doc: "CNPJ/CPF",
  payment_method: "Forma de pagamento",
};

export const REQUIRED_FILE_FIELDS: FileField[] = ["description", "amount", "due_date"];

const HEADER_HINTS: Record<FileField, RegExp> = {
  external_id: /(id|codigo|código|documento n|nº doc)/i,
  description: /(descri|hist[oó]rico|observa|memo)/i,
  amount: /(valor(?! pago)|total|montante)/i,
  paid_amount: /(valor pago|pago|liquidado|baixa)/i,
  due_date: /(vencimento|due)/i,
  competence_date: /(compet|emiss|lan[çc]amento)/i,
  status: /(situa|status)/i,
  category: /(categoria|plano de contas)/i,
  cost_center: /(centro de custo|centro_custo)/i,
  counterparty_name: /(cliente|fornecedor|raz[ãa]o social|nome)/i,
  counterparty_doc: /(cnpj|cpf|documento)/i,
  payment_method: /(forma de pagamento|meio de pagamento|pagamento)/i,
};

/** Sugere o mapeamento coluna → campo interno a partir dos títulos do arquivo. */
export function suggestMapping(headers: string[]): Partial<Record<FileField, number>> {
  const out: Partial<Record<FileField, number>> = {};
  const used = new Set<number>();
  (Object.keys(HEADER_HINTS) as FileField[]).forEach((field) => {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && h.trim().length > 0 && HEADER_HINTS[field].test(h),
    );
    if (idx >= 0) {
      out[field] = idx;
      used.add(idx);
    }
  });
  return out;
}

export type FileRowResult =
  | { ok: true; entry: NormalizedEntry }
  | { ok: false; line: number; errors: string[] };

/** Valida e converte uma linha do arquivo em lançamento normalizado. */
export function fileRowToEntry(
  cells: string[],
  mapping: Partial<Record<FileField, number>>,
  direction: "receivable" | "payable",
  line: number,
  today?: string,
): FileRowResult {
  const get = (field: FileField): string => {
    const idx = mapping[field];
    if (idx === undefined) return "";
    return cells[idx] ?? "";
  };

  const errors: string[] = [];
  const description = get("description").slice(0, 500);
  if (!description) errors.push("Descrição vazia");
  const amount = parseBrNumber(get("amount"));
  if (amount === null || amount === 0) errors.push("Valor inválido");
  const dueDate = parseDateOnly(get("due_date"));
  if (!dueDate) errors.push("Vencimento inválido");
  if (errors.length) return { ok: false, line, errors };

  const paidAmount = Math.abs(parseBrNumber(get("paid_amount")) ?? 0);
  const competenceDate = parseDateOnly(get("competence_date")) ?? dueDate!;
  const externalId = get("external_id") || `linha-${line}-${dueDate}-${Math.abs(amount!)}`;

  return {
    ok: true,
    entry: {
      externalId,
      externalRef: `contaazul:arquivo:${direction}:${externalId}`,
      direction,
      description,
      amount: Math.abs(amount!),
      paidAmount,
      dueDate: dueDate!,
      competenceDate,
      status: mapEntryStatus(get("status"), {
        amount: Math.abs(amount!),
        paid: paidAmount,
        dueDate: dueDate!,
        today,
      }),
      installmentNumber: null,
      installmentTotal: null,
      categoryExternalId: null,
      costCenterExternalId: null,
      counterpartyName: get("counterparty_name") || null,
      counterpartyDoc: normalizeDoc(get("counterparty_doc")),
      paymentMethod: get("payment_method") || null,
      raw: { source: "file", line, categoria: get("category"), centro_custo: get("cost_center") },
    },
  };
}
