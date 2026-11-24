/**
 * CONDICOES-PAGAMENTO — regra pura do cronograma de pagamento.
 * Sem I/O: recebe condições + total e devolve as parcelas previstas.
 * Usada por cotação, proposta, contrato e (na ativação do serviço) contas a receber.
 */

import { z } from "zod";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type DownPayment =
  | { kind: "none" }
  | { kind: "amount"; value: number }
  | { kind: "percent"; value: number };

export type InstallmentPlan =
  | { kind: "none" }
  | { kind: "monthly"; months: number; dueDay: number }
  | { kind: "periodic"; count: number; intervalMonths: number; dueDay: number }
  | { kind: "milestones"; milestones: { label: string; percent: number }[] }
  /** SALDO-DATA-FIXA: saldo inteiro em uma única parcela, numa data escolhida. */
  | { kind: "fixed_date"; date: string };

/** Vencimento da entrada: data fixa ou na assinatura do contrato (padrão). */
export type DownPaymentDue = { kind: "signature" } | { kind: "date"; date: string };

/** PRAZO-MENSAL: prazo mínimo, aviso prévio e renovação após o mínimo. */
export interface ContractTerm {
  minimumMonths: number;
  noticeDays: number;
  autoRenew: boolean;
}

/** Padrão comercial da WK: 3 meses de prazo mínimo e 30 dias de aviso prévio. */
export const DEFAULT_CONTRACT_TERM: ContractTerm = {
  minimumMonths: 3,
  noticeDays: 30,
  autoRenew: true,
};
export const CONTRACT_TERM_MONTH_SHORTCUTS = [3, 6, 12, 24] as const;

export interface PaymentTerms {
  downPayment: DownPayment;
  plan: InstallmentPlan;
  downPaymentDue?: DownPaymentDue;
  /** Prazo do contrato (serviços recorrentes). */
  term?: ContractTerm;
  /** Valor de cada mensalidade quando o serviço é recorrente; total = mensalidade × meses. */
  monthlyAmount?: number;
}

/** Total de um serviço recorrente: mensalidade cheia × meses do prazo. */
export function recurringTotal(monthly: number, months: number): number {
  return round2(Math.max(0, monthly) * Math.max(0, Math.trunc(months)));
}

/** Resumo do prazo em português para proposta, contrato e revisão. */
export function describeContractTerm(t: ContractTerm): string {
  const m = `${t.minimumMonths} ${t.minimumMonths === 1 ? "mês" : "meses"}`;
  const renew = t.autoRenew
    ? "renovação automática mês a mês após o prazo mínimo"
    : "término ao final do prazo";
  return `Prazo mínimo de ${m}, aviso prévio de ${t.noticeDays} dias, ${renew}`;
}

export interface ScheduledPayment {
  sequence: number;
  label: string;
  amount: number;
  /** ISO yyyy-mm-dd; null quando depende de marco/entrega ou da assinatura. */
  dueDate: string | null;
  /** Evento que define o vencimento quando não há data. */
  dueEvent?: "signature" | "milestone";
}

/** Assinatura é o padrão quando o vencimento da entrada não foi escolhido. */
export function downPaymentDueOf(t: PaymentTerms): DownPaymentDue {
  return t.downPaymentDue ?? { kind: "signature" };
}

function dateFor(start: Date, monthsAhead: number, dueDay: number): string {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + monthsAhead;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(y, m, Math.min(Math.max(dueDay, 1), last)));
  return d.toISOString().slice(0, 10);
}

/** Divide um valor em n partes; centavos de sobra vão para a última. */
function split(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const parts = new Array<number>(n).fill(base);
  parts[n - 1] = round2(total - base * (n - 1));
  return parts;
}

/** Indica se a entrada cobre integralmente o total (sem saldo restante). */
export function coversFullTotal(dp: DownPayment, total: number): boolean {
  if (dp.kind === "percent") return round2(dp.value) === 100;
  if (dp.kind === "amount") return total > 0 && round2(dp.value) === round2(total);
  return false;
}

/** Normaliza condições quando a entrada cobre 100%: remove plano de saldo e prazo recorrente. */
export function normalizePaymentTerms(t: PaymentTerms, total: number): PaymentTerms {
  if (!coversFullTotal(t.downPayment, total)) return t;
  return {
    downPayment: t.downPayment,
    plan: { kind: "none" },
    ...(t.downPaymentDue ? { downPaymentDue: t.downPaymentDue } : {}),
  };
}

export const FULL_DOWN_PAYMENT_BALANCE_ERROR =
  "Quando a entrada cobre 100% do total, não pode haver saldo configurado.";

export function validatePaymentTerms(t: PaymentTerms, total: number): string[] {
  const errors: string[] = [];
  if (!(total >= 0)) errors.push("Total inválido.");
  const dp = t.downPayment;
  if (dp.kind === "amount" && (dp.value < 0 || dp.value > total))
    errors.push("A entrada deve estar entre R$ 0 e o total.");
  if (dp.kind === "percent" && (dp.value < 0 || dp.value > 100))
    errors.push("A entrada deve estar entre 0% e 100%.");
  const due = t.downPaymentDue;
  if (dp.kind !== "none" && due?.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(due.date))
    errors.push("Escolha a data de vencimento da entrada.");
  const p = t.plan;
  const fullDownPayment = coversFullTotal(dp, total);
  if (fullDownPayment) {
    if (p.kind !== "none") errors.push(FULL_DOWN_PAYMENT_BALANCE_ERROR);
    return errors;
  }
  if (p.kind === "none") {
    errors.push("Informe como o saldo será pago.");
    return errors;
  }
  if (p.kind === "monthly" && !(p.months >= 1 && p.months <= 120))
    errors.push("Meses devem estar entre 1 e 120.");
  if (t.term) {
    if (!(t.term.minimumMonths >= 1 && t.term.minimumMonths <= 120))
      errors.push("O prazo mínimo deve estar entre 1 e 120 meses.");
    if (!(t.term.noticeDays >= 0 && t.term.noticeDays <= 365))
      errors.push("O aviso prévio deve estar entre 0 e 365 dias.");
  }
  if (p.kind === "periodic") {
    if (!(p.count >= 1 && p.count <= 120)) errors.push("Parcelas devem estar entre 1 e 120.");
    if (!(p.intervalMonths >= 1 && p.intervalMonths <= 12))
      errors.push("Intervalo deve estar entre 1 e 12 meses.");
  }
  if ((p.kind === "monthly" || p.kind === "periodic") && !(p.dueDay >= 1 && p.dueDay <= 31))
    errors.push("Dia de vencimento deve estar entre 1 e 31.");
  if (p.kind === "fixed_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) errors.push("Escolha a data de vencimento do saldo.");
    else if (
      dp.kind !== "none" &&
      due?.kind === "date" &&
      /^\d{4}-\d{2}-\d{2}$/.test(due.date) &&
      p.date < due.date
    )
      errors.push("O saldo não pode vencer antes da entrada.");
  }
  if (p.kind === "milestones") {
    if (p.milestones.length === 0) errors.push("Informe ao menos um marco.");
    const sum = round2(p.milestones.reduce((s, m) => s + m.percent, 0));
    if (sum !== 100) errors.push("Os marcos devem somar 100% do saldo.");
    if (p.milestones.some((m) => !m.label.trim())) errors.push("Todo marco precisa de nome.");
  }
  return errors;
}

export function downPaymentAmount(dp: DownPayment, total: number): number {
  if (dp.kind === "amount") return round2(dp.value);
  if (dp.kind === "percent") return round2((total * dp.value) / 100);
  return 0;
}

export function buildPaymentSchedule(
  t: PaymentTerms,
  total: number,
  start: Date,
  opts: { signedAt?: string | null } = {},
): ScheduledPayment[] {
  const errors = validatePaymentTerms(t, total);
  if (errors.length) throw new Error(errors.join(" "));
  const out: ScheduledPayment[] = [];
  const entry = downPaymentAmount(t.downPayment, total);
  if (entry > 0) {
    const due = downPaymentDueOf(t);
    out.push(
      due.kind === "date"
        ? { sequence: 1, label: "Entrada", amount: entry, dueDate: due.date }
        : {
            sequence: 1,
            label: "Entrada",
            amount: entry,
            dueDate: opts.signedAt ? opts.signedAt.slice(0, 10) : null,
            dueEvent: "signature",
          },
    );
  }
  const balance = round2(total - entry);
  if (balance <= 0) return out;
  const p = t.plan;
  const offset = entry > 0 ? 1 : 0;
  if (p.kind === "monthly" || p.kind === "periodic") {
    const n = p.kind === "monthly" ? p.months : p.count;
    const step = p.kind === "monthly" ? 1 : p.intervalMonths;
    split(balance, n).forEach((amount, i) =>
      out.push({
        sequence: out.length + 1,
        label: p.kind === "monthly" ? `Mensalidade ${i + 1}/${n}` : `Parcela ${i + 1}/${n}`,
        amount,
        dueDate: dateFor(start, offset + i * step, p.dueDay),
      }),
    );
  } else if (p.kind === "fixed_date") {
    out.push({ sequence: out.length + 1, label: "Saldo", amount: balance, dueDate: p.date });
  } else if (p.kind === "milestones") {
    let acc = 0;
    p.milestones.forEach((m, i) => {
      const last = i === p.milestones.length - 1;
      const amount = last ? round2(balance - acc) : round2((balance * m.percent) / 100);
      acc = round2(acc + amount);
      out.push({
        sequence: out.length + 1,
        label: m.label,
        amount,
        dueDate: null,
        dueEvent: "milestone",
      });
    });
  }
  return out;
}

/** Sugestão pelo tipo dos itens: outsourcing → mensal; consultoria/fábrica → entrada + marcos. */
export function suggestPaymentTerms(
  itemKinds: string[],
  legacy?: { installmentsCount?: number | null; dueDay?: number | null },
): PaymentTerms {
  if (legacy?.installmentsCount) {
    return {
      downPayment: { kind: "none" },
      plan: {
        kind: "periodic",
        count: legacy.installmentsCount,
        intervalMonths: 1,
        dueDay: legacy.dueDay ?? 10,
      },
    };
  }
  const k = itemKinds.map((s) => s.toLowerCase());
  if (k.some((s) => s.includes("outsourcing") || s.includes("alocação") || s.includes("alocacao")))
    return {
      downPayment: { kind: "none" },
      plan: { kind: "monthly", months: DEFAULT_CONTRACT_TERM.minimumMonths, dueDay: 10 },
      term: { ...DEFAULT_CONTRACT_TERM },
    };
  return {
    downPayment: { kind: "percent", value: 30 },
    plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
  };
}

// ============= Validação nas bordas (servidor e telas) =============
/**
 * Aceita rótulos de marco vazios: quem reclama é `validatePaymentTerms`, com a
 * mensagem em português. O schema só barra o que não é condição de pagamento.
 */
export const downPaymentSchema = z.union([
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("amount"), value: z.number().min(0) }),
  z.object({ kind: z.literal("percent"), value: z.number().min(0).max(100) }),
]);

export const installmentPlanSchema = z.union([
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("monthly"),
    months: z.number().int().min(1).max(120),
    dueDay: z.number().int().min(1).max(31),
  }),
  z.object({
    kind: z.literal("periodic"),
    count: z.number().int().min(1).max(120),
    intervalMonths: z.number().int().min(1).max(12),
    dueDay: z.number().int().min(1).max(31),
  }),
  z.object({ kind: z.literal("fixed_date"), date: z.string().max(10) }),
  z.object({
    kind: z.literal("milestones"),
    milestones: z
      .array(z.object({ label: z.string().max(120), percent: z.number().min(0).max(100) }))
      .min(1)
      .max(120),
  }),
]);

export const downPaymentDueSchema = z.union([
  z.object({ kind: z.literal("signature") }),
  z.object({ kind: z.literal("date"), date: z.string().max(10) }),
]);

export const contractTermSchema = z.object({
  minimumMonths: z.number().int().min(1).max(120),
  noticeDays: z.number().int().min(0).max(365),
  autoRenew: z.boolean(),
});

export const paymentTermsSchema = z
  .object({
    downPayment: downPaymentSchema,
    plan: installmentPlanSchema,
    downPaymentDue: downPaymentDueSchema.optional(),
    term: contractTermSchema.optional(),
    monthlyAmount: z.number().min(0).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.downPayment.kind === "percent" &&
      round2(val.downPayment.value) === 100 &&
      val.plan.kind !== "none"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plan"],
        message: FULL_DOWN_PAYMENT_BALANCE_ERROR,
      });
    }
  });

/** null quando o valor guardado não é uma condição de pagamento válida. */
export function parsePaymentTerms(raw: unknown): PaymentTerms | null {
  let candidate = raw;
  // Compatibilidade com registros antigos gravados com entrada 100% + saldo residual.
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const rec = candidate as Record<string, unknown>;
    const dp = rec["downPayment"] as Record<string, unknown> | undefined;
    const plan = rec["plan"] as Record<string, unknown> | undefined;
    if (
      dp &&
      dp["kind"] === "percent" &&
      typeof dp["value"] === "number" &&
      round2(dp["value"]) === 100 &&
      plan &&
      plan["kind"] !== "none"
    ) {
      const { term: _term, monthlyAmount: _monthly, ...rest } = rec;
      void _term;
      void _monthly;
      candidate = { ...rest, plan: { kind: "none" } };
    }
  }
  const parsed = paymentTermsSchema.safeParse(candidate);
  return parsed.success ? (parsed.data as PaymentTerms) : null;
}

/** Parcelas e dia de vencimento equivalentes, para modelos que ainda usam esses campos. */
export function legacyInstallments(
  t: PaymentTerms,
  total: number,
): {
  installments: number;
  dueDay: number | null;
} {
  const entry = downPaymentAmount(t.downPayment, total) > 0 ? 1 : 0;
  const p = t.plan;
  const rest =
    total - downPaymentAmount(t.downPayment, total) <= 0
      ? 0
      : p.kind === "none"
        ? 0
        : p.kind === "monthly"
          ? p.months
          : p.kind === "periodic"
            ? p.count
            : p.kind === "fixed_date"
              ? 1
              : p.milestones.length;
  return { installments: Math.max(1, entry + rest), dueDay: "dueDay" in p ? p.dueDay : null };
}

/** Resumo em uma linha, em português, para telas de revisão. */
export function describePaymentTerms(t: PaymentTerms): string {
  const dp = t.downPayment;
  const entry =
    dp.kind === "none"
      ? "sem entrada"
      : dp.kind === "percent"
        ? `entrada de ${dp.value}% do total`
        : `entrada de R$ ${dp.value.toFixed(2)}`;
  const due = downPaymentDueOf(t);
  const entryDue =
    dp.kind === "none"
      ? ""
      : due.kind === "date"
        ? ` (vence em ${due.date.split("-").reverse().join("/")})`
        : " (vence na assinatura do contrato)";
  const p = t.plan;
  const balance =
    p.kind === "none"
      ? "sem saldo"
      : p.kind === "monthly"
        ? `${p.months} mensalidades no dia ${p.dueDay}`
        : p.kind === "periodic"
          ? `${p.count} parcelas a cada ${p.intervalMonths} ${p.intervalMonths === 1 ? "mês" : "meses"}, dia ${p.dueDay}`
          : p.kind === "fixed_date"
            ? `saldo em parcela única em ${p.date.split("-").reverse().join("/")}`
            : `${p.milestones.length} ${p.milestones.length === 1 ? "marco" : "marcos"} de entrega`;
  const term = t.term ? ` · ${describeContractTerm(t.term)}` : "";
  return `${entry}${entryDue} · ${balance}${term}`;
}
