// Pipeline REAL do turno (decideTurn) com saídas de modelo programadas e
// ferramentas falsas. Nenhuma IA paga, WhatsApp, Google ou banco real.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider-resolver.server", () => ({ aiChatFetch: vi.fn() }));

import { parseAgentConfig } from "./agent-config";
import { DEFAULT_SITUATION, type ConversationState, type Situation } from "./conversation-state";
import { buildOutgoingText } from "./outgoing";
import { parsePersona } from "./persona";
import { MATERIAL_CLAIM_WARNING, PRICE_WARNING, type ConversationMessage } from "./policy";
import { emptyEffects } from "./tools/dispatcher";
import { decideTurn, type TurnInput } from "./turn";

const PUBLISHED_INSTRUCTIONS =
  "Prefira 1 a 3 frases e uma pergunta por mensagem. Não informe valores. Se o assunto não for com a pessoa, pergunte uma única vez pelo contato do responsável.";

let seq = 0;
const inb = (body: string): ConversationMessage => ({
  id: `in${++seq}`,
  direction: "inbound",
  body,
  created_at: new Date(2026, 9, 21, 10, seq).toISOString(),
});
const outb = (body: string): ConversationMessage => ({
  id: `out${++seq}`,
  direction: "outbound",
  body,
  created_at: new Date(2026, 9, 21, 10, seq).toISOString(),
});

function output(
  reply: string,
  situation: Partial<Situation> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    reply,
    intent: "continue",
    offer_keys: [],
    material_ids: [],
    answers: [],
    handoff_reason: "",
    situation: { ...DEFAULT_SITUATION, ...situation },
    ...extra,
  };
}

function input(history: ConversationMessage[], over: Partial<TurnInput> = {}): TurnInput {
  return {
    workspaceId: "ws1",
    jobId: "job1",
    jobKind: "reply",
    mode: "live",
    agentVersionId: "ver-published",
    persona: parsePersona({ assistant_name: "Lia", instructions: PUBLISHED_INSTRUCTIONS }),
    config: parseAgentConfig({ guardrails: { max_questions: 1, no_pricing: true } }),
    offers: [
      {
        id: "o1",
        offer_key: "outsourcing",
        parent_key: null,
        name: "Outsourcing de TI",
        status: "active",
        approved_at: "2026-01-01",
        summary: "Profissionais alocados",
        fit_signals: [],
        discovery_questions: [],
        commercial_notes: "",
        pricing_policy: "",
      },
    ],
    materials: [],
    questions: [],
    history,
    state: {},
    context: {
      companyName: "Empresa Exemplo",
      agentName: "Agente Exemplo",
      origin: {
        kind: "campaign",
        campaignName: "ICP 001",
        templateName: "abertura_ti",
        templateBody: "Olá, Ana! Você responde pela TI?",
      },
      provenance: null,
    },
    extraInstructions: null,
    optOutPhrases: [],
    tools: { specs: [], executor: null, effects: emptyEffects(), directBooking: false },
    choicePosition: null,
    now: new Date("2026-10-21T13:00:00Z"),
    ...over,
  };
}

function deps(...outputs: unknown[]) {
  const queue = [...outputs];
  const callAgent = vi.fn(async (_a: { system: string; feature?: string }) => ({
    ok: true as const,
    output: queue.shift(),
  }));
  const compose = vi.fn(async (p: { reply: string; meeting: unknown }) => ({
    text: buildOutgoingText({ reply: p.reply, materials: [], meeting: p.meeting as never }),
    materials: [],
  }));
  return { callAgent, compose };
}

async function run(
  history: ConversationMessage[],
  outputs: unknown[],
  over: Partial<TurnInput> = {},
) {
  const d = deps(...outputs);
  const r = await decideTurn(input(history, over), d as never);
  if (r.kind !== "decided") throw new Error(`turno não decidido: ${r.kind}`);
  return { r, d };
}

describe("montagem e precedência", () => {
  it("persona publicada entra na íntegra; contexto da campanha é dado verificável", async () => {
    const { r } = await run(
      [outb("Olá, Ana! Você responde pela TI?"), inb("Sim, sou eu")],
      [output("Que bom! Vocês têm alguma demanda de TI hoje?")],
    );
    expect(r.system).toContain(PUBLISHED_INSTRUCTIONS);
    expect(r.system).toContain('campanha de prospecção "ICP 001", modelo "abertura_ti"');
    expect(r.system).toContain("Texto do modelo enviado");
    expect(r.system).not.toMatch(/REGRAS FIXAS|WK Sob Medida|bases comerciais e perfis/);
    expect(r.sections.map((s) => s.id)).toEqual([
      "technical",
      "precedence",
      "persona",
      "controls",
      "context",
    ]);
    expect(r.trace.agent_version_id).toBe("ver-published");
  });
  it("orientação complementar é rotulada abaixo da configuração publicada", async () => {
    const { r } = await run([inb("Oi")], [output("Oi! Em que posso ajudar?")], {
      extraInstructions: "Priorize Hunting",
    });
    const idx = (id: string) => r.sections.findIndex((s) => s.id === id);
    expect(idx("complement")).toBeGreaterThan(idx("persona"));
    expect(r.system).toContain(
      "em conflito com a configuração publicada, vale a configuração publicada",
    );
  });
  it("procedência: conhecida aparece como fato; desconhecida aparece como não registrada", async () => {
    const known = await run([inb("Como conseguiu meu número?")], [output("Veio do cadastro.")], {
      context: { ...input([]).context, provenance: "origem do cadastro no CRM: apollo" },
    });
    expect(known.r.system).toContain(
      "Procedência registrada do contato: origem do cadastro no CRM: apollo",
    );
    const unknown = await run([inb("Como conseguiu meu número?")], [output("Preciso confirmar.")]);
    expect(unknown.r.system).toContain(
      "Procedência registrada do contato: não registrada no sistema",
    );
  });
});

describe("controles configurados e texto da IA", () => {
  it("duas perguntas com limite 1: nova geração; o texto final continua da IA", async () => {
    const { r, d } = await run(
      [inb("Temos demanda de dev")],
      [output("Quantos devs? Para quando?"), output("Para quando vocês precisam do time?")],
    );
    expect(d.callAgent).toHaveBeenCalledTimes(2);
    expect(d.callAgent.mock.calls[1]![0].system).toContain(
      "o limite configurado é de 1 pergunta(s) por mensagem",
    );
    expect(r.text).toBe("Para quando vocês precisam do time?");
    expect(r.trace.changed_by_system).toBe(true);
  });
  it("limite configurado em 2 perguntas: nada é refeito", async () => {
    const { r, d } = await run(
      [inb("Temos demanda de dev")],
      [output("Quantos devs? Para quando?")],
      {
        config: parseAgentConfig({ guardrails: { max_questions: 2 } }),
      },
    );
    expect(d.callAgent).toHaveBeenCalledTimes(1);
    expect(r.text).toBe("Quantos devs? Para quando?");
  });
  it("valor com no_pricing: nova geração; se insistir, vira aviso que exige humano", async () => {
    const { r } = await run(
      [inb("Quanto custa?")],
      [output("Fica R$ 10.000"), output("Uns R$ 9 mil")],
    );
    expect(r.out.warnings).toContain(PRICE_WARNING);
  });
  it("valor com no_pricing desligado: sem aviso", async () => {
    const { r, d } = await run([inb("Quanto custa?")], [output("A partir de R$ 10.000")], {
      config: parseAgentConfig({ guardrails: { no_pricing: false } }),
    });
    expect(d.callAgent).toHaveBeenCalledTimes(1);
    expect(r.out.warnings).not.toContain(PRICE_WARNING);
  });
  it("sem reescrita editorial: abertura e vocativo do modelo são preservados", async () => {
    const reply = "Entendi! José, vocês já têm data para começar?";
    const { r } = await run([inb("Temos orçamento")], [output(reply)]);
    expect(r.text).toBe(reply);
    expect(r.trace.changed_by_system).toBe(false);
  });
  it("material prometido sem anexo: nova geração; se insistir, bloqueia envio automático", async () => {
    const { r } = await run(
      [inb("Me manda a apresentação")],
      [output("Vou te enviar o material agora."), output("Segue o material em anexo.")],
    );
    expect(r.out.warnings).toContain(MATERIAL_CLAIM_WARNING);
    expect(r.text).not.toMatch(/em instantes/);
  });
  it("URL escrita pela IA é removida e o trace registra a mudança", async () => {
    const { r } = await run([inb("Tem site?")], [output("Veja https://exemplo.com")]);
    expect(r.text).toBe("Veja");
    expect(r.trace.change_reasons).toContain("URL escrita pela IA removida");
  });
});

describe("recusas e descadastro", () => {
  it.each([
    "Por favor, pare de me mandar mensagens",
    "Remova meu número da lista",
    "Não quero mais receber mensagens",
  ])("pedido explícito '%s' descadastra mesmo se o modelo seguir a conversa", async (t) => {
    const { r } = await run([inb(t)], [output("Tudo bem, não vou mais escrever.")]);
    expect(r.optOut).toBe(true);
    expect(r.out.intent).toBe("opt_out");
    expect(r.text).toBe("Tudo bem, não vou mais escrever.");
    expect(r.noFollowUp).toBe(true);
    expect(r.system).toContain("pedido explícito de não receber mais contato");
  });
  it("'não quero reunião, manda por aqui' não é descadastro: transferência da IA vale", async () => {
    const h = [inb("Não quero reunião, me manda o orçamento por aqui")];
    const { r } = await run(h, [
      output(
        "Combinado, vou passar para o responsável te mandar.",
        { meeting_declined: true, evidence_message_id: h[0]!.id },
        { intent: "handoff", handoff_reason: "Quer orçamento por mensagem" },
      ),
    ]);
    expect(r.optOut).toBe(false);
    expect(r.out.intent).toBe("handoff");
    expect(r.state.patch.meeting_declined?.message_id).toBe(h[0]!.id);
  });
  it("opt_out do modelo em recusa comercial encerra sem bloqueio permanente", async () => {
    const { r } = await run(
      [inb("Não temos interesse no momento")],
      [output("Entendo, obrigada pela atenção!", {}, { intent: "opt_out" })],
    );
    expect(r.optOut).toBe(false);
    expect(r.close).toBe("declined");
  });
  it("'Obrigado Lia' com opt_out do modelo não encerra nem descadastra", async () => {
    const { r } = await run(
      [inb("Obrigado Lia")],
      [output("Eu que agradeço!", {}, { intent: "opt_out" })],
    );
    expect(r.optOut).toBe(false);
    expect(r.close).toBeNull();
  });
});

describe("estado explícito (não depende da redação)", () => {
  it("nome corrigido só com prova na mensagem do cliente", async () => {
    const h = [inb("Na verdade me chamo Pedro")];
    const ok = await run(h, [output("Certo, Pedro!", { confirmed_name: "Pedro" })]);
    expect(ok.r.state.patch.confirmed_name?.name).toBe("Pedro");
    const bad = await run(
      [inb("Pode falar")],
      [output("Oi, Carlos!", { confirmed_name: "Carlos" })],
    );
    expect(bad.r.state.patch.confirmed_name).toBeUndefined();
  });
  it("decisor confirmado exige evidência; estado entra no prompt do turno seguinte", async () => {
    const h = [inb("Sou uma das responsáveis")];
    const { r } = await run(h, [
      output("Que bom! Qual a demanda?", {
        decision_maker_confirmed: true,
        evidence_message_id: h[0]!.id,
      }),
    ]);
    expect(r.state.patch.decision_maker_confirmed).toBeTruthy();
    const next = await run(
      [...h, outb("Que bom! Qual a demanda?"), inb("Dev React")],
      [output("Para quando?")],
      {
        state: r.state.patch,
      },
    );
    expect(next.r.system).toContain("O cliente já confirmou que é responsável pela área/decisão.");
    const noEv = await run([inb("Sou eu")], [output("Ok", { decision_maker_confirmed: true })]);
    expect(noEv.r.state.patch.decision_maker_confirmed).toBeUndefined();
  });
  it.each([
    ["Já saí da empresa faz tempo", "left_company"],
    ["Esse número é particular, não me chame aqui", "private_number"],
    ["Não sei quem cuida disso, desculpe", "referral_declined"],
  ] as const)("terceiro (%s) encerra pela situação, texto é da IA", async (t, reason) => {
    const { r } = await run(
      [inb(t)],
      [
        output("Sem problemas, obrigada e desculpe o incômodo!", {
          conversation: "closed",
          close_reason: reason,
        }),
      ],
    );
    expect(r.close).toBe(reason);
    expect(r.text).toBe("Sem problemas, obrigada e desculpe o incômodo!");
    expect(r.noFollowUp).toBe(true);
  });
  it("pede indicação uma vez: registra; repetir gera aviso", async () => {
    const h = [inb("Não trabalho mais lá")];
    const first = await run(h, [
      output("Você sabe quem responde pela TI aí?", { conversation: "asked_referral" }),
    ]);
    expect(first.r.state.patch.referral_asked).toBeTruthy();
    const second = await run(
      [...h, outb("x"), inb("hmm")],
      [output("Sabe quem cuida da TI?", { conversation: "asked_referral" })],
      { state: first.r.state.patch },
    );
    expect(second.r.out.warnings).toContain(
      "Contato do responsável já havia sido pedido nesta conversa.",
    );
  });
  it("vai mandar o contato depois: aguardando, sem encerrar", async () => {
    const { r } = await run(
      [inb("Vou ver com o pessoal e te passo depois")],
      [output("Combinado, obrigada!", { conversation: "awaiting_referral" })],
    );
    expect(r.state.patch.awaiting_referral).toBeTruthy();
    expect(r.close).toBeNull();
  });
  it("cartão de contato de outra pessoa: indicação registrada sem prometer contatar", async () => {
    const card = "👤 Contato compartilhado\nRafael Montini (Zhaz): +55 11 91717-7728";
    const { r } = await run(
      [inb(card)],
      [
        output("Muito obrigada pela indicação! Tenha um ótimo dia.", {
          shared_contact: "referral",
          conversation: "closed",
          close_reason: "referral_received",
        }),
      ],
    );
    expect(r.state.referral?.phoneE164).toBe("+5511917177728");
    expect(r.close).toBe("referral_received");
    expect(r.text).not.toMatch(/vou entrar em contato/i);
  });
  it("cartão do próprio cliente (número corporativo) não vira indicação", async () => {
    const { r } = await run(
      [inb("Pode falar nesse: 48 99999-0000")],
      [output("Anotado, seguimos por aqui.", { shared_contact: "own_corporate" })],
    );
    expect(r.state.corporatePhone).toBe("+5548999990000");
    expect(r.state.referral).toBeNull();
  });
  it("indicação sem número legível não encerra", async () => {
    const { r } = await run(
      [inb("fala com o João do financeiro")],
      [
        output("Obrigada!", {
          shared_contact: "referral",
          conversation: "closed",
          close_reason: "referral_received",
        }),
      ],
    );
    expect(r.close).toBeNull();
    expect(r.state.referral).toBeNull();
  });
  it("cargo técnico não é descartado pelo código", async () => {
    const { r } = await run(
      [inb("Sou desenvolvedor aqui na empresa")],
      [output("Legal! Vocês têm alguma demanda que eu possa ajudar?")],
    );
    expect(r.close).toBeNull();
    expect(r.text).toBe("Legal! Vocês têm alguma demanda que eu possa ajudar?");
  });
  it("pergunta legítima após encerramento: IA responde e retomadas seguem suspensas", async () => {
    const closed: ConversationState = { closed: { at: "", job_id: null, reason: "left_company" } };
    const { r } = await run(
      [outb("Obrigada!"), inb("Mas vocês fazem infraestrutura?")],
      [output("Fazemos sim, com Consultoria de Infraestrutura. Quer que eu explique?")],
      { state: closed },
    );
    expect(r.state.patch.closed).toBeNull();
    expect(r.noFollowUp).toBe(true);
    expect(r.system).toContain("Conversa encerrada anteriormente");
  });
  it("nada a responder após encerramento: supressão só vale com conversa encerrada", async () => {
    const closed: ConversationState = { closed: { at: "", job_id: null, reason: "no_demand" } };
    const ok = await run([inb("👍")], [output("", { suppress_reply: "closed_no_reply_needed" })], {
      state: closed,
    });
    expect(ok.r.state.suppress).toBe("closed_no_reply_needed");
    expect(ok.r.text).toBe("");
    const d = deps(output("", { suppress_reply: "closed_no_reply_needed" }));
    const bad = await decideTurn(input([inb("👍")]), d as never);
    expect(bad.kind === "decided" && bad.state.suppress).toBeNull();
  });
});

describe("robôs, outra pessoa, IA e áudio", () => {
  it("URA vira fato técnico; lista legítima não", async () => {
    const ura = await run(
      [inb("Olá, seja bem vindo!\nEscolha uma fila:\n1 - Suporte\n2 - Comercial")],
      [output("", { suppress_reply: "auto_responder" })],
    );
    expect(ura.r.system).toContain("padrão típico de atendimento automático");
    expect(ura.r.state.suppress).toBe("auto_responder");
    expect(ura.r.text).toBe("");
    const list = await run([inb("Precisamos de:\n1) React\n2) Node")], [output("Para quando?")]);
    expect(list.r.system).not.toContain("padrão típico de atendimento automático");
    expect(list.r.text).toBe("Para quando?");
  });
  it("supressão em retomada automática é recusada", async () => {
    const d = deps(output("", { suppress_reply: "addressed_to_other" }));
    const r = await decideTurn(
      input([inb("Amor, chego tarde")], { jobKind: "follow_up" }),
      d as never,
    );
    expect(r.kind === "decided" && r.state.suppress).toBeNull();
  });
  it("pergunta sobre IA: resposta normal, sem transferência forçada", async () => {
    const { r } = await run(
      [inb("Você é uma IA?")],
      [output("Sou uma assistente virtual com IA. Posso te ajudar com alguma demanda?")],
    );
    expect(r.out.intent).toBe("continue");
    expect(r.text).toContain("assistente virtual");
  });
  it("áudio transcrito chega como mensagem do cliente", async () => {
    const { d } = await run([inb('🎤 Áudio: "precisamos de dois devs"')], [output("Para quando?")]);
    const sys = d.callAgent.mock.calls[0]![0].system;
    expect(sys).toContain("🎤 Áudio:");
  });
});

describe("teste e produção compartilham o pipeline", () => {
  it("mesma entrada → mesma decisão em live e sandbox (só muda a marcação da IA)", async () => {
    const h = [inb("Temos demanda de dev")];
    const live = await run(h, [output("Para quando?")]);
    const sand = await run(h, [output("Para quando?")], { mode: "sandbox", jobId: null });
    expect(sand.r.text).toBe(live.r.text);
    expect(sand.r.system).toBe(live.r.system);
    expect(sand.d.callAgent.mock.calls[0]![0].feature).toBe("sdr_agente_teste");
    expect(live.d.callAgent.mock.calls[0]![0].feature).toBe("sdr_agente");
  });
});
