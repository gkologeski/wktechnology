// Execução do SDR: follow-ups, turnos com lease e conciliação de reuniões.
// Nenhuma transação SQL fica aberta durante a chamada de IA: o claim marca o
// trabalho e devolve; o envio recheca dono/versão antes de sair.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import {
  decideThirdParty,
  isAutoResponder,
  isPostCloseQuestion,
  POST_CLOSE_REPLY,
  type Referral,
} from "./third-party";
import { parsePersona, stripStockOpener } from "./persona";
import { configFromRow, hasTool, scopeKnowledge } from "./agent-config";
import { buildSystemPrompt, callSdrAgent } from "./agent.server";
import {
  composeOutgoing,
  ensureOpportunity,
  handoffToHuman,
  reconcileMeetings,
  sendSdrMessage,
  tripBreakerIfNeeded,
  type DraftPayload,
} from "./actions.server";
import { recordSdrAction } from "./ingest.server";
import {
  asksDecisionMaker,
  claimsMaterialSent,
  correctedName,
  asksContactSource,
  CONTACT_SOURCE_REPLY,
  dedupeRepeatedWords,
  extractCorporatePhone,
  isOffTopic,
  OUT_OF_ICP_CLOSE,
  outOfIcpRole,
  fixVocative,
  greetingName,
  isAiIdentityQuestion,
  MATERIAL_HANDOFF_REPLY,
  NOT_NOW_CLOSE,
  notTheMoment,
  offersToKeepContact,
  refusedMeeting,
  repeatsIdenticalInbound,
  selfIdentifiedResponsible,
  showsBusinessInterest,
} from "./conversation-guards";
import { resolveChoice } from "./booking-guard";
import { parseToolConfig, type ScheduleConfig } from "./tools/catalog";
import { emptyEffects, type ToolCtx } from "./tools/dispatcher";
import { makeExecutor, newEventId, selectTools } from "./tools/runtime";
import type { CalendarProvider, ToolStore } from "./tools/types";
import {
  followUpIdemKey,
  isQuietHours,
  nextStage,
  selectableMaterials,
  guardModelOptOut,
  detectOptOut,
  isWrongContact,
  OPT_OUT_CONFIRM,
  isUnavailabilityHandoff,
  blockingWarnings,
  countQuestions,
  mentionsPrice,
  PRICE_WARNING,
  selectableOffers,
  sendGuard,
  validateAgentOutput,
  type CommercialStage,
  type ConversationMessage,
  type SdrMaterial,
  type SdrOffer,
} from "./policy";
import {
  acceptAnswers,
  mergeAnswers,
  qualifiesForOpportunity,
  scoreCanonical,
  type CanonicalQuestion,
  type CanonicalScore,
} from "./qualification";

const LEASE_SECONDS = 120;
const MAX_WAIT_MS = 60_000;

/** Nova geração sem ferramentas (sem efeitos), só para corrigir o texto. */
async function rewriteReply(
  deps: WorkerDeps,
  workspaceId: string,
  system: string,
  history: ConversationMessage[],
  instruction: string,
): Promise<string | null> {
  const ai = await deps.callAgent({
    workspaceId,
    system: `${system}\n\nCORREÇÃO OBRIGATÓRIA: ${instruction} Mantenha o mesmo formato de saída e não chame ferramentas.`,
    history,
  });
  if (!ai.ok) return null;
  const reply = (ai.output as { reply?: unknown } | null)?.reply;
  return typeof reply === "string" && reply.trim() ? stripStockOpener(reply.trim()) : null;
}

export async function loadKnowledge(admin: Admin, workspaceId: string) {
  const [{ data: offers }, { data: materials }, { data: links }] = await Promise.all([
    admin.from("sdr_offers").select("*").eq("workspace_id", workspaceId).order("position"),
    admin
      .from("sdr_materials")
      .select("id, title, approved, active, url, storage_path")
      .eq("workspace_id", workspaceId),
    admin
      .from("sdr_material_offers")
      .select("material_id, offer_id")
      .eq("workspace_id", workspaceId),
  ]);
  const byMat = new Map<string, string[]>();
  for (const l of links ?? [])
    byMat.set(l.material_id, [...(byMat.get(l.material_id) ?? []), l.offer_id]);
  const mats: SdrMaterial[] = (materials ?? []).map((m: SdrMaterial) => ({
    ...m,
    offer_ids: byMat.get(m.id) ?? [],
  }));
  return {
    offers: selectableOffers((offers ?? []) as SdrOffer[]),
    materials: selectableMaterials(mats),
  };
}

async function finish(
  admin: Admin,
  jobId: string,
  leaseToken: string,
  patch: Record<string, unknown>,
) {
  await admin
    .from("sdr_turn_jobs")
    .update({ ...patch, lease_token: null, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "running")
    .eq("lease_token", leaseToken);
}

type Job = {
  id: string;
  attempts?: number;
  created_at?: string;
  workspace_id: string;
  enrollment_id: string;
  conversation_id: string;
  kind: "reply" | "follow_up";
  lease_token: string;
  conversation_version: number | null;
  status: string;
};

export type ToolEnv = {
  store: ToolStore;
  calendar: CalendarProvider | null;
  calendarFacts: { ok: boolean; reason?: string };
};
export type WorkerDeps = {
  callAgent: typeof callSdrAgent;
  /** Armazenamento e agenda das ferramentas (produção: banco + Google). */
  toolEnv?: (
    admin: Admin,
    p: {
      workspaceId: string;
      playbookId: string;
      agentVersionId: string | null;
      jobId: string;
      conversationId: string;
      enrollmentId: string;
      scheduling: ScheduleConfig | null;
    },
  ) => Promise<ToolEnv>;
  ensureOpportunity: typeof ensureOpportunity;
  handoffToHuman: typeof handoffToHuman;
  sendMessage: typeof sendSdrMessage;
};

async function defaultToolEnv(
  admin: Admin,
  p: Parameters<NonNullable<WorkerDeps["toolEnv"]>>[1],
): Promise<ToolEnv> {
  const { createDbToolStore, checkHostCalendar, createGoogleCalendar, primaryCalendarId } =
    await import("./tools/store.server");
  const store = createDbToolStore(admin, p);
  const facts = await checkHostCalendar(admin, p.workspaceId, p.scheduling);
  const calendar =
    facts.ok && p.scheduling
      ? createGoogleCalendar(
          admin,
          p.workspaceId,
          p.scheduling,
          await primaryCalendarId(admin, p.workspaceId, p.scheduling.calendar_account_id),
        )
      : null;
  return { store, calendar, calendarFacts: facts };
}

const defaultDeps: WorkerDeps = {
  callAgent: callSdrAgent,
  toolEnv: defaultToolEnv,
  ensureOpportunity,
  handoffToHuman,
  sendMessage: sendSdrMessage,
};

async function guard(admin: Admin, job: Job): Promise<string> {
  const { data, error } = await admin.rpc("sdr_guard", { p_job: job.id, p_lease: job.lease_token });
  if (error) throw new Error(error.message);
  if (data !== "ok")
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: String(data) });
  return String(data);
}

export async function loadQuestions(
  admin: Admin,
  workspaceId: string,
  questionnaireId: string | null,
): Promise<CanonicalQuestion[]> {
  if (!questionnaireId) return [];
  const { data, error } = await admin
    .from("prospecting_questions")
    .select("id, label, type, options, weight, required, text_points, text_min_chars, position")
    .eq("questionnaire_id", questionnaireId)
    .eq("workspace_id", workspaceId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as CanonicalQuestion[];
}

async function loadQualification(
  admin: Admin,
  workspaceId: string,
  questionnaireId: string,
  target: { entity: "lead" | "contact"; id: string },
): Promise<{ id: string; answers: unknown; updated_at: string } | null> {
  const { data, error } = await admin
    .from("prospecting_qualifications")
    .select("id, answers, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("questionnaire_id", questionnaireId)
    .eq("entity", target.entity)
    .eq("entity_id", target.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** ICP do lead com critérios do próprio workspace (o cliente admin não aplica RLS). */
async function scopedIcpFit(admin: Admin, workspaceId: string, leadId: string) {
  const { computeIcpFit } = await import("@/lib/scoring/icp.server");
  const [{ data: criteria }, { data: lead }] = await Promise.all([
    admin
      .from("icp_criteria")
      .select("id, name, entity, field, op, value, points, enabled")
      .eq("workspace_id", workspaceId)
      .eq("enabled", true),
    admin.from("leads").select("*").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (!lead) return null;
  let company = null;
  if (lead.company_id) {
    ({ data: company } = await admin
      .from("companies")
      .select("*")
      .eq("id", lead.company_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle());
  }
  const fit = computeIcpFit(criteria ?? [], lead, company ?? null);
  return { points: fit.points, max: fit.max };
}

/** Backoff exponencial para falhas transitórias: 30 s, 60 s, 120 s… até 10 min. */
export function retryDelayMs(attempt: number): number {
  return Math.min(600_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

/** Re-aponta o turno sobrevivente para a mensagem recebida mais recente da conversa. */
async function adoptLatestInbound(admin: Admin, job: Job): Promise<void> {
  const [{ data: lastIn }, { data: current }] = await Promise.all([
    admin
      .from("whatsapp_messages")
      .select("id")
      .eq("conversation_id", job.conversation_id)
      .eq("workspace_id", job.workspace_id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("sdr_turn_jobs").select("inbound_message_id").eq("id", job.id).maybeSingle(),
  ]);
  const latestId = (lastIn as { id: string } | null)?.id;
  const currentId = (current as { inbound_message_id: string | null } | null)?.inbound_message_id;
  if (!latestId || !currentId || latestId === currentId) return;
  const { error } = await admin
    .from("sdr_turn_jobs")
    .update({ inbound_message_id: latestId, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token);
  if (error) console.error("[sdr] não foi possível assumir a mensagem mais recente", error.message);
}

export async function processJob(
  admin: Admin,
  job: Job,
  deps: WorkerDeps = defaultDeps,
): Promise<string> {
  const [{ data: conv }, { data: enr }, { data: settings }] = await Promise.all([
    admin
      .from("whatsapp_conversations")
      .select("id, workspace_id, ai_owner, ai_version, contact_id, lead_id, contact_phone")
      .eq("id", job.conversation_id)
      .maybeSingle(),
    admin.from("sdr_enrollments").select("*").eq("id", job.enrollment_id).maybeSingle(),
    admin
      .from("sdr_workspace_settings")
      .select("*")
      .eq("workspace_id", job.workspace_id)
      .maybeSingle(),
  ]);
  if (
    !conv ||
    !enr ||
    conv.workspace_id !== job.workspace_id ||
    enr.workspace_id !== job.workspace_id
  ) {
    await finish(admin, job.id, job.lease_token, {
      status: "discarded",
      error: "context_mismatch",
    });
    return "discarded";
  }
  const pre = sendGuard({ job, leaseToken: job.lease_token, conversation: conv, enrollment: enr });
  if (!pre.ok) {
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: pre.reason });
    return "discarded";
  }
  if (!settings?.enabled) {
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: "workspace_disabled",
    });
    return "skipped";
  }
  // Disjuntor técnico aberto: não chama IA; operador retoma de forma controlada.
  if (settings.tech_breaker_open_at) {
    await finish(admin, job.id, job.lease_token, {
      status: "failed",
      error: "circuit_open",
      block_category: "technical",
    });
    return "failed";
  }
  // Mensagens seguidas: o turno mais novo responde a TODAS de uma vez (o
  // histórico agrupa as mensagens pendentes do cliente); este fica registrado
  // como agrupado nele, sem chamar a IA nem enviar resposta duplicada.
  const { data: newer } = await admin
    .from("sdr_turn_jobs")
    .select("id")
    .eq("conversation_id", job.conversation_id)
    .eq("kind", "reply")
    .neq("id", job.id)
    .in("status", ["queued", "running"])
    .gte("created_at", job.created_at ?? new Date(0).toISOString())
    .limit(1)
    .maybeSingle();
  if (newer) {
    await finish(admin, job.id, job.lease_token, {
      status: "discarded",
      error: `merged_into:${(newer as { id: string }).id}`,
    });
    return "discarded";
  }
  // Mensagens quase simultâneas podem gerar turnos fora de ordem (o da última
  // mensagem criado antes do da primeira). Sem turno mais novo na fila, este é o
  // que responde por todas: passa a apontar para a mensagem mais recente do
  // cliente, senão o envio seria barrado como obsoleto e ninguém responderia.
  if (job.kind === "reply") {
    await adoptLatestInbound(admin, job);
  }
  const { data: playbook } = await admin
    .from("sdr_playbooks")
    .select("*")
    .eq("id", enr.playbook_id)
    .maybeSingle();
  if (!playbook?.enabled) {
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "playbook_disabled" });
    return "skipped";
  }

  // Áudios do cliente viram texto antes da Lia ler a conversa.
  if (job.kind === "reply") {
    const { ensureAudioTranscripts } = await import("@/lib/whatsapp/inbound-media.server");
    await ensureAudioTranscripts(admin, conv.id).catch((e: Error) =>
      console.error("[sdr] transcrição de áudio falhou", e.message),
    );
  }
  const { data: msgs } = await admin
    .from("whatsapp_messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const history: ConversationMessage[] = ((msgs ?? []) as ConversationMessage[])
    .filter((m) => (m.body ?? "").trim())
    .reverse();
  // Atendimento automático (robô/URA): encerra este turno sem responder ao robô.
  if (job.kind === "reply") {
    const lastInbound = [...history].reverse().find((m) => m.direction === "inbound");
    if (
      lastInbound &&
      (isAutoResponder(String(lastInbound.body ?? "")) ||
        repeatsIdenticalInbound(history as { direction: string; body?: string | null }[]))
    ) {
      await admin
        .from("sdr_enrollments")
        .update({ follow_up_at: null, cancel_reason: "auto_responder" })
        .eq("id", enr.id)
        .eq("workspace_id", job.workspace_id);
      await finish(admin, job.id, job.lease_token, { status: "skipped", error: "auto_responder" });
      await recordSdrAction(admin, {
        workspace_id: job.workspace_id,
        enrollment_id: enr.id,
        job_id: job.id,
        kind: "auto_responder",
        status: "success",
      });
      return "skipped";
    }
  }
  // Mensagem destinada a outra pessoa: não responde nem agenda retomada.
  if (job.kind === "reply") {
    const lastInbound = [...history].reverse().find((m) => m.direction === "inbound");
    if (lastInbound && isOffTopic(String(lastInbound.body ?? ""))) {
      await admin
        .from("sdr_enrollments")
        .update({ follow_up_at: null })
        .eq("id", enr.id)
        .eq("workspace_id", job.workspace_id);
      await finish(admin, job.id, job.lease_token, { status: "skipped", error: "off_topic" });
      await recordSdrAction(admin, {
        workspace_id: job.workspace_id,
        enrollment_id: enr.id,
        job_id: job.id,
        kind: "off_topic",
        status: "success",
      });
      return "skipped";
    }
  }
  const agentConfig = configFromRow(playbook as Record<string, unknown>);
  const { offers, materials } = scopeKnowledge(
    agentConfig,
    await loadKnowledge(admin, job.workspace_id),
  );
  if (!offers.length) {
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: "no_approved_offers",
    });
    return "skipped";
  }
  const questions = hasTool(agentConfig, "qualify")
    ? await loadQuestions(admin, job.workspace_id, playbook.questionnaire_id)
    : [];
  // Persona da versão PUBLICADA (rascunho nunca afeta produção).
  const { data: agentVersion } = await admin
    .from("sdr_agent_versions")
    .select("id, persona, tool_config")
    .eq("playbook_id", playbook.id)
    .eq("status", "published")
    .maybeSingle();
  const persona = parsePersona(agentVersion?.persona);

  // Ferramentas: só as ligadas na versão PUBLICADA e prontas executam.
  const toolCfg = parseToolConfig(agentVersion?.tool_config);
  const effects = emptyEffects();
  let toolCtx: ToolCtx | null = null;
  let selected = selectTools(null, {
    calendar: { ok: false },
    crmLinked: false,
    questionnaire: false,
    materials: false,
    assignee: false,
  });
  if (toolCfg?.enabled_tools.length && deps.toolEnv) {
    const env = await deps.toolEnv(admin, {
      workspaceId: job.workspace_id,
      playbookId: playbook.id,
      agentVersionId: agentVersion?.id ?? null,
      jobId: job.id,
      conversationId: conv.id,
      enrollmentId: enr.id,
      scheduling: toolCfg.scheduling,
    });
    selected = selectTools(toolCfg, {
      calendar: env.calendarFacts,
      crmLinked: !!(enr.lead_id || enr.contact_id || enr.deal_id),
      questionnaire: !!playbook.questionnaire_id && questions.length > 0,
      materials: materials.length > 0,
      assignee: !!agentConfig.assigned_to,
    });
    toolCtx = {
      mode: "live",
      jobId: job.id,
      jobKind: job.kind,
      workspaceId: job.workspace_id,
      playbookId: playbook.id,
      agentVersionId: agentVersion?.id ?? null,
      conversation: {
        id: conv.id,
        phone: conv.contact_phone ?? enr.contact_phone ?? "",
        leadId: enr.lead_id ?? conv.lead_id ?? null,
        contactId: enr.contact_id ?? conv.contact_id ?? null,
        companyId: enr.company_id ?? null,
        dealId: enr.deal_id ?? null,
        campaignId: enr.campaign_id ?? null,
        enrollmentId: enr.id,
      },
      history,
      config: toolCfg,
      exposed: selected.ids,
      scheduling: toolCfg.scheduling,
      calendar: env.calendar,
      store: env.store,
      offers,
      materials,
      kbSources: agentConfig.kb_sources,
      attachMaterials: agentConfig.guardrails.attach_materials,
      questions,
      assigneeId: agentConfig.assigned_to,
      now: () => Date.now(),
      newEventId,
      effects,
    };
  }
  // Escolha curta do cliente ("6a", "sexta", "2") resolvida contra as opções
  // vigentes gravadas — nunca contra horários escritos pela IA.
  let choiceHint: string | null = null;
  if (selected.directBooking && job.kind === "reply") {
    const lastIn = [...history].reverse().find((m) => m.direction === "inbound");
    const { data: offerRows } = await admin
      .from("sdr_slot_offers")
      .select("offer_set, position, start_at, status")
      .eq("conversation_id", conv.id)
      .eq("status", "offered")
      .order("offer_set", { ascending: false })
      .limit(6);
    const rows = (offerRows ?? []) as { offer_set: number; position: number; start_at: string }[];
    const top = rows[0]?.offer_set;
    const current = rows
      .filter((r) => r.offer_set === top)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        position: r.position,
        start: r.start_at,
        timezone:
          (toolCfg?.scheduling as { timezone?: string } | undefined)?.timezone ??
          "America/Sao_Paulo",
      }));
    const pos = lastIn ? resolveChoice(lastIn.body, current) : null;
    if (pos)
      choiceHint = `[sistema] A última mensagem do cliente escolhe a opção ${pos} vigente. Se já tiver o e-mail do cliente, chame calendar.book com option=${pos}; se não tiver, peça o e-mail ANTES de reservar e NÃO diga que está marcado.`;
  }
  const system = buildSystemPrompt({
    persona,
    config: agentConfig,
    origin: enr.campaign_id ? "prospecting" : "inbound",
    offers,
    materials,
    questions,
    bookingAvailable: false,
    directBooking: selected.directBooking,
    toolsAvailable: selected.specs.length > 0,
    extraInstructions:
      [
        playbook.qualification_prompt,
        job.kind === "follow_up"
          ? "Este é um follow-up: retome a conversa com gentileza, sem pressão."
          : null,
        choiceHint,
      ]
        .filter(Boolean)
        .join("\n") || null,
  });

  await admin
    .from("sdr_turn_jobs")
    .update({ ai_started_at: new Date().toISOString(), agent_version_id: agentVersion?.id ?? null })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token);
  const ai = await deps.callAgent({
    workspaceId: job.workspace_id,
    system,
    history,
    ...(toolCtx && selected.specs.length
      ? { tools: selected.specs, executeTool: makeExecutor(toolCtx) }
      : {}),
  });
  await admin
    .from("sdr_turn_jobs")
    .update({ ai_finished_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token);
  if (!ai.ok) {
    if (ai.retryable) {
      await finish(admin, job.id, job.lease_token, {
        status: "queued",
        lease_until: new Date(Date.now() + retryDelayMs(job.attempts ?? 1)).toISOString(),
        error: ai.error,
      });
      return "retry";
    }
    await finish(admin, job.id, job.lease_token, {
      status: "failed",
      error: ai.error,
      block_category: "technical",
    });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: ai.status === 402 || ai.status === 403 ? "ai_paused" : "ai_failed",
      status: "failed",
      error: ai.error,
    });
    await tripBreakerIfNeeded(admin, job.workspace_id);
    return "failed";
  }
  const out = validateAgentOutput(ai.output, { offers, materials });
  if ("error" in out) {
    await finish(admin, job.id, job.lease_token, { status: "failed", error: out.error });
    return "failed";
  }
  // Abertura burocrática ("Entendi que...") é removida quando sobra mensagem completa.
  out.reply = stripStockOpener(out.reply);
  // Valores em dinheiro: reescreve sozinha uma vez antes de recorrer a um humano.
  if (out.warnings.includes(PRICE_WARNING) && out.reply) {
    const alt = await rewriteReply(
      deps,
      job.workspace_id,
      system,
      history,
      "Não mencione preços, valores ou números em reais. Diga que os valores são tratados na reunião/proposta e siga a conversa.",
    );
    if (alt && !mentionsPrice(alt)) {
      out.reply = alt;
      out.warnings = out.warnings.filter((w) => w !== PRICE_WARNING);
    }
  }
  // Uma pergunta por mensagem: reescreve sozinha uma vez se vier mais de uma.
  if (countQuestions(out.reply) > 1) {
    const alt = await rewriteReply(
      deps,
      job.workspace_id,
      system,
      history,
      "Sua resposta fez mais de uma pergunta. Reescreva com no máximo UMA pergunta, a mais importante para avançar.",
    );
    if (alt && countQuestions(alt) <= 1 && !mentionsPrice(alt)) out.reply = alt;
  }
  // Efeitos registrados pelas ferramentas prevalecem sobre a intenção textual.
  if (effects.answers.length) out.answers = [...(out.answers as unknown[]), ...effects.answers];
  if (effects.materialIds.length) {
    out.material_ids = [...new Set([...out.material_ids, ...effects.materialIds])];
    if (out.intent === "continue") out.intent = "send_material";
  }
  if (effects.handoff) {
    out.intent = "handoff";
    out.handoff_reason = effects.handoff;
  }
  // Pedido explícito de parar sempre vira opt-out (com confirmação ao cliente).
  if (job.kind === "reply" && !effects.optOut && out.intent !== "opt_out") {
    const lastIn = [...history].reverse().find((m) => m.direction === "inbound");
    const lastText = String((lastIn as { body?: unknown } | undefined)?.body ?? "");
    const phrases =
      ((playbook as Record<string, unknown>).opt_out_phrases as string[] | null) ?? [];
    if (detectOptOut(lastText, phrases)) out.intent = "opt_out";
  }
  // "Sem disponibilidade no horário pedido" não é motivo de passar para humano:
  // a Lia segue oferecendo horários (caso Gilzon, 21/10).
  if (
    out.intent === "handoff" &&
    !effects.handoff &&
    isUnavailabilityHandoff(out.handoff_reason) &&
    /\?/.test(out.reply)
  ) {
    out.intent = "continue";
    out.warnings.push("Handoff por indisponibilidade de horário ignorado: Lia segue agendando.");
  }
  if (effects.optOut) out.intent = "opt_out";
  else if (out.intent === "opt_out") {
    // Agradecimento/despedida não é descadastro: segue a conversa com resposta cordial.
    const lastIn = [...history].reverse().find((m) => m.direction === "inbound");
    const lastText = String((lastIn as { body?: unknown } | undefined)?.body ?? "");
    if (
      !guardModelOptOut(
        lastText,
        ((playbook as Record<string, unknown>).opt_out_phrases as string[] | null) ?? [],
      )
    ) {
      out.intent = "continue";
      if (!out.reply) out.reply = "Eu que agradeço! Qualquer coisa, é só me chamar por aqui.";
      out.warnings.push("Opt-out ignorado: mensagem era só agradecimento/despedida.");
    }
  }
  // Terceiros (não é o responsável): indicação, saída da empresa, número de outra pessoa.
  let wrongContact = false;
  let closeReason: string | null = null;
  let referralToSave: Referral | null = null;
  let stopFollowUps = false;
  // Handoff (pedido de humano, negociação) e agendamento nunca são sobrescritos.
  if (job.kind === "reply" && out.intent !== "schedule_meeting" && out.intent !== "handoff") {
    const lastIn = [...history].reverse().find((m) => m.direction === "inbound");
    const lastText = String((lastIn as { body?: unknown } | undefined)?.body ?? "");
    const tp = decideThirdParty(history as { direction: string; body?: string | null }[]);
    if (isPostCloseQuestion(history as { direction: string; body?: string | null }[])) {
      // Já encerramos e o cliente perguntou algo ("precisa de algo em infra?"):
      // responde que não e se despede, uma única vez (caso Wiltomar, 21/10).
      wrongContact = true;
      closeReason = "post_close";
      out.intent = "continue";
      out.material_ids = [];
      out.answers = [];
      out.reply = POST_CLOSE_REPLY;
    } else if (tp.action !== "none") {
      out.intent = "continue";
      out.material_ids = [];
      out.answers = [];
      out.reply = tp.reply;
      if (tp.action === "close" || tp.action === "save_referral") {
        wrongContact = true;
        closeReason = tp.reason;
      }
      if (tp.action === "save_referral") referralToSave = tp.referral;
    } else if (outOfIcpRole(lastText)) {
      wrongContact = true;
      closeReason = "out_of_icp";
      out.intent = "continue";
      out.material_ids = [];
      out.answers = [];
      out.reply = OUT_OF_ICP_CLOSE;
    } else if (asksContactSource(lastText)) {
      // Resposta honesta e fixa; sem retomadas automáticas depois disso.
      stopFollowUps = true;
      out.intent = "continue";
      out.material_ids = [];
      out.reply = CONTACT_SOURCE_REPLY;
    } else if (isWrongContact(lastText)) {
      wrongContact = true;
      closeReason = "wrong_contact";
      out.intent = "continue";
      out.material_ids = [];
      out.reply =
        "Peço desculpas pelo incômodo, devo ter anotado o contato errado. Obrigada pelo aviso e tenha um ótimo dia!";
    }
  }

  // Opt-out em resposta: confirma ao cliente que não haverá novos contatos e
  // só então marca o opt-out (caso Ricardo Oliveira, 21/10).
  if (job.kind === "reply" && out.intent === "opt_out" && !wrongContact) {
    wrongContact = true;
    closeReason = "opt_out";
    out.intent = "continue";
    out.material_ids = [];
    out.answers = [];
    out.reply = OPT_OUT_CONFIRM;
  }

  // Garantias da conversa (casos 16–19/10): nome, repetição, reunião recusada,
  // decisor já identificado, "não é o momento" e material prometido sem envio.
  let corporatePhone: string | null = null;
  if (job.kind === "reply" && !wrongContact && out.intent !== "opt_out") {
    const h = history as { direction: string; body?: string | null }[];
    const lastIn = [...h].reverse().find((m) => m.direction === "inbound");
    const lastText = String(lastIn?.body ?? "");
    out.reply = dedupeRepeatedWords(out.reply);
    out.reply = fixVocative(out.reply, [correctedName(h) ?? "", greetingName(h) ?? ""]);
    corporatePhone = extractCorporatePhone(lastText);
    if (out.intent !== "handoff" && out.intent !== "schedule_meeting") {
      if (notTheMoment(lastText) && offersToKeepContact(out.reply)) {
        out.reply = NOT_NOW_CLOSE;
        out.material_ids = [];
      } else if (refusedMeeting(h) && showsBusinessInterest(h)) {
        out.intent = "handoff";
        out.handoff_reason =
          "Cliente recusou reunião, mas pediu informações/orçamento por mensagem: atendimento humano.";
      } else if (
        claimsMaterialSent(out.reply) &&
        !(agentConfig.guardrails.attach_materials && out.material_ids.length)
      ) {
        out.intent = "handoff";
        out.reply = MATERIAL_HANDOFF_REPLY;
        out.handoff_reason =
          "Cliente pediu material e o envio automático de materiais não está disponível para este agente.";
      } else if (selfIdentifiedResponsible(h) && asksDecisionMaker(out.reply)) {
        const alt = await rewriteReply(
          deps,
          job.workspace_id,
          system,
          history,
          "O cliente JÁ disse que é o responsável pela área de TI. Não pergunte cargo, se é decisor ou quem decide. Siga a conversa com a próxima pergunta útil.",
        );
        if (alt && !asksDecisionMaker(alt) && !mentionsPrice(alt))
          out.reply = dedupeRepeatedWords(alt);
      }
    }
  }

  // Qualificação canônica: mesmo questionário, cálculo e linha da Prospecção.
  const inbound = history.filter((m) => m.direction === "inbound");
  const target = enr.lead_id
    ? { entity: "lead" as const, id: enr.lead_id as string }
    : enr.contact_id
      ? { entity: "contact" as const, id: enr.contact_id as string }
      : null;
  let canonical: CanonicalScore | null = null;
  let qualificationPayload: Record<string, unknown> | null = null;
  let evidence: Record<string, unknown>[] = [];
  if (playbook.questionnaire_id && target && questions.length && hasTool(agentConfig, "qualify")) {
    const existing = await loadQualification(
      admin,
      job.workspace_id,
      playbook.questionnaire_id,
      target,
    );
    const { accepted, rejected } = acceptAnswers(questions, out.answers, inbound);
    out.warnings.push(...rejected.slice(0, 5));
    const merged = mergeAnswers(existing?.answers as Record<string, unknown> | null, accepted);
    const icp =
      target.entity === "lead" ? await scopedIcpFit(admin, job.workspace_id, target.id) : null;
    canonical = scoreCanonical(questions, merged.answers, icp);
    if (merged.added.length) {
      qualificationPayload = {
        id: existing?.id ?? null,
        expected_updated_at: existing?.updated_at ?? null,
        expected_answers: existing?.answers ?? {},
        questionnaire_id: playbook.questionnaire_id,
        entity: target.entity,
        entity_id: target.id,
        answers: merged.answers,
        score: canonical.score,
        questionnaire_points: canonical.unified.questionnairePoints,
        icp_points: canonical.unified.icpPoints,
        total_score: canonical.unified.total,
      };
      evidence = merged.added.map((a) => ({
        field: a.label.slice(0, 80),
        question_id: a.question_id,
        value: Array.isArray(a.value) ? a.value.join(" | ") : String(a.value),
        message_id: a.message_id,
        excerpt: a.excerpt,
      }));
    }
  }
  const offerNames = offers.filter((o) => out.offer_keys.includes(o.offer_key)).map((o) => o.name);
  const qualified = qualifiesForOpportunity({
    canonical,
    minTotal: playbook.opportunity_min_score ?? 60,
    offerKeys: out.offer_keys,
    intent: out.intent,
  });
  const optOut = out.intent === "opt_out";
  const enrollmentPatch: Record<string, unknown> = {
    ...(out.offer_keys.length ? { offers: out.offer_keys } : {}),
    ...(optOut
      ? {
          status: "opted_out",
          commercial_stage: "opted_out",
          opted_out_at: new Date().toISOString(),
          cancel_reason: "opt_out",
          follow_up_at: null,
        }
      : {}),
  };

  // Compare-and-set: nada é gravado se lease, dono, versão ou workspace mudaram durante a IA.
  const { data: commit, error: cErr } = await admin.rpc("sdr_commit_turn", {
    p_job: job.id,
    p_lease: job.lease_token,
    p_evidence: evidence,
    p_qualification: qualificationPayload,
    p_enrollment: Object.keys(enrollmentPatch).length ? enrollmentPatch : null,
    p_job_patch: optOut ? { status: "skipped", error: "opt_out" } : null,
  });
  if (cErr) throw new Error(cErr.message);
  if (commit !== "ok") {
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: String(commit) });
    return "discarded";
  }

  if (optOut) {
    await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "opt_out",
      status: "success",
    });
    return "opt_out";
  }

  if (qualified && !agentConfig.guardrails.require_human_for_opportunity) {
    if ((await guard(admin, job)) !== "ok") return "discarded";
    await deps.ensureOpportunity(admin, {
      workspaceId: job.workspace_id,
      enrollment: enr,
      title: `SDR · ${offerNames.join(" + ")}`,
      offerNames,
    });
  }

  if (out.intent === "handoff" && hasTool(agentConfig, "handoff")) {
    if ((await guard(admin, job)) !== "ok") return "discarded";
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: "handoff",
      draft_text: out.reply || null,
    });
    await deps.handoffToHuman(admin, {
      workspaceId: job.workspace_id,
      enrollmentId: enr.id,
      conversationId: conv.id,
      reason: out.handoff_reason || "Solicitado pelo agente",
      actorUserId: null,
    });
    return "handoff";
  }

  const composed = await composeOutgoing(admin, {
    workspaceId: job.workspace_id,
    reply: out.reply,
    intent: out.intent,
    materialIds: out.material_ids,
    attachMaterials: agentConfig.guardrails.attach_materials,
    meeting: effects.meeting,
  });
  const payload: DraftPayload = {
    intent: out.intent,
    offer_keys: out.offer_keys,
    material_ids: composed.materials.map((m) => m.id),
    planned_stage:
      effects.meeting?.status === "confirmed"
        ? "meeting_booked"
        : nextStage(enr.commercial_stage as CommercialStage, out.intent, qualified),
    warnings: out.warnings,
    booking_url: null,
    tool_trace: effects.trace.map((t) => ({ tool: t.tool, status: t.status })),
  };
  const autoAllowed =
    settings.auto_send_enabled &&
    playbook.mode === "auto" &&
    blockingWarnings(out.warnings).length === 0 &&
    // Horário de prospecção vale só para retomadas; respostas seguem a qualquer hora.
    !(
      job.kind === "follow_up" &&
      isQuietHours(
        new Date(),
        settings.timezone,
        settings.quiet_hours_start,
        settings.quiet_hours_end,
      )
    );

  const { data: saved } = await admin
    .from("sdr_turn_jobs")
    .update({
      status: autoAllowed ? "running" : "drafted",
      draft_text: composed.text,
      draft_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("lease_token", job.lease_token)
    .select("id");
  if (!saved?.length) return "lease_lost";
  const applyOptOutNow = async () => {
    if (closeReason !== "opt_out") return;
    await admin
      .from("sdr_enrollments")
      .update({
        status: "opted_out",
        commercial_stage: "opted_out",
        opted_out_at: new Date().toISOString(),
        cancel_reason: "opt_out",
        follow_up_at: null,
      })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
    await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
  };
  if (!autoAllowed) {
    await admin.from("sdr_turn_jobs").update({ lease_token: null }).eq("id", job.id);
    // O pedido de parar vale mesmo que a confirmação fique para revisão.
    await applyOptOutNow();
    return "drafted";
  }
  const sendText = (text: string) =>
    deps.sendMessage(admin, {
      jobId: job.id,
      expectedStatus: "running",
      leaseToken: job.lease_token,
      text,
      actorUserId: null,
    });
  let sent = await sendText(composed.text);
  if (!sent.ok && sent.reason === "repetition_detected") {
    // Autonomia: reescreve uma vez sem repetir a última mensagem, em vez de pedir aprovação.
    const alt = await rewriteReply(
      deps,
      job.workspace_id,
      system,
      history,
      "A resposta ficou idêntica à sua mensagem anterior. Escreva outra, diferente, que avance a conversa considerando todas as mensagens do cliente.",
    );
    if (alt) {
      const again = await composeOutgoing(admin, {
        workspaceId: job.workspace_id,
        reply: alt,
        intent: out.intent,
        materialIds: out.material_ids,
        attachMaterials: agentConfig.guardrails.attach_materials,
        meeting: effects.meeting,
      });
      await admin
        .from("sdr_turn_jobs")
        .update({ draft_text: again.text })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token);
      sent = await sendText(again.text);
    }
  }
  if (!sent.ok) {
    // Descarta trabalho obsoleto; demais falhas viram rascunho para revisão humana.
    const obsolete = [
      "owner_not_ai",
      "stale_version",
      "enrollment_inactive",
      "lease_lost",
    ].includes(sent.reason);
    await admin
      .from("sdr_turn_jobs")
      .update({
        status: obsolete ? "discarded" : "drafted",
        error: sent.reason,
        block_category: sent.category ?? null,
        lease_token: null,
      })
      .eq("id", job.id)
      .in("status", ["running"]);
    await applyOptOutNow();
    return obsolete ? "discarded" : "drafted";
  }
  if (corporatePhone && target) {
    const { saveCorporatePhone } = await import("./third-party.server");
    const st = await saveCorporatePhone(admin, {
      workspaceId: job.workspace_id,
      ownerId: (enr.owner_id as string | null) ?? null,
      target,
      companyId: (enr.company_id as string | null) ?? null,
      phoneE164: corporatePhone,
    }).catch(() => "failed" as const);
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "corporate_phone_saved",
      status: st === "failed" ? "failed" : "success",
      payload: { phone: corporatePhone, result: st },
    });
  }
  if (referralToSave) {
    const { saveReferral } = await import("./third-party.server");
    const saved = await saveReferral(admin, {
      workspaceId: job.workspace_id,
      ownerId: enr.owner_id as string,
      referral: referralToSave,
      referrerLabel: conv.contact_phone ?? "contato da campanha",
      companyId: (enr.company_id as string | null) ?? null,
      referrer: target,
    });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "referral_saved",
      status: saved.status === "failed" ? "failed" : "success",
      payload: { ...saved, phone: referralToSave.phoneE164, name: referralToSave.name },
      error: saved.status === "failed" ? saved.error : null,
    });
  }
  if (wrongContact) {
    const thirdParty =
      closeReason === "left_company" ||
      closeReason === "not_this_person" ||
      closeReason === "out_of_icp" ||
      closeReason === "post_close";
    await admin
      .from("sdr_enrollments")
      .update(
        thirdParty
          ? { status: "paused", cancel_reason: closeReason, follow_up_at: null }
          : {
              status: "opted_out",
              commercial_stage: "opted_out",
              opted_out_at: new Date().toISOString(),
              cancel_reason: closeReason === "opt_out" ? "opt_out" : "wrong_contact",
              follow_up_at: null,
            },
      )
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
    await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: thirdParty ? "closed_third_party" : "opt_out",
      status: "success",
      payload: { reason: closeReason },
    });
  }
  if (stopFollowUps && !wrongContact) {
    await admin
      .from("sdr_enrollments")
      .update({ follow_up_at: null, cancel_reason: "asked_contact_source" })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
  }
  return "sent";
}

/** Agenda follow-ups vencidos como trabalhos (só dentro da janela de 24 h). */
async function scheduleFollowUps(
  admin: Admin,
  limit: number,
  workspaceIds: string[],
): Promise<number> {
  const { isWithinServiceWindow } = await import("@/lib/whatsapp/meta-channel.server");
  const { data: due } = await admin
    .from("sdr_enrollments")
    .select("id, workspace_id, conversation_id, follow_up_count, commercial_stage")
    .eq("status", "active")
    .in("workspace_id", workspaceIds)
    .lte("follow_up_at", new Date().toISOString())
    .limit(limit);
  let n = 0;
  for (const e of due ?? []) {
    if (!e.conversation_id) continue;
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("ai_owner, ai_version, last_inbound_at, status")
      .eq("id", e.conversation_id)
      .maybeSingle();
    const clear = { follow_up_at: null };
    // Conversa fechada na Inbox não recebe retomada automática.
    if (!conv || conv.ai_owner !== "ai" || conv.status === "closed") {
      await admin.from("sdr_enrollments").update(clear).eq("id", e.id);
      continue;
    }
    if (!isWithinServiceWindow(conv.last_inbound_at)) {
      // Fora da janela exigiria novo template: nenhuma tentativa automática.
      await admin.from("sdr_enrollments").update(clear).eq("id", e.id);
      await recordSdrAction(admin, {
        workspace_id: e.workspace_id,
        enrollment_id: e.id,
        kind: "follow_up",
        status: "skipped",
        error: "window_closed",
      });
      continue;
    }
    const count = (e.follow_up_count ?? 0) + 1;
    await admin.from("sdr_turn_jobs").upsert(
      {
        workspace_id: e.workspace_id,
        enrollment_id: e.id,
        conversation_id: e.conversation_id,
        kind: "follow_up",
        idem_key: followUpIdemKey(e.id, count),
        conversation_version: conv.ai_version,
      },
      { onConflict: "workspace_id,idem_key", ignoreDuplicates: true },
    );
    await admin
      .from("sdr_enrollments")
      .update({ ...clear, follow_up_count: count })
      .eq("id", e.id);
    n++;
  }
  return n;
}

export async function tickSdr(admin: Admin, limit = 10, deps: WorkerDeps = defaultDeps) {
  // No-op quando nenhum workspace ligou o SDR: não lê fila, não chama IA, não envia.
  const { data: enabledRows, error: sErr } = await admin
    .from("sdr_workspace_settings")
    .select("workspace_id")
    .eq("enabled", true);
  if (sErr) throw new Error(sErr.message);
  const enabled = ((enabledRows ?? []) as { workspace_id: string }[]).map((r) => r.workspace_id);
  if (!enabled.length) return { disabled: true, claimed: 0 };
  const stranded = await sweepExhaustedJobs(admin, enabled);
  const meetings = await reconcileMeetings(admin, 50, enabled);
  const directMeetings = await reconcileDirectMeetings(admin, enabled);
  const followUps = await scheduleFollowUps(admin, 50, enabled);
  const aiQuestionHandoffs = await handoffSilentAfterAiQuestion(admin, enabled, deps).catch(
    () => 0,
  );
  // Tempo de aguardo do cliente: respostas ficam adiadas (lease_until futuro).
  // O despertar do enfileiramento espera aqui até a mais próxima vencer.
  await waitForDueReply(admin, enabled);
  const results: Record<string, number> = {};
  let claimed = 0;
  // Rodadas extras: quando um turno antigo é agrupado no novo, o novo sai na mesma execução.
  for (let round = 0; round < 3; round++) {
    const { data: jobs, error } = await admin.rpc("sdr_claim_jobs", {
      p_limit: limit,
      p_lease_seconds: LEASE_SECONDS,
    });
    if (error) throw new Error(error.message);
    if (!jobs?.length) break;
    claimed += jobs.length;
    let merged = 0;
    for (const job of jobs as Job[]) {
      let r: string;
      try {
        r = await processJob(admin, job, deps);
      } catch (e) {
        r = "error";
        await finish(admin, job.id, job.lease_token, {
          status: "queued",
          lease_until: new Date(Date.now() + retryDelayMs(job.attempts ?? 1)).toISOString(),
          error: (e as Error).message.slice(0, 300),
        });
      }
      if (r === "discarded") merged++;
      results[r] = (results[r] ?? 0) + 1;
    }
    if (!merged) break;
  }
  return {
    meetings,
    directMeetings,
    followUps,
    aiQuestionHandoffs,
    stranded,
    claimed,
    ...results,
  };
}

/** Tempo sem resposta depois de "você é uma IA?" até passar a uma pessoa. */
export const AI_QUESTION_SILENCE_MS = 30 * 60_000;

/**
 * Cliente perguntou se fala com uma IA, a Lia respondeu e ele parou de
 * responder: a conversa passa para uma pessoa da equipe (retomadas canceladas).
 */
async function handoffSilentAfterAiQuestion(
  admin: Admin,
  workspaceIds: string[],
  deps: WorkerDeps,
): Promise<number> {
  const now = Date.now();
  const { data: rows } = await admin
    .from("whatsapp_messages")
    .select("conversation_id, body, created_at")
    .in("workspace_id", workspaceIds)
    .eq("direction", "inbound")
    .gte("created_at", new Date(now - 3 * 86_400_000).toISOString())
    .lte("created_at", new Date(now - AI_QUESTION_SILENCE_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  const candidates = new Map<string, string>();
  for (const r of (rows ?? []) as {
    conversation_id: string;
    body: string | null;
    created_at: string;
  }[])
    if (!candidates.has(r.conversation_id) && isAiIdentityQuestion(String(r.body ?? "")))
      candidates.set(r.conversation_id, r.created_at);
  let n = 0;
  for (const [convId, askedAt] of candidates) {
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("id, workspace_id, ai_owner, sdr_enrollment_id")
      .eq("id", convId)
      .maybeSingle();
    if (!conv || conv.ai_owner !== "ai" || !conv.sdr_enrollment_id) continue;
    const { data: later } = await admin
      .from("whatsapp_messages")
      .select("direction, created_at")
      .eq("conversation_id", convId)
      .gt("created_at", askedAt)
      .order("created_at", { ascending: true })
      .limit(20);
    const after = (later ?? []) as { direction: string; created_at: string }[];
    if (after.some((m) => m.direction === "inbound")) continue; // cliente voltou a falar
    const answered = after.find((m) => m.direction !== "inbound");
    if (!answered || now - new Date(answered.created_at).getTime() < AI_QUESTION_SILENCE_MS)
      continue;
    await deps.handoffToHuman(admin, {
      workspaceId: conv.workspace_id,
      enrollmentId: conv.sdr_enrollment_id,
      conversationId: convId,
      reason:
        "Cliente perguntou se estava falando com uma IA e parou de responder: atendimento humano.",
      actorUserId: null,
    });
    n++;
  }
  return n;
}

/** Espera (até 60 s) a resposta adiada mais próxima vencer o tempo de aguardo. */
async function waitForDueReply(admin: Admin, workspaceIds: string[]) {
  const now = Date.now();
  const { data } = await admin
    .from("sdr_turn_jobs")
    .select("lease_until")
    .eq("status", "queued")
    .eq("kind", "reply")
    .eq("attempts", 0)
    .in("workspace_id", workspaceIds)
    .gt("lease_until", new Date(now).toISOString())
    .lte("lease_until", new Date(now + MAX_WAIT_MS).toISOString())
    .order("lease_until", { ascending: true })
    .limit(1)
    .maybeSingle();
  const due = data?.lease_until ? new Date(data.lease_until as string).getTime() : null;
  if (due) await new Promise((r) => setTimeout(r, Math.min(MAX_WAIT_MS, due - now + 500)));
}

/**
 * Trabalhos que esgotaram as tentativas não ficam presos em silêncio: viram
 * falha técnica com alerta para o operador retomar de forma controlada.
 */
async function sweepExhaustedJobs(admin: Admin, workspaceIds: string[]): Promise<number> {
  const now = new Date().toISOString();
  const { data: rows } = await admin
    .from("sdr_turn_jobs")
    .select("id, workspace_id, enrollment_id, status, attempts, lease_until")
    .in("workspace_id", workspaceIds)
    .in("status", ["queued", "running"])
    .gte("attempts", 3)
    .lte("lease_until", now)
    .limit(50);
  let n = 0;
  for (const j of rows ?? []) {
    const { data: upd } = await admin
      .from("sdr_turn_jobs")
      .update({
        status: "failed",
        error: "max_attempts",
        block_category: "technical",
        lease_token: null,
        updated_at: now,
      })
      .eq("id", j.id)
      .eq("status", j.status)
      .select("id");
    if (!upd?.length) continue;
    n++;
    await recordSdrAction(admin, {
      workspace_id: j.workspace_id,
      enrollment_id: j.enrollment_id,
      job_id: j.id,
      kind: "technical_alert",
      status: "failed",
      error: "max_attempts",
    });
  }
  return n;
}

/**
 * Reuniões do agendamento direto com resposta incerta do provedor: consulta o
 * evento pelo id determinístico e só então confirma ou marca falha. Nunca recria.
 */
async function reconcileDirectMeetings(admin: Admin, workspaceIds: string[]): Promise<number> {
  const { data: rows, error } = await admin
    .from("sdr_meetings")
    .select(
      "id, workspace_id, playbook_id, conversation_id, enrollment_id, calendar_account_id, status, start_at, end_at, provider_event_id, meet_link, idem_key, host_user_id, timezone",
    )
    .eq("status", "reconcile")
    .in("workspace_id", workspaceIds)
    .limit(20);
  if (error) throw new Error(error.message);
  let n = 0;
  const { createDbToolStore, createGoogleCalendar, primaryCalendarId } =
    await import("./tools/store.server");
  const { reconcileMeeting } = await import("./tools/dispatcher");
  for (const m of rows ?? []) {
    const store = createDbToolStore(admin, {
      workspaceId: m.workspace_id,
      playbookId: m.playbook_id,
      agentVersionId: null,
      jobId: null,
      conversationId: m.conversation_id,
      enrollmentId: m.enrollment_id,
    });
    const sched = {
      host_user_id: m.host_user_id,
      calendar_account_id: m.calendar_account_id,
      timezone: m.timezone,
    } as ScheduleConfig;
    const cal = createGoogleCalendar(
      admin,
      m.workspace_id,
      sched,
      await primaryCalendarId(admin, m.workspace_id, m.calendar_account_id),
    );
    const r = await reconcileMeeting(store, cal, m);
    if (r === "confirmed" && m.enrollment_id)
      await store.setEnrollment(m.enrollment_id, {
        meeting_status: "confirmed",
        commercial_stage: "meeting_booked",
        follow_up_at: null,
        cancel_reason: "meeting",
      });
    if (r !== "still_pending") n++;
  }
  return n;
}
