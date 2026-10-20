import { describe, expect, it } from "vitest";
import {
  detectOptOut,
  meetingStatus,
  nextFollowUpAt,
  nextStage,
  selectableMaterials,
  selectableOffers,
  sendGuard,
  turnIdemKey,
  validateAgentOutput,
} from "./policy";

const offer = (
  name: string,
  extra: Partial<{ status: "active" | "inactive"; approved_at: string | null }> = {},
) => ({
  name,
  status: "active" as const,
  approved_at: "2026-01-01",
  ...extra,
});

describe("catálogo", () => {
  it("só ativas, aprovadas e nunca WK Sob Medida", () => {
    const r = selectableOffers([
      offer("Outsourcing de TI"),
      offer("BPO Administrativo", { status: "inactive" }),
      offer("Rascunho", { approved_at: null }),
      offer("WK Sob Medida"),
    ]);
    expect(r.map((o) => o.name)).toEqual(["Outsourcing de TI"]);
  });
  it("material N:N atende qualquer oferta vinculada", () => {
    const m = {
      id: "m1",
      title: "Deck",
      approved: true,
      active: true,
      url: "https://x",
      offer_ids: ["a", "b"],
    };
    expect(selectableMaterials([m], ["b"])).toHaveLength(1);
    expect(selectableMaterials([m], ["c"])).toHaveLength(0);
    expect(selectableMaterials([{ ...m, approved: false }])).toHaveLength(0);
  });
});

describe("idempotência e isolamento", () => {
  it("webhook repetido gera a mesma chave; workspaces/números distintos não colidem", () => {
    const a = turnIdemKey({ workspaceId: "w1", providerPhoneId: "p1", waMessageId: "wamid.1" });
    expect(turnIdemKey({ workspaceId: "w1", providerPhoneId: "p1", waMessageId: "wamid.1" })).toBe(
      a,
    );
    expect(
      turnIdemKey({ workspaceId: "w2", providerPhoneId: "p1", waMessageId: "wamid.1" }),
    ).not.toBe(a);
    expect(
      turnIdemKey({ workspaceId: "w1", providerPhoneId: "p2", waMessageId: "wamid.1" }),
    ).not.toBe(a);
  });
});

describe("takeover durante execução", () => {
  const base = {
    job: { status: "running", lease_token: "t", conversation_version: 3 },
    leaseToken: "t",
    conversation: { ai_owner: "ai", ai_version: 3 },
    enrollment: { status: "active" },
  };
  it("envia quando nada mudou", () => expect(sendGuard(base)).toEqual({ ok: true }));
  it("descarta se humano assumiu", () =>
    expect(
      sendGuard({ ...base, conversation: { ai_owner: "human", ai_version: 4 } }),
    ).toMatchObject({ ok: false, reason: "owner_not_ai" }));
  it("descarta versão obsoleta (resposta fora de ordem)", () =>
    expect(sendGuard({ ...base, conversation: { ai_owner: "ai", ai_version: 4 } })).toMatchObject({
      reason: "stale_version",
    }));
  it("descarta se o lease foi perdido (execução concorrente)", () =>
    expect(sendGuard({ ...base, leaseToken: "outro" })).toMatchObject({ reason: "lease_lost" }));
  it("descarta se a prospecção foi encerrada", () =>
    expect(sendGuard({ ...base, enrollment: { status: "opted_out" } })).toMatchObject({
      reason: "enrollment_inactive",
    }));
});

describe("opt-out", () => {
  it("detecta recusa explícita sem falso positivo", () => {
    expect(detectOptOut("Não tenho interesse, obrigado")).toBe(true);
    expect(detectOptOut("PARE")).toBe(true);
    expect(detectOptOut("Pode parecer estranho, mas quero saber mais")).toBe(false);
  });
  it("recusa encerra e não cria oportunidade nem follow-up", () => {
    expect(nextStage("discovery", "opt_out", true)).toBe("opted_out");
    expect(
      nextFollowUpAt({ now: new Date(), hours: 24, count: 0, max: 2, stage: "opted_out" }),
    ).toBeNull();
  });
});

describe("saída da IA", () => {
  const ctx = {
    offers: [{ offer_key: "outsourcing", name: "Outsourcing" }],
    materials: [{ id: "m1" }],
  };
  it("descarta ofertas/materiais não autorizados e ignora score autodeclarado", () => {
    const r = validateAgentOutput(
      {
        reply: "Entendi!",
        intent: "continue",
        offer_keys: ["outsourcing", "inventada"],
        material_ids: ["m1", "mX"],
        answers: [{ question_id: "q1", value: "Sim", message_id: "m", excerpt: "x" }],
        score: 150,
        handoff_reason: "",
      },
      ctx,
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.offer_keys).toEqual(["outsourcing"]);
    expect(r.material_ids).toEqual(["m1"]);
    expect(r).not.toHaveProperty("score");
    expect(r.answers).toHaveLength(1);
  });
  it("bloqueia oferta inexistente e sinaliza preço", () => {
    expect(
      validateAgentOutput({ reply: "Temos o WK Sob Medida", intent: "continue" }, ctx),
    ).toHaveProperty("error");
    const r = validateAgentOutput({ reply: "Custa R$ 5.000", intent: "continue" }, ctx);
    expect("warnings" in r && r.warnings.length).toBeTruthy();
  });
});

describe("reunião", () => {
  it("só confirma com evento do Google", () => {
    expect(
      meetingStatus({ status: "confirmed", gcal_event_id: null, calendar_sync_error: null }),
    ).toBe("pending_sync");
    expect(
      meetingStatus({ status: "confirmed", gcal_event_id: null, calendar_sync_error: "401" }),
    ).toBe("sync_failed");
    expect(
      meetingStatus({ status: "confirmed", gcal_event_id: "ev1", calendar_sync_error: null }),
    ).toBe("confirmed");
  });
});

import { guardModelOptOut as _g, isCourtesyOnly as _c } from "./policy";
describe("falso opt-out por agradecimento", () => {
  it("'Obrigado Lia' não descadastra", () => {
    expect(_c("Obrigado Lia")).toBe(true);
    expect(_g("Obrigado Lia")).toBe(false);
    expect(_g("valeu, até sexta!")).toBe(false);
  });
  it("pedido real continua descadastrando", () => {
    expect(_g("não tenho interesse")).toBe(true);
    expect(_g("pare de me mandar mensagem")).toBe(true);
  });
});

import { isWrongContact } from "./policy";
describe("isWrongContact", () => {
  it("detecta pessoa errada", () => {
    expect(isWrongContact("Oi. Não conheço ninguém com esse nome")).toBe(true);
    expect(isWrongContact("número errado")).toBe(true);
  });
  it("não encerra quando a pessoa cuida da área", () => {
    expect(isWrongContact("Não sou o Thobias, mas cuido dessa área")).toBe(false);
    expect(isWrongContact("Tenho um projeto parado")).toBe(false);
  });
  it("respostas comerciais comuns não são contato errado", () => {
    expect(isWrongContact("Não é o momento")).toBe(false);
    expect(isWrongContact("não é a minha área")).toBe(false);
    expect(isWrongContact("Não é a terça, prefiro quarta")).toBe(false);
    expect(isWrongContact("Acho que me enganei no horário")).toBe(false);
    expect(isWrongContact("Mensagem enviada por engano")).toBe(true);
    expect(isWrongContact("Não sou ele")).toBe(true);
  });
});

import { selectableMaterials as pickMaterials } from "./policy";
describe("materiais em arquivo", () => {
  it("arquivo aprovado sem link é selecionável", () => {
    const r = pickMaterials([
      {
        id: "f",
        title: "PDF",
        approved: true,
        active: true,
        url: null,
        storage_path: "ws/x.pdf",
        offer_ids: [],
      },
      { id: "v", title: "Vazio", approved: true, active: true, url: null, offer_ids: [] },
    ]);
    expect(r.map((m) => m.id)).toEqual(["f"]);
  });
});
