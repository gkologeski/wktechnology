import { repeatsIdenticalInbound } from "./conversation-guards";
import { hubspotSourceClient } from "@/lib/access-control/hubspot-source-client.server";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { configFromRow, hasTool, scopeKnowledge } from "./agent-config";
import { callSdrAgent } from "./agent.server";
import { composeOutgoing, ensureOpportunity } from "./actions.server";
import { loadSdrAgentUserId } from "./agent-identity.server";
import { loadChannelRuntime } from "./channel-runtime.server";
import { personaForChannel } from "./channel-identity";
import { parsePersona } from "./persona";
import {
  loadKnowledge,
  loadQuestions,
  loadPromptContext,
  prepareSdrQualification,
} from "./worker.server";
import { decideTurn } from "./turn";
import { effectiveState, parseState, stateJobIds } from "./conversation-state";
import { blockingWarnings, nextStage, type CommercialStage } from "./policy";
import { qualifiesForOpportunity } from "./qualification";
import { resolveChoice } from "./booking-guard";
import { parseToolConfig } from "./tools/catalog";
import { emptyEffects, type ToolCtx } from "./tools/dispatcher";
import { makeExecutor, newEventId, selectTools } from "./tools/runtime";
import {
  createDbToolStore,
  checkHostCalendar,
  createGoogleCalendar,
  primaryCalendarId,
} from "./tools/store.server";
import {
  deliverServiceJob,
  loadServiceHistory,
  serviceJobGuard,
  type ServiceSession,
  type ServiceJob,
} from "./service-transports.server";

const must = <T>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
export type ServiceWorkerDeps = {
  callAgent: typeof callSdrAgent;
  deliver: typeof deliverServiceJob;
  opportunity: typeof ensureOpportunity;
  guard: typeof serviceJobGuard;
};
const defaults: ServiceWorkerDeps = {
  callAgent: callSdrAgent,
  deliver: deliverServiceJob,
  opportunity: ensureOpportunity,
  guard: serviceJobGuard,
};
async function finish(admin: any, job: ServiceJob, patch: Record<string, unknown>) {
  must(
    await admin
      .from("service_agent_jobs")
      .update({ ...patch, lease_token: null, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token),
  );
}

export async function processServiceJob(
  admin: any,
  job: ServiceJob,
  deps: ServiceWorkerDeps = defaults,
): Promise<string> {
  try {
    await deps.guard(admin, job);
    const session = must(
      await admin
        .from("service_agent_sessions")
        .select("*")
        .eq("id", job.session_id)
        .eq("workspace_id", job.workspace_id)
        .single(),
    ) as ServiceSession;
    const enrollment = must(
      await admin
        .from("sdr_enrollments")
        .select("*")
        .eq("id", session.enrollment_id)
        .eq("workspace_id", job.workspace_id)
        .single(),
    ) as any;
    const sourceTable = session.channel === "email" ? "email_threads" : "live_chat_sessions";
    const refs = [
      { table: sourceTable, id: session.source_id, action: "update" as const },
      ...[
        ["lead_id", "leads"],
        ["contact_id", "contacts"],
        ["company_id", "companies"],
        ["deal_id", "deals"],
      ].flatMap(([field, table]) => (enrollment[field] ? [{ table, id: enrollment[field] }] : [])),
    ];
    await assertSalesWorker(admin, "sdr_enrollments", enrollment.id, refs);
    const playbook = must(
      await admin
        .from("sdr_playbooks")
        .select("*")
        .eq("id", enrollment.playbook_id)
        .eq("workspace_id", job.workspace_id)
        .single(),
    ) as any;
    const version = must(
      await admin
        .from("sdr_agent_versions")
        .select("id,persona,tool_config")
        .eq("playbook_id", playbook.id)
        .eq("workspace_id", job.workspace_id)
        .eq("status", "published")
        .single(),
    ) as any;
    const account = must(
      await admin
        .from("service_channel_accounts")
        .select("source_key")
        .eq("id", session.account_id)
        .eq("workspace_id", job.workspace_id)
        .single(),
    ) as any;
    const sourcePersona = parsePersona(version.persona);
    const channelInput = {
      workspaceId: job.workspace_id,
      channel: session.channel,
      sourceKey: account.source_key,
      agentId: playbook.id,
      origin: session.origin,
      snapshot: enrollment.channel_identity,
      assistantName: sourcePersona.assistant_name,
    };
    const channel = await loadChannelRuntime(admin, channelInput);
    if (channel.status !== "active") {
      await finish(admin, job, {
        status: "skipped",
        error: channel.status === "blocked" ? channel.reason : "channel_not_configured",
      });
      return "skipped";
    }
    const persona = personaForChannel(sourcePersona, channel.identity);
    must(
      await admin
        .from("service_agent_jobs")
        .update({ agent_version_id: version.id })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token),
    );
    if (!enrollment.channel_identity)
      must(
        await admin
          .from("sdr_enrollments")
          .update({ channel_identity: channel.identity })
          .eq("id", enrollment.id)
          .eq("workspace_id", job.workspace_id)
          .is("channel_identity", null),
      );
    const history = await loadServiceHistory(
      admin,
      session,
      session.channel === "email" ? account.source_key : undefined,
    );
    if (
      !history.some(
        (message) => message.id === job.inbound_message_id && message.direction === "inbound",
      )
    )
      throw Object.assign(new Error("inbound_missing"), { serviceGuard: true });
    const recentInbound = history
      .filter((message) => message.direction === "inbound")
      .slice(-2)
      .map((message) => ({
        ...message,
        body: message.body.replace(/^E-mail do remetente: [^\n]+\n/, ""),
      }));
    const repeatedWithinWindow =
      recentInbound.length === 2 &&
      Date.parse(recentInbound[1].created_at) - Date.parse(recentInbound[0].created_at) <=
        10 * 60_000;
    if (repeatedWithinWindow && repeatsIdenticalInbound(recentInbound)) {
      const result = must(
        await admin.rpc("service_agent_commit_turn", {
          p_job: job.id,
          p_lease: job.lease_token,
          p_evidence: [],
          p_qualification: null,
          p_enrollment: {
            status: "paused",
            handoff_at: new Date().toISOString(),
            handoff_reason: "Proteção técnica: mensagens repetidas",
            follow_up_at: null,
          },
          p_job_patch: {
            status: "drafted",
            draft_text: "",
            draft_payload: { intent: "handoff", technical_stop: "repeated_inbound" },
          },
        }),
      );
      return result === "ok" ? "handoff" : "skipped";
    }
    const config = configFromRow(playbook);
    const { offers, materials } = scopeKnowledge(
      config,
      await loadKnowledge(admin, job.workspace_id),
    );
    const questions = hasTool(config, "qualify")
      ? await loadQuestions(admin, job.workspace_id, playbook.questionnaire_id)
      : [];
    const toolConfig = parseToolConfig(version.tool_config);
    if (toolConfig)
      toolConfig.enabled_tools = toolConfig.enabled_tools.filter(
        (id) =>
          (id !== "crm.customer.lookup" || session.identity_verified) &&
          (id !== "crm.context.read" || session.context_approved),
      );
    const effects = emptyEffects();
    const store = createDbToolStore(admin, {
      workspaceId: job.workspace_id,
      playbookId: playbook.id,
      agentVersionId: version.id,
      jobId: job.id,
      conversationId: session.id,
      enrollmentId: enrollment.id,
      conversationReference: { table: sourceTable, id: session.source_id },
      customerScope: { leadId: enrollment.lead_id, contactId: enrollment.contact_id },
      restrictCustomerContext: !session.context_approved,
    });
    const calendarFacts = await checkHostCalendar(
      admin,
      job.workspace_id,
      toolConfig?.scheduling ?? null,
    );
    const selected = selectTools(toolConfig, {
      calendar: calendarFacts,
      crmLinked: !!(enrollment.lead_id || enrollment.contact_id || enrollment.deal_id),
      questionnaire: questions.length > 0,
      materials: materials.length > 0,
      assignee: !!config.assigned_to,
    });
    const calendar =
      selected.directBooking && toolConfig?.scheduling
        ? createGoogleCalendar(
            admin,
            job.workspace_id,
            toolConfig.scheduling,
            await primaryCalendarId(
              admin,
              job.workspace_id,
              toolConfig.scheduling.calendar_account_id,
            ),
            enrollment.id,
            version.id,
          )
        : null;
    const ctx: ToolCtx | null = toolConfig
      ? {
          mode: "live",
          jobId: job.id,
          jobKind: "reply",
          workspaceId: job.workspace_id,
          playbookId: playbook.id,
          agentVersionId: version.id,
          conversation: {
            id: session.id,
            phone: enrollment.contact_phone || "",
            leadId: enrollment.lead_id,
            contactId: enrollment.contact_id,
            companyId: enrollment.company_id,
            dealId: enrollment.deal_id,
            campaignId: enrollment.campaign_id,
            enrollmentId: enrollment.id,
          },
          history,
          config: toolConfig,
          exposed: selected.ids,
          scheduling: toolConfig.scheduling,
          calendar,
          store,
          offers,
          materials,
          kbSources: config.kb_sources,
          attachMaterials: config.guardrails.attach_materials,
          questions,
          assigneeId: config.assigned_to,
          agentUserId: await loadSdrAgentUserId(admin, job.workspace_id),
          now: Date.now,
          newEventId,
          effects,
        }
      : null;
    const rawState = parseState(enrollment.conversation_state);
    const ids = stateJobIds(rawState);
    const sent = ids.length
      ? (must(
          await admin
            .from("service_agent_jobs")
            .select("id,status")
            .eq("workspace_id", job.workspace_id)
            .in("id", ids),
        ) as any[])
      : [];
    const state = effectiveState(
      rawState,
      new Set(sent.filter((row) => row.status === "sent").map((row) => row.id)),
      { status: enrollment.status, cancel_reason: enrollment.cancel_reason },
    );
    const context = await loadPromptContext(admin, {
      workspaceId: job.workspace_id,
      enr: session.context_approved
        ? enrollment
        : { ...enrollment, lead_id: null, contact_id: null, company_id: null, deal_id: null },
      playbookName: playbook.name,
      scheduling: toolConfig?.scheduling ?? null,
      crmClient: hubspotSourceClient(admin, { table: "sdr_enrollments", id: enrollment.id }),
    });
    context.channelIdentity = channel.identity;
    const options = selected.directBooking ? await store.getOffers(session.id) : null;
    const choice = options
      ? resolveChoice(
          [...history].reverse().find((message) => message.direction === "inbound")?.body || "",
          options.slots
            .filter((slot) => slot.status === "offered")
            .map((slot) => ({
              position: slot.position,
              start: new Date(slot.start).toISOString(),
              timezone: toolConfig?.scheduling?.timezone || "America/Sao_Paulo",
            })),
        )
      : null;
    const guard = async () => {
      await deps.guard(admin, job);
      await assertSalesWorker(admin, "sdr_enrollments", enrollment.id, [
        ...refs,
        { agent_version_id: version.id },
      ]);
    };
    let fileIds: string[] = [];
    const decision = await decideTurn(
      {
        workspaceId: job.workspace_id,
        jobId: job.id,
        jobKind: "reply",
        mode: "live",
        agentVersionId: version.id,
        persona,
        config,
        offers,
        materials,
        questions,
        history,
        state,
        context,
        extraInstructions: playbook.qualification_prompt || null,
        optOutPhrases: playbook.opt_out_phrases || [],
        tools: {
          specs: ctx ? selected.specs : [],
          executor: ctx ? makeExecutor(ctx, guard) : null,
          effects,
          directBooking: selected.directBooking,
        },
        choicePosition: choice,
        now: new Date(),
      },
      {
        callAgent: deps.callAgent,
        compose: async (params) => {
          const result = await composeOutgoing(admin, { workspaceId: job.workspace_id, ...params });
          fileIds = result.materials
            .filter((material) => material.kind === "file")
            .map((material) => material.id);
          return result;
        },
      },
    );
    if (decision.kind !== "decided") {
      await finish(admin, job, {
        status: "failed",
        error: decision.error,
        available_at: new Date(Date.now() + 30000 * job.attempts).toISOString(),
      });
      return "failed";
    }
    await guard();
    const { canonical, qualificationPayload, evidence } = await prepareSdrQualification(admin, {
      workspaceId: job.workspace_id,
      enrollment,
      playbook,
      config,
      questions,
      out: decision.out,
      inbound: history.filter((message) => message.direction === "inbound"),
      crmClient: hubspotSourceClient(admin, { table: "sdr_enrollments", id: enrollment.id }),
    });
    const handoff = decision.out.intent === "handoff" && hasTool(config, "handoff");
    const silent = !decision.text && !handoff;
    const closing = silent && decision.close;
    const qualified = qualifiesForOpportunity({
      canonical,
      minTotal: playbook.opportunity_min_score ?? 60,
      offerKeys: decision.out.offer_keys,
      intent: decision.out.intent,
    });
    const payload = {
      intent: decision.out.intent,
      material_ids: decision.materials.map((material) => material.id),
      file_material_ids: fileIds,
      opt_out: decision.optOut,
      offer_keys: decision.out.offer_keys,
      warnings: decision.out.warnings,
      turn_trace: decision.trace,
      planned_stage:
        effects.meeting?.status === "confirmed"
          ? "meeting_booked"
          : nextStage(
              enrollment.commercial_stage as CommercialStage,
              decision.out.intent,
              qualified,
            ),
    };
    const patch: Record<string, unknown> = {
      offers: decision.out.offer_keys,
      follow_up_at: null,
      ...(Object.keys(decision.state.patch).length
        ? {
            conversation_state: decision.state.patch,
            expected_state_version: enrollment.conversation_state_version ?? 0,
          }
        : {}),
      ...(decision.optOut
        ? {
            status: "opted_out",
            commercial_stage: "opted_out",
            opted_out_at: new Date().toISOString(),
            cancel_reason: "opt_out",
          }
        : {}),
      ...(handoff
        ? {
            status: "paused",
            handoff_at: new Date().toISOString(),
            handoff_reason: decision.out.handoff_reason || "Solicitado pelo cliente",
          }
        : {}),
      ...(closing ? { status: "paused", cancel_reason: closing } : {}),
    };
    const committed = must(
      await admin.rpc("service_agent_commit_turn", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_evidence: evidence,
        p_qualification: qualificationPayload,
        p_enrollment: patch,
        p_job_patch: {
          status: handoff ? "drafted" : silent ? "skipped" : "running",
          draft_text: decision.text || decision.out.reply,
          draft_payload: payload,
        },
      }),
    );
    if (committed !== "ok") {
      await finish(admin, job, { status: "skipped", error: String(committed) });
      return "skipped";
    }
    if (silent || handoff) return handoff ? "handoff" : "skipped";
    await guard();
    if (qualified && !config.guardrails.require_human_for_opportunity && hasTool(config, "qualify"))
      await deps.opportunity(admin, {
        workspaceId: job.workspace_id,
        enrollment,
        title: `Oportunidade — ${context.crm?.companyName || context.crm?.personName || "Atendimento"}`,
        offerNames: offers
          .filter((offer) => decision.out.offer_keys.includes(offer.offer_key))
          .map((offer) => offer.name),
      });
    const settings = must(
      await admin
        .from("sdr_workspace_settings")
        .select("auto_send_enabled")
        .eq("workspace_id", job.workspace_id)
        .single(),
    ) as any;
    const status =
      playbook.mode === "auto" &&
      settings.auto_send_enabled &&
      !blockingWarnings(decision.out.warnings).length
        ? "ready"
        : "drafted";
    const finished = must(
      await admin.rpc("service_agent_finish_decision", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_status: status,
      }),
    );
    return finished === "ok" ? status : "skipped";
  } catch (error) {
    const guarded = !!(error as { serviceGuard?: boolean }).serviceGuard;
    await finish(admin, job, {
      status: guarded ? "skipped" : "failed",
      error: (error as Error).message.slice(0, 500),
      available_at: new Date(Date.now() + 30000 * Math.max(1, job.attempts)).toISOString(),
    });
    return guarded ? "skipped" : "failed";
  }
}

export async function tickServiceAgents(admin: any, limit = 3, deps: ServiceWorkerDeps = defaults) {
  // Recover only documented provider acceptance. Never issue another provider send.
  const uncertain = must(
    await admin
      .from("service_agent_jobs")
      .select("id,send_token,provider_message_id,draft_payload")
      .eq("status", "uncertain")
      .not("provider_message_id", "is", null)
      .limit(limit),
  ) as any[];
  let reconciled = 0;
  for (const item of uncertain) {
    if (!item.send_token || !item.draft_payload?.delivery_header) continue;
    const result = await admin.rpc("service_agent_complete_email", {
      p_job: item.id,
      p_send_token: item.send_token,
      p_provider_id: item.provider_message_id,
      p_header: item.draft_payload.delivery_header,
    });
    if (!result.error) reconciled++;
  }

  let jobs = must(await admin.rpc("service_agent_claim", { p_limit: limit })) as ServiceJob[];
  if (!jobs.length) {
    const next = must(
      await admin
        .from("service_agent_jobs")
        .select("available_at")
        .eq("status", "queued")
        .order("available_at")
        .limit(1)
        .maybeSingle(),
    ) as any;
    const delay = next ? Date.parse(next.available_at) - Date.now() : 0;
    if (delay > 0 && delay <= 60000) {
      await new Promise((resolve) => setTimeout(resolve, delay + 100));
      jobs = must(await admin.rpc("service_agent_claim", { p_limit: limit })) as ServiceJob[];
    }
  }
  const outcomes = await Promise.all(jobs.map((job) => processServiceJob(admin, job, deps)));
  const ready = must(
    await admin
      .from("service_agent_jobs")
      .select("id")
      .eq("status", "ready")
      .order("created_at")
      .limit(limit),
  ) as { id: string }[];
  let delivered = 0;
  for (const item of ready) {
    const locked = must(
      await admin.rpc("service_agent_begin_send", { p_job: item.id }),
    ) as ServiceJob[];
    const job = locked[0];
    if (!job) continue;
    try {
      const session = must(
        await admin
          .from("service_agent_sessions")
          .select("*")
          .eq("id", job.session_id)
          .eq("workspace_id", job.workspace_id)
          .single(),
      ) as ServiceSession;
      const enrollment = must(
        await admin
          .from("sdr_enrollments")
          .select("playbook_id,channel_identity")
          .eq("workspace_id", job.workspace_id)
          .eq("id", session.enrollment_id)
          .single(),
      ) as any;
      const account = must(
        await admin
          .from("service_channel_accounts")
          .select("source_key")
          .eq("workspace_id", job.workspace_id)
          .eq("id", session.account_id)
          .single(),
      ) as any;
      const channel = await loadChannelRuntime(admin, {
        workspaceId: job.workspace_id,
        channel: session.channel,
        sourceKey: account.source_key,
        agentId: enrollment.playbook_id,
        origin: session.origin,
        snapshot: enrollment.channel_identity,
      });
      if (channel.status !== "active")
        throw Object.assign(new Error("channel_unavailable"), { beforeProvider: true });
      await deps.deliver(admin, session, job, channel.identity);
      delivered++;
    } catch (error) {
      const beforeProvider =
        !!(error as { beforeProvider?: boolean; serviceGuard?: boolean }).beforeProvider ||
        !!(error as { serviceGuard?: boolean }).serviceGuard;
      await finish(admin, job, {
        status: beforeProvider ? "drafted" : "uncertain",
        error: (error as Error).message.slice(0, 500),
        ...(beforeProvider ? { send_started_at: null } : {}),
      });
    }
  }
  return {
    claimed: jobs.length,
    reconciled,
    delivered,
    drafted: outcomes.filter((status) => status === "drafted").length,
    failed: outcomes.filter((status) => status === "failed").length,
  };
}
