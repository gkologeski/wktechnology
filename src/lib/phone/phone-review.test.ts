import { describe, expect, it } from "vitest";
import {
  phoneEntityName,
  phoneEntityRoute,
  phoneReviewDetail,
  reconcilePhoneRuns,
  summarizePhoneRun,
  withLivePending,
} from "./phone-review";

describe("phoneEntityName", () => {
  it("usa nome e sobrenome de contato/lead", () => {
    expect(phoneEntityName({ first_name: "Paulo", last_name: "Fontes", email: "p@x.com" })).toBe(
      "Paulo Fontes",
    );
  });
  it("usa o nome da empresa", () => {
    expect(phoneEntityName({ name: "WK Technology" })).toBe("WK Technology");
  });
  it("cai para o e-mail quando não há nome", () => {
    expect(phoneEntityName({ first_name: " ", last_name: null, email: "a@b.com" })).toBe("a@b.com");
  });
  it("retorna nulo sem nome nem e-mail", () => {
    expect(phoneEntityName({ full_name: "" })).toBeNull();
  });
});

describe("phoneEntityRoute", () => {
  it("abre a ficha de contato, lead, empresa, pessoa e candidato", () => {
    expect(phoneEntityRoute("contacts")).toBe("/contacts/$id");
    expect(phoneEntityRoute("leads")).toBe("/leads/$id");
    expect(phoneEntityRoute("companies")).toBe("/companies/$id");
    expect(phoneEntityRoute("people")).toBe("/people/$id");
    expect(phoneEntityRoute("ats_candidates")).toBe("/candidates/$id");
  });
  it("não cria link para tabelas sem ficha", () => {
    expect(phoneEntityRoute("profiles")).toBeNull();
    expect(phoneEntityRoute("bookings")).toBeNull();
  });
});

describe("summarizePhoneRun com correções posteriores", () => {
  it("tira da revisão o que foi apagado (até 4 dígitos) e soma o que foi padronizado depois", () => {
    const s = summarizePhoneRun(
      { "contacts.mobile_phone": { too_short: 10, invalid: 5, safe_explicit: 3 } },
      { "contacts.mobile_phone": 3 },
      { "contacts.mobile_phone": { blank_short: 9, safe_record_country: 2 } },
    );
    expect(s.rows[0]).toMatchObject({ blanked: 9, applied: 5, pending: 4 });
    expect(s.pending).toBe(4);
  });
});

describe("phoneReviewDetail", () => {
  it("celular antigo sem 9: candidato mascarado, sem o número inteiro", () => {
    const d = phoneReviewDetail("(51) 9301-6927");
    expect(d).toMatch(/sem o 9º dígito/);
    expect(d).not.toContain("93016927");
  });
  it("sem país: leitura como Brasil é só hipótese", () => {
    expect(phoneReviewDetail("11 3333-4444")).toMatch(/hipótese/);
  });
  it("valor válido não tem detalhe", () => {
    expect(phoneReviewDetail("+551133334444")).toBeNull();
  });
});

describe("reconciliação entre duas execuções", () => {
  const base = {
    id: "base",
    parent_run_id: null,
    status: "done",
    created_at: "2026-10-22T19:35:00Z",
    finished_at: "2026-10-22T19:57:00Z",
    counts: {
      "contacts.mobile_phone": { too_short: 10, invalid: 4, safe_explicit: 6 },
      "companies.phone": { invalid: 3 },
      applied: { "contacts.mobile_phone": 6 },
    },
  };
  // Segunda execução, MAIS RECENTE e parcial: só correções (0 pendentes próprias).
  const child = {
    id: "child",
    parent_run_id: "base",
    status: "done",
    created_at: "2026-10-23T01:20:00Z",
    finished_at: "2026-10-23T01:37:00Z",
    counts: {
      "contacts.mobile_phone": { blank_short: 10 },
      applied: { "contacts.mobile_phone": 10 },
      resolved: { "contacts.mobile_phone": { blank_short: 10 } },
    },
  };

  it("usa a varredura como base, não a correção mais recente", () => {
    const r = reconcilePhoneRuns([child, base]);
    expect(r?.base.id).toBe("base");
    expect(r?.childIds).toEqual(["child"]);
    expect(r?.counts).not.toHaveProperty("applied");
  });

  it("pendência antiga restante continua visível; resolvidos não reaparecem", () => {
    const r = reconcilePhoneRuns([child, base])!;
    const s = summarizePhoneRun(r.counts, r.applied, r.resolved);
    const mobile = s.rows.find((x) => x.field === "contacts.mobile_phone")!;
    expect(mobile).toMatchObject({ blanked: 10, pending: 4, applied: 6 });
    expect(s.pending).toBe(7); // 4 inválidos de celular + 3 de empresa
  });

  it("contagem real do banco prevalece sobre a diferença calculada", () => {
    const r = reconcilePhoneRuns([child, base])!;
    const s = withLivePending(summarizePhoneRun(r.counts, r.applied, r.resolved), {
      "contacts.mobile_phone": 5,
      "companies.phone": 3,
    });
    expect(s.pending).toBe(8);
    expect(withLivePending(s, null).pending).toBe(8);
  });

  it("correção não concluída não abate pendências", () => {
    const r = reconcilePhoneRuns([{ ...child, status: "running" }, base])!;
    const s = summarizePhoneRun(r.counts, r.applied, r.resolved);
    expect(s.pending).toBe(17);
  });

  it("sem varredura não há base", () => {
    expect(reconcilePhoneRuns([child])).toBeNull();
  });
});

describe("resumo com revisão manual", () => {
  it("confirmado conta como padronizado; mantido/apagado só saem da revisão", () => {
    const s = summarizePhoneRun(
      { "contacts.phone": { invalid: 10 } },
      {},
      { "contacts.phone": { manual_confirmed: 3, manual_kept: 2, manual_cleared: 1 } },
    );
    expect(s.rows[0]).toMatchObject({ applied: 3, blanked: 0, pending: 4 });
  });
});
