import { describe, expect, it } from "vitest";
import {
  QUOTE_PAYMENT_TERMS_MISSING,
  saveQuotePaymentTermsCore,
  type QuotePaymentStore,
} from "./quote-payment-terms.write";
import type { PaymentTerms } from "./payment-terms";

const TERMS: PaymentTerms = {
  downPayment: { kind: "percent", value: 30 },
  plan: { kind: "periodic", count: 3, intervalMonths: 1, dueDay: 10 },
};

function store(opts: {
  total?: number | null;
  readError?: string;
  writeError?: string;
}): QuotePaymentStore & { written: PaymentTerms | null } {
  const state = { written: null as PaymentTerms | null };
  return {
    written: null,
    async readTotal() {
      if (opts.readError) throw new Error(opts.readError);
      return opts.total === undefined ? null : opts.total;
    },
    async writeTerms(_id, terms) {
      if (opts.writeError) throw new Error(opts.writeError);
      state.written = terms;
    },
  };
}

describe("condições de pagamento da cotação", () => {
  it("quote payment terms allows authorized active member", async () => {
    const s = store({ total: 100000 });
    expect(await saveQuotePaymentTermsCore(s, "q-1", TERMS)).toEqual({ ok: true });
    expect(s.written).toEqual(TERMS);
  });

  it("quote payment terms refuses missing permission", async () => {
    const s = store({ readError: "Sem permissão para editar esta cotação." });
    await expect(saveQuotePaymentTermsCore(s, "q-1", TERMS)).rejects.toThrow("Sem permissão");
    expect(s.written).toBeNull();
  });

  it("quote payment terms refuses an explicit deny", async () => {
    const s = store({ total: 100000, writeError: "Acesso negado para esta cotação." });
    await expect(saveQuotePaymentTermsCore(s, "q-1", TERMS)).rejects.toThrow("Acesso negado");
    expect(s.written).toBeNull();
  });

  it("quote payment terms refuses a foreign workspace quote", async () => {
    const s = store({ total: null });
    await expect(saveQuotePaymentTermsCore(s, "q-1", TERMS)).rejects.toThrow(
      QUOTE_PAYMENT_TERMS_MISSING,
    );
    expect(s.written).toBeNull();
  });

  it("quote payment terms refuses an inactive member", async () => {
    const s = store({ readError: "Você não faz mais parte desta empresa." });
    await expect(saveQuotePaymentTermsCore(s, "q-1", TERMS)).rejects.toThrow(
      "Você não faz mais parte desta empresa.",
    );
    expect(s.written).toBeNull();
  });

  it("quote payment terms refuses numbers that do not close", async () => {
    const s = store({ total: 100000 });
    const bad: PaymentTerms = {
      downPayment: { kind: "none" },
      plan: { kind: "milestones", milestones: [{ label: "Entrega", percent: 60 }] },
    };
    await expect(saveQuotePaymentTermsCore(s, "q-1", bad)).rejects.toThrow("somar 100%");
    expect(s.written).toBeNull();
  });
});
