/**
 * CONDICOES-PAGAMENTO — regra pura do cronograma de pagamento.
 * Sem I/O: recebe condições + total e devolve as parcelas previstas.
 * Usada por cotação, proposta, contrato e (na ativação do serviço) contas a receber.
 */

export type DownPayment =
  | { kind: "none" }
  | { kind: "amount"; value: number }
  | { kind: "percent"; value: number };

export type InstallmentPlan =
  | { kind: "monthly"; months: number; dueDay: number }
  | { kind: "periodic"; count: number; intervalMonths: number; dueDay: number }
  | { kind: "milestones"; milestones: { label: string; percent: number }[] };

export interface PaymentTerms {
  downPayment: DownPayment;
  plan: InstallmentPlan;
}

export interface ScheduledPayment {
  sequence: number;
  label: string;
  amount: number;
  /** ISO yyyy-mm-dd; null quando depende de marco/entrega. */
  dueDate: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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

export function validatePaymentTerms(t: PaymentTerms, total: number): string[] {
  const errors: string[] = [];
  if (!(total >= 0)) errors.push("Total inválido.");
  const dp = t.downPayment;
  if (dp.kind === "amount" && (dp.value < 0 || dp.value > total))
    errors.push("A entrada deve estar entre R$ 0 e o total.");
  if (dp.kind === "percent" && (dp.value < 0 || dp.value > 100))
    errors.push("A entrada deve estar entre 0% e 100%.");
  const p = t.plan;
  if (p.kind === "monthly" && !(p.months >= 1 && p.months <= 120))
    errors.push("Meses devem estar entre 1 e 120.");
  if (p.kind === "periodic") {
    if (!(p.count >= 1 && p.count <= 120)) errors.push("Parcelas devem estar entre 1 e 120.");
    if (!(p.intervalMonths >= 1 && p.intervalMonths <= 12))
      errors.push("Intervalo deve estar entre 1 e 12 meses.");
  }
  if ((p.kind === "monthly" || p.kind === "periodic") && !(p.dueDay >= 1 && p.dueDay <= 31))
    errors.push("Dia de vencimento deve estar entre 1 e 31.");
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
): ScheduledPayment[] {
  const errors = validatePaymentTerms(t, total);
  if (errors.length) throw new Error(errors.join(" "));
  const out: ScheduledPayment[] = [];
  const entry = downPaymentAmount(t.downPayment, total);
  if (entry > 0)
    out.push({ sequence: 1, label: "Entrada", amount: entry, dueDate: start.toISOString().slice(0, 10) });
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
  } else {
    let acc = 0;
    p.milestones.forEach((m, i) => {
      const last = i === p.milestones.length - 1;
      const amount = last ? round2(balance - acc) : round2((balance * m.percent) / 100);
      acc = round2(acc + amount);
      out.push({ sequence: out.length + 1, label: m.label, amount, dueDate: null });
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
      plan: { kind: "periodic", count: legacy.installmentsCount, intervalMonths: 1, dueDay: legacy.dueDay ?? 10 },
    };
  }
  const k = itemKinds.map((s) => s.toLowerCase());
  if (k.some((s) => s.includes("outsourcing") || s.includes("alocação") || s.includes("alocacao")))
    return { downPayment: { kind: "none" }, plan: { kind: "monthly", months: 12, dueDay: 10 } };
  return {
    downPayment: { kind: "percent", value: 30 },
    plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
  };
}
