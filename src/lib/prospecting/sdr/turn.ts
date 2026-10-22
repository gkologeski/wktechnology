// Domínio ÚNICO do turno do Agente SDR, usado pela produção (worker) e pelo
// teste do estúdio (sandbox). Recebe dados já carregados e adaptadores
// injetados (IA, composição da mensagem); não lê nem grava banco. A
// persistência fica com quem chama: produção grava pelo commit atômico,
// sandbox não grava nada. Linguagem e estratégia vêm da configuração
// publicada; aqui só ficam contrato técnico, validações e efeitos permitidos.
import type { AgentConfig } from "./agent-config";
import { shouldAttachMaterials } from "./agent-config";
import {
  buildPrompt,
  type AgentCallResult,
  type AgentToolExecutor,
  type AgentToolSpec,
  type PromptContext,
  type PromptSection,
} from "./agent.server";
import { claimsBooking } from "./booking-guard";
import { claimsMaterialSent } from "./conversation-guards";
import {
  currentInbound,
  decideState,
  type CloseReason,
  type ConversationState,
  type StateDecision,
} from "./conversation-state";
import type { Persona } from "./persona";
import { toneIssues } from "./persona";
import {
  countQuestions,
  detectOptOut,
  isCourtesyOnly,
  MATERIAL_CLAIM_WARNING,
  mentionsPrice,
  PRICE_WARNING,
  validateAgentOutput,
  type ConversationMessage,
  type SdrMaterial,
  type SdrOffer,
  type ValidatedOutput,
} from "./policy";
import type { CanonicalQuestion } from "./qualification";
import { isAutoResponder } from "./third-party";
import type { TurnEffects } from "./tools/dispatcher";

export type CallAgent = (args: {
  workspaceId: string;
  system: string;
  history: ConversationMessage[];
  feature?: "sdr_agente" | "sdr_agente_teste";
  tools?: AgentToolSpec[];
  executeTool?: AgentToolExecutor;
}) => Promise<AgentCallResult>;

export type Composer = (p: {
  reply: string;
  intent: ValidatedOutput["intent"];
  materialIds: string[];
  attachMaterials: boolean;
  meeting: TurnEffects["meeting"];
}) => Promise<{ text: string; materials: { id: string; title: string }[] }>;

export type TurnInput = {
  workspaceId: string;
  jobId: string | null;
  jobKind: "reply" | "follow_up";
  mode: "live" | "sandbox";
  agentVersionId: string | null;
  persona: Persona;
  config: AgentConfig;
  offers: SdrOffer[];
  materials: SdrMaterial[];
  questions: CanonicalQuestion[];
  history: ConversationMessage[];
  state: ConversationState;
  context: Omit<PromptContext, "state" | "facts" | "jobKind">;
  /** Orientação complementar do agente (prompt de qualificação do playbook). */
  extraInstructions: string | null;
  optOutPhrases: string[];
  tools: {
    specs: AgentToolSpec[];
    executor: AgentToolExecutor | null;
    effects: TurnEffects;
    directBooking: boolean;
  };
  /** Opção vigente que a última mensagem do cliente escolhe (resolvida no servidor). */
  choicePosition: number | null;
  now: Date;
};

export type TurnDeps = { callAgent: CallAgent; compose: Composer };

export type TurnStage = {
  stage: "pre" | "generation" | "validation" | "regeneration" | "state" | "composition";
  status: "ok" | "changed" | "failed" | "skipped";
  detail?: string;
};

export type TurnTrace = {
  agent_version_id: string | null;
  mode: "live" | "sandbox";
  prompt_sections: { id: string; title: string; chars: number }[];
  facts: string[];
  stages: TurnStage[];
  tool_calls: { tool: string; status: string; simulated: boolean }[];
  situation: ValidatedOutput["situation"] | null;
  state_before: ConversationState;
  state_patch: ConversationState;
  reply_generated: string | null;
  reply_final: string | null;
  changed_by_system: boolean;
  change_reasons: string[];
  tone_issues: string[];
  warnings: string[];
};

export type TurnDecision =
  | { kind: "ai_error"; error: string; status: number; retryable: boolean; trace: TurnTrace }
  | { kind: "invalid"; error: string; trace: TurnTrace }
  | {
      kind: "decided";
      out: ValidatedOutput;
      /** Texto final a enviar; vazio = nada sai para o canal. */
      text: string;
      materials: { id: string; title: string }[];
      state: StateDecision;
      /** Descadastro permanente: só com pedido explícito. */
      optOut: boolean;
      close: CloseReason | null;
      noFollowUp: boolean;
      system: string;
      sections: PromptSection[];
      trace: TurnTrace;
    };

const lastCurrentText = (history: ConversationMessage[]) =>
  currentInbound(history)
    .map((m) => m.body)
    .join("\n");

/** Fatos verificados pelo sistema antes da IA (dados, não instruções). */
export function preTurnFacts(i: TurnInput): { facts: string[]; explicitOptOut: boolean } {
  const facts: string[] = [];
  let explicitOptOut = false;
  if (i.jobKind === "reply") {
    const text = lastCurrentText(i.history);
    explicitOptOut = !!text && detectOptOut(text, i.optOutPhrases);
    if (explicitOptOut)
      facts.push(
        "A mensagem atual contém pedido explícito de não receber mais contato; o descadastro é registrado pelo sistema após esta resposta.",
      );
    if (currentInbound(i.history).some((m) => isAutoResponder(m.body)))
      facts.push(
        "Sinal técnico: a mensagem atual tem padrão típico de atendimento automático (instrução de menu/protocolo).",
      );
  }
  if (i.choicePosition)
    facts.push(
      `A última mensagem do cliente corresponde à opção ${i.choicePosition} das opções de horário vigentes.`,
    );
  return { facts, explicitOptOut };
}

type Violation = "price" | "questions" | "material_claim" | "booking_claim";

function violations(reply: string, out: ValidatedOutput, i: TurnInput): Violation[] {
  const v: Violation[] = [];
  if (!reply) return v;
  const g = i.config.guardrails;
  if (g.no_pricing && mentionsPrice(reply)) v.push("price");
  if (countQuestions(reply) > g.max_questions) v.push("questions");
  const attached = shouldAttachMaterials({
    intent: out.intent,
    materialIds: out.material_ids,
    attachMaterials: g.attach_materials,
  });
  if (claimsMaterialSent(reply) && !attached) v.push("material_claim");
  if (
    i.tools.directBooking &&
    claimsBooking(reply) &&
    i.tools.effects.meeting?.status !== "confirmed"
  )
    v.push("booking_claim");
  return v;
}

const VIOLATION_TEXT: Record<Violation, (i: TurnInput) => string> = {
  price: () => "o agente está configurado para não informar valores e a resposta cita valores",
  questions: (i) =>
    `o limite configurado é de ${i.config.guardrails.max_questions} pergunta(s) por mensagem`,
  material_claim: () => "nenhum material foi anexado pelo sistema neste turno",
  booking_claim: () => "nenhuma reunião foi confirmada pela agenda neste turno",
};

/**
 * Nova geração (sem ferramentas e sem efeitos) quando a resposta viola um
 * controle CONFIGURADO ou afirma um efeito que não ocorreu. O aviso cita só o
 * controle e o fato; o texto continua vindo da IA sob a mesma configuração.
 */
export async function regenerate(
  deps: Pick<TurnDeps, "callAgent">,
  p: {
    workspaceId: string;
    system: string;
    history: ConversationMessage[];
    feature: "sdr_agente" | "sdr_agente_teste";
    reason: string;
  },
): Promise<string | null> {
  const ai = await deps.callAgent({
    workspaceId: p.workspaceId,
    system: `${p.system}\n\n[verificação do sistema] A resposta anterior não pôde ser usada porque ${p.reason}. Gere uma nova resposta seguindo a configuração publicada, no mesmo formato e sem chamar ferramentas.`,
    history: p.history,
    feature: p.feature,
  });
  if (!ai.ok) return null;
  const reply = (ai.output as { reply?: unknown } | null)?.reply;
  return typeof reply === "string" && reply.trim() ? reply.trim() : null;
}

/** Executa o turno completo: prompt → IA → validação → estado → composição. */
export async function decideTurn(i: TurnInput, deps: TurnDeps): Promise<TurnDecision> {
  const feature = i.mode === "sandbox" ? "sdr_agente_teste" : "sdr_agente";
  const { facts, explicitOptOut } = preTurnFacts(i);
  const { text: system, sections } = buildPrompt({
    offers: i.offers,
    materials: i.materials,
    questions: i.questions,
    persona: i.persona,
    config: i.config,
    extraInstructions: i.extraInstructions,
    directBooking: i.tools.directBooking,
    toolsAvailable: i.tools.specs.length > 0,
    toolNames: i.tools.specs.map((t) => t.name.replace(/__/g, ".")),
    context: { ...i.context, state: i.state, facts, jobKind: i.jobKind },
  });
  const trace: TurnTrace = {
    agent_version_id: i.agentVersionId,
    mode: i.mode,
    prompt_sections: sections.map((s) => ({ id: s.id, title: s.title, chars: s.text.length })),
    facts,
    stages: [{ stage: "pre", status: "ok", detail: `${facts.length} fato(s) verificado(s)` }],
    tool_calls: [],
    situation: null,
    state_before: i.state,
    state_patch: {},
    reply_generated: null,
    reply_final: null,
    changed_by_system: false,
    change_reasons: [],
    tone_issues: [],
    warnings: [],
  };
  const withTools = i.tools.specs.length > 0 && !!i.tools.executor;
  const ai = await deps.callAgent({
    workspaceId: i.workspaceId,
    system,
    history: i.history,
    feature,
    ...(withTools ? { tools: i.tools.specs, executeTool: i.tools.executor! } : {}),
  });
  trace.tool_calls = i.tools.effects.trace.map((t) => ({
    tool: t.tool,
    status: t.status,
    simulated: t.simulated,
  }));
  if (!ai.ok) {
    trace.stages.push({ stage: "generation", status: "failed", detail: ai.error.slice(0, 200) });
    return { kind: "ai_error", error: ai.error, status: ai.status, retryable: ai.retryable, trace };
  }
  trace.stages.push({ stage: "generation", status: "ok" });
  const out = validateAgentOutput(ai.output, {
    offers: i.offers,
    materials: i.materials,
    noPricing: i.config.guardrails.no_pricing,
  });
  if ("error" in out) {
    trace.stages.push({ stage: "validation", status: "failed", detail: out.error });
    return { kind: "invalid", error: out.error, trace };
  }
  trace.reply_generated = out.reply;
  trace.situation = out.situation;
  const fx = i.tools.effects;

  // Efeitos registrados pelas ferramentas prevalecem sobre a intenção textual.
  if (fx.answers.length) out.answers = [...(out.answers as unknown[]), ...fx.answers];
  if (fx.materialIds.length) {
    out.material_ids = [...new Set([...out.material_ids, ...fx.materialIds])];
    if (out.intent === "continue") out.intent = "send_material";
  }
  if (fx.handoff) {
    out.intent = "handoff";
    out.handoff_reason = fx.handoff;
  }

  // Descadastro permanente só com pedido explícito; recusa comercial encerra
  // a conversa sem bloqueio permanente; cortesia nunca encerra.
  let optOut = false;
  const asked = out.intent === "opt_out" || fx.optOut;
  if (i.jobKind === "reply" && explicitOptOut) {
    optOut = true;
    out.intent = "opt_out";
  } else if (asked) {
    out.intent = "continue";
    if (isCourtesyOnly(lastCurrentText(i.history), [i.persona.assistant_name])) {
      out.warnings.push("Descadastro sugerido em mensagem de cortesia: ignorado.");
    } else {
      out.situation = { ...out.situation, conversation: "closed", close_reason: "declined" };
      out.warnings.push(
        "Recusa sem pedido explícito de descadastro: conversa encerrada sem bloqueio permanente.",
      );
    }
  }

  const state = decideState({
    situation: out.situation,
    history: i.history,
    state: i.state,
    jobId: i.jobId,
    jobKind: i.jobKind,
    reply: out.reply,
    now: i.now,
  });
  if (out.situation.conversation === "asked_referral" && i.state.referral_asked)
    state.warnings.push("Contato do responsável já havia sido pedido nesta conversa.");
  out.warnings.push(...state.warnings);
  trace.state_patch = state.patch;
  trace.stages.push({
    stage: "state",
    status: Object.keys(state.patch).length ? "changed" : "ok",
    detail: [
      state.suppress ? `supressão: ${state.suppress}` : "",
      state.close ? `encerramento: ${state.close}` : "",
    ]
      .filter(Boolean)
      .join("; "),
  });

  // Supressão estruturada válida: nada sai (descadastro explícito prevalece).
  if (state.suppress && !optOut) {
    out.reply = "";
    out.material_ids = [];
  }

  // Controles configurados e efeitos falsos: uma nova geração, depois aviso.
  let reply = out.reply;
  if (reply && out.intent !== "handoff") {
    const v = violations(reply, out, i);
    trace.stages.push({
      stage: "validation",
      status: v.length ? "failed" : "ok",
      detail: v.join(", "),
    });
    if (v.length) {
      const alt = await regenerate(deps, {
        workspaceId: i.workspaceId,
        system,
        history: i.history,
        feature,
        reason: v.map((x) => VIOLATION_TEXT[x](i)).join("; "),
      });
      const altV = alt ? violations(alt, out, i) : v;
      const accepted = !!alt && altV.length < v.length;
      trace.stages.push({
        stage: "regeneration",
        status: accepted ? "changed" : "failed",
        detail: accepted ? `restam: ${altV.join(", ") || "nenhum"}` : "nova geração não resolveu",
      });
      if (accepted) {
        reply = alt!;
        trace.change_reasons.push(`nova geração por: ${v.join(", ")}`);
      }
      const remaining = accepted ? altV : v;
      if (remaining.includes("price")) out.warnings.push(PRICE_WARNING);
      if (remaining.includes("material_claim") || remaining.includes("booking_claim"))
        out.warnings.push(MATERIAL_CLAIM_WARNING);
      if (remaining.includes("questions"))
        out.warnings.push("Resposta acima do limite de perguntas configurado.");
    }
  } else {
    trace.stages.push({ stage: "validation", status: "skipped" });
  }
  out.reply = reply;

  const composed = reply
    ? await deps.compose({
        reply,
        intent: out.intent,
        materialIds: out.material_ids,
        attachMaterials: i.config.guardrails.attach_materials,
        meeting: fx.meeting,
      })
    : { text: "", materials: [] };
  if (reply && composed.text !== reply) {
    trace.changed_by_system = true;
    if (/https?:\/\//i.test(reply)) trace.change_reasons.push("URL escrita pela IA removida");
    if (fx.meeting?.status === "confirmed" && fx.meeting.meetLink)
      trace.change_reasons.push("link da videoconferência confirmada anexado");
    if (composed.materials.length) trace.change_reasons.push("materiais aprovados anexados");
  }
  if (trace.change_reasons.some((r) => r.startsWith("nova geração")))
    trace.changed_by_system = true;
  trace.stages.push({
    stage: "composition",
    status: trace.changed_by_system ? "changed" : composed.text ? "ok" : "skipped",
    detail: trace.change_reasons.join("; "),
  });
  trace.reply_final = composed.text || null;
  const lastIn = currentInbound(i.history).at(-1)?.body ?? null;
  trace.tone_issues = composed.text
    ? toneIssues(reply, lastIn, i.persona, i.config.guardrails.max_questions)
    : [];
  trace.warnings = out.warnings;

  const close = optOut ? null : state.close;
  const noFollowUp =
    optOut ||
    !!close ||
    state.stopFollowUps ||
    !!i.state.contact_source_asked ||
    // Conversa já encerrada nunca volta a ter retomadas automáticas: só
    // responde ao que o cliente escrever.
    !!i.state.closed;
  return {
    kind: "decided",
    out,
    text: composed.text,
    materials: composed.materials,
    state,
    optOut,
    close,
    noFollowUp,
    system,
    sections,
    trace,
  };
}
