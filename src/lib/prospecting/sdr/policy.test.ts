import { describe, expect, it } from "vitest";
import {
  detectOptOut,
  meetingStatus,
  nextFollowUpAt,
  nextStage,
  parseOptOutPhrases,
  selectableMaterials,
  selectableOffers,
  sendGuard,
  turnIdemKey,
  validateAgentOutput,
  PRICE_WARNING,
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
  it("só ativas e aprovadas; o catálogo do workspace é a única fonte (sem nomes fixos)", () => {
    const r = selectableOffers([
      offer("Outsourcing de TI"),
      offer("BPO Administrativo", { status: "inactive" }),
      offer("Rascunho", { approved_at: null }),
      offer("WK Sob Medida"),
    ]);
    expect(r.map((o) => o.name)).toEqual(["Outsourcing de TI", "WK Sob Medida"]);
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
  it("detecta pedido explícito de não receber contato", () => {
    expect(detectOptOut("PARE")).toBe(true);
    expect(detectOptOut("Sair")).toBe(true);
    expect(detectOptOut("pare de me mandar mensagem")).toBe(true);
    expect(detectOptOut("não me mande mais mensagens")).toBe(true);
    expect(detectOptOut("remova meu número da lista")).toBe(true);
    expect(detectOptOut("Não quero mais receber mensagens de vocês")).toBe(true);
    expect(detectOptOut("por favor não entre mais em contato")).toBe(true);
    expect(detectOptOut("quero me descadastrar")).toBe(true);
  });
  it("recusa comercial não é descadastro permanente", () => {
    expect(detectOptOut("Pode parecer estranho, mas quero saber mais")).toBe(false);
    expect(detectOptOut("Não quero reunião, pode mandar o orçamento por aqui")).toBe(false);
    expect(detectOptOut("não quero")).toBe(false);
    expect(detectOptOut("Não tenho interesse, obrigado")).toBe(false);
    expect(detectOptOut("Não queremos receber proposta agora")).toBe(false);
    expect(detectOptOut("vou sair para almoçar e te respondo")).toBe(false);
    expect(detectOptOut("precisamos remover o sistema legado")).toBe(false);
    expect(detectOptOut("pode cancelar a reunião de sexta?")).toBe(false);
  });
  it("frases configuradas: palavra única só como mensagem inteira", () => {
    expect(detectOptOut("remover", ["remover"])).toBe(true);
    expect(detectOptOut("Remover, por favor", ["remover"])).toBe(true);
    expect(detectOptOut("vamos remover o gargalo", ["remover"])).toBe(false);
    expect(detectOptOut("não quero ser incomodado", ["ser incomodado"])).toBe(true);
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
  it("sinaliza preço só quando o controle no_pricing está ligado", () => {
    const r = validateAgentOutput({ reply: "Custa R$ 5.000", intent: "continue" }, ctx);
    expect("warnings" in r && r.warnings).toContain(PRICE_WARNING);
    const off = validateAgentOutput(
      { reply: "Custa R$ 5.000", intent: "continue" },
      { ...ctx, noPricing: false },
    );
    expect("warnings" in off && off.warnings).not.toContain(PRICE_WARNING);
  });
  it("sem lista de ofertas proibidas no código: o catálogo ativo é a fonte", () => {
    const r = validateAgentOutput({ reply: "Temos o WK Sob Medida", intent: "continue" }, ctx);
    expect(r).not.toHaveProperty("error");
  });
  it("resposta vazia só com supressão estruturada, descadastro ou transferência", () => {
    expect(validateAgentOutput({ reply: "", intent: "continue" }, ctx)).toHaveProperty("error");
    const ok = validateAgentOutput(
      { reply: "", intent: "continue", situation: { suppress_reply: "auto_responder" } },
      ctx,
    );
    expect(ok).not.toHaveProperty("error");
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

import { isCourtesyOnly as _c } from "./policy";
describe("cortesia não é recusa", () => {
  it("agradecimento com o nome configurado do agente é só cortesia", () => {
    expect(_c("Obrigado Lia", ["Lia"])).toBe(true);
    expect(_c("valeu, até sexta!")).toBe(true);
    expect(_c("não tenho interesse")).toBe(false);
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

describe("frases de saída da Configuração do agente", () => {
  it("separa por vírgula ou linha, apara e mantém a ordem", () => {
    expect(parseOptOutPhrases(" pare, sair \n não quero mais ")).toEqual([
      "pare",
      "sair",
      "não quero mais",
    ]);
  });
  it("descarta vazias e repetidas sem diferenciar maiúsculas", () => {
    expect(parseOptOutPhrases("Pare,, pare ,STOP,stop,")).toEqual(["Pare", "STOP"]);
  });
  it("texto vazio vira lista vazia", () => {
    expect(parseOptOutPhrases("  ,  ")).toEqual([]);
  });
  it("limita a 50 frases de até 80 caracteres", () => {
    const many = Array.from({ length: 60 }, (_, i) => `frase ${i}`).join(",");
    expect(parseOptOutPhrases(many)).toHaveLength(50);
    expect(parseOptOutPhrases("x".repeat(100))[0]).toHaveLength(80);
  });
});
