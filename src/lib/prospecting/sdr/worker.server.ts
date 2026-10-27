import { loadChannelRuntime, assertChannelRuntime } from "./channel-runtime.server";
import { personaForChannel } from "./channel-identity";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
// Execução do SDR: follow-ups, turnos com lease e conciliação de reuniões.
// Nenhuma transação SQL fica aberta durante a chamada de IA: o claim marca o
// trabalho e devolve; o envio recheca dono/versão antes de sair.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import { parsePersona } from "./persona";
import { configFromRow, hasTool, scopeKnowledge } from "./agent-config";
import { loadSdrAgentUserId } from "./agent-identity.server";
import { callSdrAgent } from "./agent.server";
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
import { isAiIdentityQuestion, repeatsIdenticalInbound } from "./conversation-guards";
import {
  effectiveState,
  parseState,
  stateJobIds,
  type ConversationState,
} from "./conversation-state";
import { resolveChoice } from "./booking-guard";
import { parseToolConfig, type ScheduleConfig } from "./tools/catalog";
import { emptyEffects, type ToolCtx } from "./tools/dispatcher";
import { makeExecutor, newEventId, selectTools } from "./tools/runtime";
import type { CalendarProvider, ToolStore } from "./tools/types";
import { decideTurn, regenerate } from "./turn";
import type { PromptContext } from "./agent.server";
import {
  followUpIdemKey,
  isQuietHours,
  nextStage,
  selectableMaterials,
  blockingWarnings,
  selectableOffers,
  sendGuard,
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
          p.enrollmentId,
          p.agentVersionId,
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
      .select(
        "id, workspace_id, ai_owner, ai_version, contact_id, lead_id, contact_phone, wa_phone_number_id",
      )
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
  try {
    await assertSalesWorker(admin, "sdr_enrollments", enr.id, [
      { table: "whatsapp_conversations", id: conv.id },
      ...(enr.lead_id ? [{ table: "leads", id: enr.lead_id }] : []),
      ...(enr.contact_id ? [{ table: "contacts", id: enr.contact_id }] : []),
    ]);
  } catch {
    await finish(admin, job.id, job.lease_token, {
      status: "failed",
      error: "permission_revoked",
      block_category: "technical",
    });
    return "failed";
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
  // Proteção técnica contra laço: a mesma mensagem longa recebida 2+ vezes
  // (robô repetindo menu) não gera nova resposta.
  if (
    job.kind === "reply" &&
    repeatsIdenticalInbound(history as { direction: string; body?: string | null }[])
  ) {
    await admin
      .from("sdr_enrollments")
      .update({ follow_up_at: null, cancel_reason: "auto_responder" })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "repeated_inbound" });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "auto_responder",
      status: "success",
      payload: { reason: "repeated_inbound" },
    });
    return "skipped";
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
  const sourcePersona = parsePersona(agentVersion?.persona);
  const channelInput = {
    workspaceId: job.workspace_id,
    channel: "whatsapp" as const,
    sourceKey: conv.wa_phone_number_id,
    agentId: playbook.id,
    origin: enr.campaign_id ? ("campaign" as const) : ("inbound" as const),
    snapshot: enr.channel_identity,
    assistantName: sourcePersona.assistant_name,
  };
  const channel = await loadChannelRuntime(admin, channelInput);
  if (channel.status === "blocked") {
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: channel.reason,
      block_category: "technical",
    });
    return "skipped";
  }
  if (channel.status === "active" && !enr.channel_identity) {
    const captured = await admin
      .from("sdr_enrollments")
      .update({ channel_identity: channel.identity })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id)
      .is("channel_identity", null);
    if (captured.error) throw new Error("Não foi possível registrar a identidade da conversa.");
    channelInput.snapshot = channel.identity;
  }
  const persona =
    channel.status === "active"
      ? personaForChannel(sourcePersona, channel.identity)
      : sourcePersona;
  const checkChannel = () => assertChannelRuntime(admin, channelInput);

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
    const agentUserId = await loadSdrAgentUserId(admin, job.workspace_id);
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
      agentUserId,
      now: () => Date.now(),
      newEventId,
      effects,
    };
  }
  // Escolha curta do cliente ("6a", "sexta", "2") resolvida contra as opções
  // vigentes gravadas — nunca contra horários escritos pela IA. Vira FATO.
  let choicePosition: number | null = null;
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
    choicePosition = lastIn ? resolveChoice(lastIn.body, current) : null;
  }
  const { state, version: stateVersion } = await loadConversationState(
    admin,
    job.workspace_id,
    enr,
  );
  const context = await loadPromptContext(admin, {
    workspaceId: job.workspace_id,
    enr,
    playbookName: (playbook.name as string | null) ?? null,
    scheduling: selected.directBooking ? (toolCfg?.scheduling ?? null) : null,
  });

  if (channel.status === "active") context.channelIdentity = channel.identity;

  await admin
    .from("sdr_turn_jobs")
    .update({ ai_started_at: new Date().toISOString(), agent_version_id: agentVersion?.id ?? null })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token);
  const decision = await decideTurn(
    {
      workspaceId: job.workspace_id,
      jobId: job.id,
      jobKind: job.kind,
      mode: "live",
      agentVersionId: agentVersion?.id ?? null,
      persona,
      config: agentConfig,
      offers,
      materials,
      questions,
      history,
      state,
      context,
      extraInstructions: (playbook.qualification_prompt as string | null) ?? null,
      optOutPhrases:
        ((playbook as Record<string, unknown>).opt_out_phrases as string[] | null) ?? [],
      tools: {
        specs: toolCtx ? selected.specs : [],
        executor: toolCtx && selected.specs.length ? makeExecutor(toolCtx, checkChannel) : null,
        effects,
        directBooking: selected.directBooking,
      },
      choicePosition,
      now: new Date(),
    },
    {
      callAgent: deps.callAgent,
      compose: (p) => composeOutgoing(admin, { workspaceId: job.workspace_id, ...p }),
    },
  );
  await admin
    .from("sdr_turn_jobs")
    .update({ ai_finished_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token);
  if (decision.kind === "ai_error") {
    if (decision.retryable) {
      await finish(admin, job.id, job.lease_token, {
        status: "queued",
        lease_until: new Date(Date.now() + retryDelayMs(job.attempts ?? 1)).toISOString(),
        error: decision.error,
      });
      return "retry";
    }
    await finish(admin, job.id, job.lease_token, {
      status: "failed",
      error: decision.error,
      block_category: "technical",
    });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: decision.status === 402 || decision.status === 403 ? "ai_paused" : "ai_failed",
      status: "failed",
      error: decision.error,
    });
    await tripBreakerIfNeeded(admin, job.workspace_id);
    return "failed";
  }
  if (decision.kind === "invalid") {
    await finish(admin, job.id, job.lease_token, { status: "failed", error: decision.error });
    return "failed";
  }
  const out = decision.out;
  const turnState = decision.state;

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
  const optOut = decision.optOut;
  const isHandoff = out.intent === "handoff" && hasTool(agentConfig, "handoff");
  // Nada a enviar (supressão estruturada, descadastro ou encerramento sem texto).
  const silent = !decision.text && !isHandoff;
  const closeNow = silent && decision.close ? decision.close : null;
  const suppressedAfterClose = turnState.suppress === "closed_no_reply_needed";
  const nowIso = new Date().toISOString();
  const enrollmentPatch: Record<string, unknown> = {
    ...(out.offer_keys.length ? { offers: out.offer_keys } : {}),
    ...(Object.keys(turnState.patch).length
      ? { conversation_state: turnState.patch, expected_state_version: stateVersion }
      : {}),
    ...(decision.noFollowUp || turnState.suppress ? { follow_up_at: null } : {}),
    ...(turnState.suppress === "auto_responder" ? { cancel_reason: "auto_responder" } : {}),
    ...(silent && optOut
      ? {
          status: "opted_out",
          commercial_stage: "opted_out",
          opted_out_at: nowIso,
          cancel_reason: "opt_out",
          follow_up_at: null,
        }
      : {}),
    ...(closeNow ? { status: "paused", cancel_reason: closeNow, follow_up_at: null } : {}),
    ...(suppressedAfterClose && state.closed
      ? { status: "paused", cancel_reason: state.closed.reason, follow_up_at: null }
      : {}),
  };
  const silentError = optOut
    ? "opt_out"
    : turnState.suppress
      ? `suppressed:${turnState.suppress}`
      : closeNow
        ? `closed:${closeNow}`
        : "empty_reply";

  const latestChannel = await loadChannelRuntime(admin, channelInput);
  if (latestChannel.status === "blocked") {
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: latestChannel.reason,
      block_category: "technical",
    });
    return "skipped";
  }
  // Compare-and-set: nada é gravado se lease, dono, versão, estado ou workspace mudaram durante a IA.
  const { data: commit, error: cErr } = await admin.rpc("sdr_commit_turn", {
    p_job: job.id,
    p_lease: job.lease_token,
    p_evidence: evidence,
    p_qualification: qualificationPayload,
    p_enrollment: Object.keys(enrollmentPatch).length ? enrollmentPatch : null,
    p_job_patch: silent
      ? {
          status: "skipped",
          error: silentError,
          draft_payload: { warnings: out.warnings, turn_trace: decision.trace },
        }
      : null,
  });
  if (cErr) throw new Error(cErr.message);
  if (commit !== "ok") {
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: String(commit) });
    return "discarded";
  }

  if (silent) {
    if (optOut || closeNow || suppressedAfterClose)
      await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
    if (decision.state.referral && closeNow)
      await saveReferralNow(admin, job, enr, conv, target, decision.state.referral);
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: optOut
        ? "opt_out"
        : turnState.suppress === "auto_responder"
          ? "auto_responder"
          : turnState.suppress === "addressed_to_other"
            ? "off_topic"
            : closeNow
              ? "closed_third_party"
              : "skipped",
      status: "success",
      payload: { reason: silentError },
    });
    return optOut ? "opt_out" : "skipped";
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

  if (isHandoff) {
    if ((await guard(admin, job)) !== "ok") return "discarded";
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: "handoff",
      draft_text: out.reply || null,
      draft_payload: { warnings: out.warnings, turn_trace: decision.trace },
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

  const payload: DraftPayload = {
    intent: out.intent,
    offer_keys: out.offer_keys,
    material_ids: decision.materials.map((m) => m.id),
    planned_stage:
      effects.meeting?.status === "confirmed"
        ? "meeting_booked"
        : nextStage(enr.commercial_stage as CommercialStage, out.intent, qualified),
    warnings: out.warnings,
    booking_url: null,
    tool_trace: effects.trace.map((t) => ({ tool: t.tool, status: t.status })),
    no_follow_up: decision.noFollowUp,
    turn_trace: decision.trace,
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
      draft_text: decision.text,
      draft_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("lease_token", job.lease_token)
    .select("id");
  if (!saved?.length) return "lease_lost";
  const applyOptOutNow = async () => {
    if (!optOut) return;
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
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "opt_out",
      status: "success",
    });
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
  let sent = await sendText(decision.text);
  if (!sent.ok && sent.reason === "repetition_detected") {
    // Proteção técnica: nova geração uma vez em vez de repetir a última mensagem.
    const alt = await regenerate(deps, {
      workspaceId: job.workspace_id,
      system: decision.system,
      history,
      feature: "sdr_agente",
      reason: "ficou idêntica à mensagem anterior enviada nesta conversa",
    });
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
  if (turnState.corporatePhone && target) {
    const { saveCorporatePhone } = await import("./third-party.server");
    const st = await saveCorporatePhone(admin, {
      workspaceId: job.workspace_id,
      ownerId: (enr.owner_id as string | null) ?? null,
      target,
      companyId: (enr.company_id as string | null) ?? null,
      phoneE164: turnState.corporatePhone,
    }).catch(() => "failed" as const);
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "corporate_phone_saved",
      status: st === "failed" ? "failed" : "success",
      payload: { phone: turnState.corporatePhone, result: st },
    });
  }
  if (turnState.referral) await saveReferralNow(admin, job, enr, conv, target, turnState.referral);
  if (optOut) {
    await applyOptOutNow();
    return "sent";
  }
  if (decision.close) {
    await admin
      .from("sdr_enrollments")
      .update({ status: "paused", cancel_reason: decision.close, follow_up_at: null })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
    await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "closed_third_party",
      status: "success",
      payload: { reason: decision.close },
    });
  } else if (decision.noFollowUp) {
    await admin
      .from("sdr_enrollments")
      .update({
        follow_up_at: null,
        ...(turnState.stopFollowUps ? { cancel_reason: "asked_contact_source" } : {}),
      })
      .eq("id", enr.id)
      .eq("workspace_id", job.workspace_id);
  }
  return "sent";
}

async function saveReferralNow(
  admin: Admin,
  job: Job,
  enr: Record<string, unknown>,
  conv: Record<string, unknown>,
  target: { entity: "lead" | "contact"; id: string } | null,
  referral: { name: string | null; phoneE164: string },
) {
  const { saveReferral } = await import("./third-party.server");
  const saved = await saveReferral(admin, {
    workspaceId: job.workspace_id,
    ownerId: enr.owner_id as string,
    referral,
    referrerLabel: (conv.contact_phone as string | null) ?? "contato da campanha",
    companyId: (enr.company_id as string | null) ?? null,
    referrer: target,
  });
  await recordSdrAction(admin, {
    workspace_id: job.workspace_id,
    enrollment_id: enr.id as string,
    job_id: job.id,
    kind: "referral_saved",
    status: saved.status === "failed" ? "failed" : "success",
    payload: { ...saved, phone: referral.phoneE164, name: referral.name },
    error: saved.status === "failed" ? saved.error : null,
  });
}

/** Estado explícito efetivo: itens dependentes de envio só valem se o turno saiu. */
export async function loadConversationState(
  admin: Admin,
  workspaceId: string,
  enr: Record<string, unknown>,
): Promise<{ state: ConversationState; version: number }> {
  const raw = parseState(enr.conversation_state);
  const ids = stateJobIds(raw);
  const sent = new Set<string>();
  if (ids.length) {
    const { data } = await admin
      .from("sdr_turn_jobs")
      .select("id, status")
      .in("id", ids)
      .eq("workspace_id", workspaceId);
    for (const r of (data ?? []) as { id: string; status: string }[])
      if (r.status === "sent") sent.add(r.id);
  }
  return {
    state: effectiveState(raw, sent, {
      status: enr.status as string | null,
      cancel_reason: enr.cancel_reason as string | null,
    }),
    version:
      typeof enr.conversation_state_version === "number" ? enr.conversation_state_version : 0,
  };
}

/** Contexto verificável do turno, sempre filtrado pelo workspace do trabalho. */
export async function loadPromptContext(
  admin: Admin,
  p: {
    workspaceId: string;
    enr: Record<string, unknown>;
    playbookName: string | null;
    scheduling: ScheduleConfig | null;
  },
): Promise<Omit<PromptContext, "state" | "facts" | "jobKind">> {
  const ws = p.workspaceId;
  const campaignId = (p.enr.campaign_id as string | null) ?? null;
  const leadId = (p.enr.lead_id as string | null) ?? null;
  const contactId = (p.enr.contact_id as string | null) ?? null;
  const [wsRow, campaign, person] = await Promise.all([
    admin.from("workspaces").select("name").eq("id", ws).maybeSingle(),
    campaignId
      ? admin
          .from("whatsapp_campaigns")
          .select("name, template_name, body_template")
          .eq("id", campaignId)
          .eq("workspace_id", ws)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    leadId || contactId
      ? admin
          .from(contactId ? "contacts" : "leads")
          .select(
            contactId
              ? "first_name, last_name, company_name"
              : "first_name, last_name, company_name, source",
          )
          .eq("id", contactId ?? leadId)
          .eq("workspace_id", ws)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const c = (campaign as { data: Record<string, string | null> | null }).data;
  const per = (person as { data: Record<string, string | null> | null }).data;
  const personName = per ? [per.first_name, per.last_name].filter(Boolean).join(" ") || null : null;
  return {
    companyName: ((wsRow as { data: { name?: string } | null }).data?.name as string) ?? null,
    agentName: p.playbookName,
    origin: campaignId
      ? {
          kind: "campaign",
          campaignName: c?.name ?? null,
          templateName: c?.template_name ?? null,
          templateBody: c?.body_template ?? null,
        }
      : { kind: "inbound" },
    provenance: per?.source ? `origem do cadastro no CRM: ${per.source}` : null,
    crm: per ? { personName, companyName: per.company_name ?? null } : null,
    scheduling: p.scheduling
      ? { timezone: p.scheduling.timezone, durationMinutes: p.scheduling.duration_minutes }
      : null,
  };
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

/**
 * Automação OPCIONAL e versionada (tool_config.automations, desligada por
 * padrão): cliente perguntou se fala com uma IA, a Lia respondeu e ele parou
 * de responder pelo tempo configurado → conversa passa para uma pessoa.
 * Sem versão publicada com a regra ligada, nada é lido nem transferido.
 */
async function handoffSilentAfterAiQuestion(
  admin: Admin,
  workspaceIds: string[],
  deps: WorkerDeps,
): Promise<number> {
  const { data: versions } = await admin
    .from("sdr_agent_versions")
    .select("playbook_id, workspace_id, tool_config")
    .eq("status", "published")
    .in("workspace_id", workspaceIds);
  const rules = new Map<string, number>();
  for (const v of (versions ?? []) as {
    playbook_id: string;
    workspace_id: string;
    tool_config: unknown;
  }[]) {
    const rule = parseToolConfig(v.tool_config)?.automations.ai_question_silence_handoff;
    if (rule?.enabled) rules.set(v.playbook_id, rule.minutes * 60_000);
  }
  if (!rules.size) return 0;
  const now = Date.now();
  const minSilence = Math.min(...rules.values());
  const { data: rows } = await admin
    .from("whatsapp_messages")
    .select("conversation_id, body, created_at")
    .in("workspace_id", workspaceIds)
    .eq("direction", "inbound")
    .gte("created_at", new Date(now - 3 * 86_400_000).toISOString())
    .lte("created_at", new Date(now - minSilence).toISOString())
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
    const { data: enr } = await admin
      .from("sdr_enrollments")
      .select("playbook_id, workspace_id")
      .eq("id", conv.sdr_enrollment_id)
      .eq("workspace_id", conv.workspace_id)
      .maybeSingle();
    const silenceMs = enr ? rules.get(enr.playbook_id as string) : undefined;
    if (!silenceMs) continue;
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
    if (!answered || now - new Date(answered.created_at).getTime() < silenceMs) continue;
    await deps.handoffToHuman(admin, {
      workspaceId: conv.workspace_id,
      enrollmentId: conv.sdr_enrollment_id,
      conversationId: convId,
      reason:
        "Automação configurada: cliente perguntou se estava falando com uma IA e não respondeu mais.",
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
      m.enrollment_id,
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
