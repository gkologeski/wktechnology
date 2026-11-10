import { describe, expect, it } from "vitest";
import { activateServiceCore, type ServiceActivationStore } from "./activation-terms.write";

const TERMS = {
  downPayment: { kind: "percent", value: 30 },
  plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
};

type Calls = { terms: unknown[] | null; legacy: boolean };

function store(opts: {
  contract?: {
    payment_terms: unknown;
    total_value: number | null;
    signed_at: string | null;
  } | null;
  denyWith?: string;
}): ServiceActivationStore<string> & { calls: Calls } {
  const calls: Calls = { terms: null, legacy: false };
  return {
    calls,
    async readService() {
      return { contract_id: "c-1", starts_at: null };
    },
    async readContract() {
      return opts.contract === undefined
        ? { payment_terms: TERMS, total_value: 10000, signed_at: null }
        : opts.contract;
    },
    async activateWithTerms(_id, _start, schedule) {
      if (opts.denyWith) throw new Error(opts.denyWith);
      calls.terms = schedule;
      return "ok-terms";
    },
    async activateLegacy() {
      calls.legacy = true;
      return "ok-legacy";
    },
  };
}

describe("ativação do serviço com condições de pagamento", () => {
  it("service activation terms allows authorized active member", async () => {
    const s = store({});
    expect(await activateServiceCore(s, "s-1", null, "2026-11-10")).toBe("ok-terms");
    expect(s.calls.terms?.map((x) => (x as { amount: number }).amount)).toEqual([3000, 7000]);
    expect(s.calls.legacy).toBe(false);
  });

  it("service activation terms refuses missing permission", async () => {
    const s = store({ denyWith: "Sem permissão para gerar lançamentos financeiros." });
    await expect(activateServiceCore(s, "s-1", null, "2026-11-10")).rejects.toThrow(
      "Sem permissão",
    );
    expect(s.calls.legacy).toBe(false);
  });

  it("service activation terms refuses an explicit deny", async () => {
    const s = store({ denyWith: "Acesso negado." });
    await expect(activateServiceCore(s, "s-1", null, "2026-11-10")).rejects.toThrow(
      "Acesso negado",
    );
    expect(s.calls.legacy).toBe(false);
  });

  it("service activation terms refuses a foreign workspace contract", async () => {
    const s = store({ denyWith: "Contrato indisponível." });
    await expect(activateServiceCore(s, "s-1", null, "2026-11-10")).rejects.toThrow(
      "Contrato indisponível.",
    );
    expect(s.calls.terms).toBeNull();
    expect(s.calls.legacy).toBe(false);
  });

  it("service activation terms refuses an inactive member", async () => {
    const s = store({ denyWith: "Serviço indisponível." });
    await expect(activateServiceCore(s, "s-1", null, "2026-11-10")).rejects.toThrow(
      "Serviço indisponível.",
    );
    expect(s.calls.legacy).toBe(false);
  });

  it("contrato sem condições mantém a cobrança própria do serviço", async () => {
    const s = store({ contract: { payment_terms: {}, total_value: 10000, signed_at: null } });
    expect(await activateServiceCore(s, "s-1", null, "2026-11-10")).toBe("ok-legacy");
    expect(s.calls.terms).toBeNull();
  });
});
