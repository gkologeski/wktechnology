// Execução do SDR: follow-ups, turnos com lease e conciliação de reuniões.
// Nenhuma transação SQL fica aberta durante a chamada de IA: o claim marca o
// trabalho e devolve; o envio recheca dono/versão antes de sair.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import { buildSystemPrompt, callSdrAgent } from "./agent.server";
import {
  composeOutgoing,
  ensureOpportunity,
  handoffToHuman,
  reconcileMeetings,
  sendSdrMessage,
  type DraftPayload,
} from "./actions.server";
import { recordSdrAction } from "./ingest.server";
import {
  followUpIdemKey,
  isQuietHours,
  nextStage,
  selectableMaterials,
  selectableOffers,
  sendGuard,
  shouldCreateOpportunity,
  validateAgentOutput,
  type CommercialStage,
  type ConversationMessage,
  type SdrMaterial,
  type SdrOffer,
} from "./policy";

const LEASE_SECONDS = 120;

async function loadKnowledge(admin: Admin, workspaceId: string) {
  const [{ data: offers }, { data: materials }, { data: links }] = await Promise.all([
    admin.from("sdr_offers").select("*").eq("workspace_id", workspaceId).order("position"),
    admin.from("sdr_materials").select("id, title, approved, active, url").eq("workspace_id", workspaceId),
    admin.from("sdr_material_offers").select("material_id, offer_id").eq("workspace_id", workspaceId),
  ]);
  const byMat = new Map<string, string[]>();
  for (const l of links ?? []) byMat.set(l.material_id, [...(byMat.get(l.material_id) ?? []), l.offer_id]);
  const mats: SdrMaterial[] = (materials ?? []).map((m: SdrMaterial) => ({ ...m, offer_ids: byMat.get(m.id) ?? [] }));
  return {
    offers: selectableOffers((offers ?? []) as SdrOffer[]),
    materials: selectableMaterials(mats),
  };
}

async function finish(admin: Admin, jobId: string, leaseToken: string, patch: Record<string, unknown>) {
  await admin
    .from("sdr_turn_jobs")
    .update({ ...patch, lease_token: null, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("lease_token", leaseToken);
}

type Job = {
  id: string;
  workspace_id: string;
  enrollment_id: string;
  conversation_id: string;
  kind: "reply" | "follow_up";
  lease_token: string;
  conversation_version: number | null;
  status: string;
};

export async function processJob(admin: Admin, job: Job): Promise<string> {
  const [{ data: conv }, { data: enr }, { data: settings }] = await Promise.all([
    admin
      .from("whatsapp_conversations")
      .select("id, workspace_id, ai_owner, ai_version, contact_id, lead_id")
      .eq("id", job.conversation_id)
      .maybeSingle(),
    admin.from("sdr_enrollments").select("*").eq("id", job.enrollment_id).maybeSingle(),
    admin.from("sdr_workspace_settings").select("*").eq("workspace_id", job.workspace_id).maybeSingle(),
  ]);
  if (!conv || !enr || conv.workspace_id !== job.workspace_id || enr.workspace_id !== job.workspace_id) {
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: "context_mismatch" });
    return "discarded";
  }
  const pre = sendGuard({ job, leaseToken: job.lease_token, conversation: conv, enrollment: enr });
  if (!pre.ok) {
    await finish(admin, job.id, job.lease_token, { status: "discarded", error: pre.reason });
    return "discarded";
  }
  if (!settings?.enabled) {
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "workspace_disabled" });
    return "skipped";
  }
  const { data: playbook } = await admin.from("sdr_playbooks").select("*").eq("id", enr.playbook_id).maybeSingle();
  if (!playbook?.enabled) {
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "playbook_disabled" });
    return "skipped";
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
  const { offers, materials } = await loadKnowledge(admin, job.workspace_id);
  if (!offers.length) {
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "no_approved_offers" });
    return "skipped";
  }
  const { data: questions } = playbook.questionnaire_id
    ? await admin.from("prospecting_questions").select("label").eq("questionnaire_id", playbook.questionnaire_id).order("position")
    : { data: [] };
  const qualificationFields = [
    "necessidade",
    "empresa",
    "cargo",
    "prazo",
    "orcamento_existe",
    "decisor",
    ...((questions ?? []) as { label: string }[]).map((q) => q.label),
  ];
  const system = buildSystemPrompt({
    offers,
    materials,
    qualificationFields,
    bookingAvailable: !!playbook.booking_page_id,
    extraInstructions:
      [playbook.qualification_prompt, job.kind === "follow_up" ? "Este é um follow-up: retome a conversa com gentileza, sem pressão." : null]
        .filter(Boolean)
        .join("\n") || null,
  });

  const ai = await callSdrAgent({ workspaceId: job.workspace_id, system, history });
  if (!ai.ok) {
    if (ai.retryable) {
      await finish(admin, job.id, job.lease_token, {
        status: "queued",
        lease_until: new Date(Date.now() + 120_000).toISOString(),
        error: ai.error,
      });
      return "retry";
    }
    await finish(admin, job.id, job.lease_token, { status: "failed", error: ai.error });
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: ai.status === 402 || ai.status === 403 ? "ai_paused" : "ai_failed",
      status: "failed",
      error: ai.error,
    });
    return "failed";
  }
  const out = validateAgentOutput(ai.output, {
    offers,
    materials,
    inbound: history.filter((m) => m.direction === "inbound"),
  });
  if ("error" in out) {
    await finish(admin, job.id, job.lease_token, { status: "failed", error: out.error });
    return "failed";
  }

  // Evidências e estado comercial (separado do dono da conversa).
  if (out.qualification.length) {
    await admin.from("sdr_qualification_evidence").upsert(
      out.qualification.map((q) => ({
        workspace_id: job.workspace_id,
        enrollment_id: enr.id,
        field: q.field,
        value: q.value,
        source_message_id: q.message_id,
        excerpt: q.excerpt,
      })),
      { onConflict: "enrollment_id,field,source_message_id", ignoreDuplicates: true },
    );
  }
  const { count: evidenceCount } = await admin
    .from("sdr_qualification_evidence")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enr.id);
  const offerNames = offers.filter((o) => out.offer_keys.includes(o.offer_key)).map((o) => o.name);
  const qualified = shouldCreateOpportunity({
    score: out.score,
    minScore: playbook.opportunity_min_score ?? 60,
    offerKeys: out.offer_keys,
    evidenceCount: evidenceCount ?? 0,
    intent: out.intent,
  });
  await admin
    .from("sdr_enrollments")
    .update({
      qualification_score: out.score,
      offers: offerNames.length ? out.offer_keys : enr.offers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enr.id);
  if (qualified) {
    await ensureOpportunity(admin, {
      workspaceId: job.workspace_id,
      enrollment: enr,
      title: `SDR · ${offerNames.join(" + ")}`,
      offerNames,
    });
  }

  if (out.intent === "opt_out") {
    await admin
      .from("sdr_enrollments")
      .update({ status: "opted_out", commercial_stage: "opted_out", opted_out_at: new Date().toISOString(), cancel_reason: "opt_out", follow_up_at: null })
      .eq("id", enr.id);
    await admin.rpc("sdr_set_conversation_owner", { p_conversation: conv.id, p_owner: "paused" });
    await finish(admin, job.id, job.lease_token, { status: "skipped", error: "opt_out" });
    return "opt_out";
  }
  if (out.intent === "handoff") {
    await finish(admin, job.id, job.lease_token, {
      status: "skipped",
      error: "handoff",
      draft_text: out.reply || null,
    });
    await handoffToHuman(admin, {
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
    bookingPageId: playbook.booking_page_id,
  });
  const payload: DraftPayload = {
    intent: out.intent,
    offer_keys: out.offer_keys,
    material_ids: composed.materials.map((m) => m.id),
    planned_stage: nextStage(enr.commercial_stage as CommercialStage, out.intent, qualified),
    warnings: out.warnings,
    booking_url: composed.bookingUrl,
  };
  const autoAllowed =
    settings.auto_send_enabled &&
    playbook.mode === "auto" &&
    out.warnings.length === 0 &&
    !isQuietHours(new Date(), settings.timezone, settings.quiet_hours_start, settings.quiet_hours_end);

  const { data: saved } = await admin
    .from("sdr_turn_jobs")
    .update({
      status: autoAllowed ? "running" : "drafted",
      draft_text: composed.text,
      draft_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token)
    .select("id");
  if (!saved?.length) return "lease_lost";
  if (!autoAllowed) {
    await admin.from("sdr_turn_jobs").update({ lease_token: null }).eq("id", job.id);
    return "drafted";
  }
  const sent = await sendSdrMessage(admin, {
    jobId: job.id,
    expectedStatus: "running",
    leaseToken: job.lease_token,
    text: composed.text,
    actorUserId: null,
  });
  if (!sent.ok) {
    // Descarta trabalho obsoleto; demais falhas viram rascunho para revisão humana.
    const obsolete = ["owner_not_ai", "stale_version", "enrollment_inactive", "lease_lost"].includes(sent.reason);
    await admin
      .from("sdr_turn_jobs")
      .update({ status: obsolete ? "discarded" : "drafted", error: sent.reason, lease_token: null })
      .eq("id", job.id)
      .in("status", ["running"]);
    return obsolete ? "discarded" : "drafted";
  }
  return "sent";
}

/** Agenda follow-ups vencidos como trabalhos (só dentro da janela de 24 h). */
async function scheduleFollowUps(admin: Admin, limit: number): Promise<number> {
  const { isWithinServiceWindow } = await import("@/lib/whatsapp/meta-channel.server");
  const { data: due } = await admin
    .from("sdr_enrollments")
    .select("id, workspace_id, conversation_id, follow_up_count, commercial_stage")
    .eq("status", "active")
    .lte("follow_up_at", new Date().toISOString())
    .limit(limit);
  let n = 0;
  for (const e of due ?? []) {
    if (!e.conversation_id) continue;
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("ai_owner, ai_version, last_inbound_at")
      .eq("id", e.conversation_id)
      .maybeSingle();
    const clear = { follow_up_at: null };
    if (!conv || conv.ai_owner !== "ai") {
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
    await admin.from("sdr_enrollments").update({ ...clear, follow_up_count: count }).eq("id", e.id);
    n++;
  }
  return n;
}

export async function tickSdr(admin: Admin, limit = 10) {
  const meetings = await reconcileMeetings(admin);
  const followUps = await scheduleFollowUps(admin, 50);
  const { data: jobs, error } = await admin.rpc("sdr_claim_jobs", {
    p_limit: limit,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw new Error(error.message);
  const results: Record<string, number> = {};
  for (const job of (jobs ?? []) as Job[]) {
    let r: string;
    try {
      r = await processJob(admin, job);
    } catch (e) {
      r = "error";
      await finish(admin, job.id, job.lease_token, {
        status: "queued",
        lease_until: new Date(Date.now() + 120_000).toISOString(),
        error: (e as Error).message.slice(0, 300),
      });
    }
    results[r] = (results[r] ?? 0) + 1;
  }
  return { meetings, followUps, claimed: jobs?.length ?? 0, ...results };
}
