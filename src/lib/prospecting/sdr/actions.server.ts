// Efeitos externos do SDR: envio (com rechecagem), CRM sem duplicatas,
// handoff/opt-out e reunião confirmada só com retorno do Google.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import { getPublicAppUrl } from "@/lib/app-url";
import { recordSdrAction } from "./ingest.server";
import { meetingStatus, nextFollowUpAt, type CommercialStage, type SdrIntent } from "./policy";

export type DraftPayload = {
  intent: SdrIntent;
  offer_keys: string[];
  material_ids: string[];
  planned_stage: CommercialStage;
  warnings: string[];
  booking_url?: string | null;
};

/** Mensagem final: texto do agente + link de agenda + links de materiais aprovados. */
export async function composeOutgoing(
  admin: Admin,
  p: {
    workspaceId: string;
    reply: string;
    intent: SdrIntent;
    materialIds: string[];
    bookingPageId: string | null;
  },
): Promise<{
  text: string;
  bookingUrl: string | null;
  materials: { id: string; title: string; url: string }[];
}> {
  let bookingUrl: string | null = null;
  if (p.intent === "schedule_meeting" && p.bookingPageId) {
    const { data: page } = await admin
      .from("booking_pages")
      .select("slug, active, workspace_id")
      .eq("id", p.bookingPageId)
      .maybeSingle();
    if (page?.active && page.workspace_id === p.workspaceId)
      bookingUrl = `${getPublicAppUrl().replace(/\/$/, "")}/book/${page.slug}`;
  }
  let materials: { id: string; title: string; url: string }[] = [];
  if (p.materialIds.length) {
    const { data } = await admin
      .from("sdr_materials")
      .select("id, title, url, approved, active, workspace_id")
      .in("id", p.materialIds)
      .eq("workspace_id", p.workspaceId);
    materials = (data ?? [])
      .filter(
        (m: { approved: boolean; active: boolean; url: string | null }) =>
          m.approved && m.active && m.url,
      )
      .map((m: { id: string; title: string; url: string }) => ({
        id: m.id,
        title: m.title,
        url: m.url,
      }));
  }
  const parts = [p.reply.trim()];
  if (bookingUrl) parts.push(`Agende um horário: ${bookingUrl}`);
  for (const m of materials) parts.push(`${m.title}: ${m.url}`);
  return { text: parts.filter(Boolean).join("\n\n"), bookingUrl, materials };
}

export type SendOutcome = { ok: true; wamid: string } | { ok: false; reason: string };

/**
 * Envia a mensagem do SDR. Rechecagem imediatamente antes do envio:
 * dono ainda é IA, versão da conversa igual à do trabalho, enrollment ativo,
 * janela de 24 h aberta e limite diário. Só confirma com wamid da Meta.
 */
export async function sendSdrMessage(
  admin: Admin,
  p: {
    jobId: string;
    expectedStatus: "running" | "drafted";
    leaseToken?: string | null;
    text: string;
    actorUserId: string | null;
  },
): Promise<SendOutcome> {
  const { data: job } = await admin
    .from("sdr_turn_jobs")
    .select(
      "id, workspace_id, enrollment_id, conversation_id, status, lease_token, conversation_version, draft_payload",
    )
    .eq("id", p.jobId)
    .maybeSingle();
  if (!job || job.status !== p.expectedStatus) return { ok: false, reason: "job_state_changed" };
  if (p.expectedStatus === "running" && job.lease_token !== p.leaseToken)
    return { ok: false, reason: "lease_lost" };

  const [{ data: conv }, { data: enr }, { data: settings }] = await Promise.all([
    admin
      .from("whatsapp_conversations")
      .select("id, workspace_id, ai_owner, ai_version, contact_phone, last_inbound_at, contact_id")
      .eq("id", job.conversation_id)
      .maybeSingle(),
    admin
      .from("sdr_enrollments")
      .select("id, status, owner_id, playbook_id, follow_up_count")
      .eq("id", job.enrollment_id)
      .maybeSingle(),
    admin
      .from("sdr_workspace_settings")
      .select("daily_send_limit, pilot_allowlist")
      .eq("workspace_id", job.workspace_id)
      .maybeSingle(),
  ]);
  if (!conv || conv.workspace_id !== job.workspace_id)
    return { ok: false, reason: "conversation_missing" };
  if (conv.ai_owner !== "ai") return { ok: false, reason: "owner_not_ai" };
  if (conv.ai_version !== job.conversation_version) return { ok: false, reason: "stale_version" };
  if (!enr || enr.status !== "active") return { ok: false, reason: "enrollment_inactive" };
  const { isPhoneAllowlisted } = await import("./allowlist");
  if (!isPhoneAllowlisted(conv.contact_phone ?? "", settings?.pilot_allowlist))
    return { ok: false, reason: "not_allowlisted" };

  const { isWithinServiceWindow, resolveWaNumber, metaSend } =
    await import("@/lib/whatsapp/meta-channel.server");
  if (!isWithinServiceWindow(conv.last_inbound_at)) return { ok: false, reason: "window_closed" };


  // Idempotência: se uma tentativa anterior já gravou a mensagem deste trabalho,
  // só finaliza como enviado — nunca reenvia.
  const { data: already } = await admin
    .from("whatsapp_messages")
    .select("wa_message_id")
    .eq("conversation_id", conv.id)
    .eq("direction", "outbound")
    .contains("raw", { job_id: job.id })
    .not("wa_message_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (already?.wa_message_id) {
    await admin
      .from("sdr_turn_jobs")
      .update({ status: "sent", lease_token: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return { ok: true, wamid: already.wa_message_id };
  }

  // Trava de envio: mantém "running" com lease próprio até a Meta confirmar.
  // Se o processo cair durante o envio, o lease expira e a rotina de reserva
  // retoma o trabalho (máx. 3 tentativas). Só vira "sent" após wamid gravado.
  const sendLease = crypto.randomUUID();
  let lockQuery = admin
    .from("sdr_turn_jobs")
    .update({
      status: "running",
      lease_token: sendLease,
      lease_until: new Date(Date.now() + 90_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", p.expectedStatus);
  if (p.expectedStatus === "running") lockQuery = lockQuery.eq("lease_token", p.leaseToken ?? "");
  const { data: claimed } = await lockQuery.select("id");
  if (!claimed?.length) return { ok: false, reason: "job_state_changed" };

  // Cota de respostas (janela móvel de 24 h): reserva atômica no banco. Conta só
  // envios confirmados com wamid único + reservas em andamento; falhas não consomem.
  const { data: quota, error: quotaErr } = await admin.rpc("sdr_reserve_send_quota", {
    p_job: job.id,
    p_lease: sendLease,
    p_limit: settings?.daily_send_limit ?? 50,
  });
  const quotaResult = (quota as { result?: string } | null)?.result ?? "error";
  if (quotaErr || (quotaResult !== "ok" && quotaResult !== "already_reserved")) {
    const reason = quotaResult === "daily_limit" ? "daily_limit" : "quota_check_failed";
    await admin
      .from("sdr_turn_jobs")
      .update({
        status: "drafted",
        error: reason,
        lease_token: null,
        send_reserved_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_token", sendLease);
    console.warn("[sdr] envio bloqueado pela cota", { job: job.id, reason, quota });
    return { ok: false, reason };
  }

  let wamid: string | null = null;
  let raw: unknown = null;
  try {
    const num = await resolveWaNumber(job.workspace_id);
    const res = await metaSend(num, { to: conv.contact_phone, body: p.text });
    wamid = res.wamid;
    raw = res.raw;
    if (!wamid) throw new Error("A Meta não devolveu o id da mensagem");
    const { error: insErr } = await admin.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      owner_id: enr.owner_id,
      workspace_id: job.workspace_id,
      direction: "outbound",
      body: p.text,
      from_number: num.displayPhoneNumber,
      to_number: conv.contact_phone,
      provider: "meta",
      wa_message_id: wamid,
      status: "accepted",
      sent_by: p.actorUserId,
      sent_at: new Date().toISOString(),
      raw: { sdr: true, job_id: job.id, response: raw },
    });
    if (insErr) console.error("[sdr] falha ao gravar mensagem enviada", insErr.message);
    await admin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: p.text.slice(0, 120),
      })
      .eq("id", conv.id);
    // Confirmação: só agora o trabalho é marcado como enviado.
    await admin
      .from("sdr_turn_jobs")
      .update({ status: "sent", lease_token: null, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("lease_token", sendLease);
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await admin
      .from("sdr_turn_jobs")
      .update({
        status: "failed",
        error: msg,
        lease_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_token", sendLease);
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "message_sent",
      status: "failed",
      error: msg,
      created_by: p.actorUserId,
    });
    // Falha do provedor não consome cota: libera a reserva.
    await admin.from("sdr_turn_jobs").update({ send_reserved_until: null }).eq("id", job.id);
    return { ok: false, reason: "provider_failed" };
  }

  const payload = (job.draft_payload ?? {}) as Partial<DraftPayload>;
  await recordSdrAction(admin, {
    workspace_id: job.workspace_id,
    enrollment_id: enr.id,
    job_id: job.id,
    kind: "message_sent",
    status: "success",
    provider_ref: wamid,
    created_by: p.actorUserId,
  });
  for (const id of payload.material_ids ?? []) {
    await recordSdrAction(admin, {
      workspace_id: job.workspace_id,
      enrollment_id: enr.id,
      job_id: job.id,
      kind: "material_sent",
      status: "success",
      provider_ref: wamid,
      payload: { material_id: id },
      created_by: p.actorUserId,
    });
  }
  const { data: pb } = await admin
    .from("sdr_playbooks")
    .select("follow_up_hours, max_follow_ups")
    .eq("id", enr.playbook_id)
    .maybeSingle();
  const stage = payload.planned_stage ?? "discovery";
  const fu = nextFollowUpAt({
    now: new Date(),
    hours: pb?.follow_up_hours ?? 24,
    count: enr.follow_up_count ?? 0,
    max: pb?.max_follow_ups ?? 2,
    stage,
  });
  await admin
    .from("sdr_turn_jobs")
    .update({
      draft_text: p.text,
      decided_by: p.actorUserId,
      decided_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", job.id);
  await admin
    .from("sdr_enrollments")
    .update({
      commercial_stage: stage,
      ...(payload.booking_url ? { meeting_status: "link_sent" } : {}),
      last_action_at: new Date().toISOString(),
      follow_up_at: fu?.toISOString() ?? null,
    })
    .eq("id", enr.id);
  return { ok: true, wamid };
}

/** Handoff: humano assume, IA trava, follow-ups cancelados, tarefa para o responsável. */
export async function handoffToHuman(
  admin: Admin,
  p: {
    workspaceId: string;
    enrollmentId: string;
    conversationId: string;
    reason: string;
    actorUserId: string | null;
  },
): Promise<void> {
  await admin.rpc("sdr_set_conversation_owner", {
    p_conversation: p.conversationId,
    p_owner: "human",
  });
  const { data: enr } = await admin
    .from("sdr_enrollments")
    .update({
      status: "handoff",
      commercial_stage: "handoff",
      handoff_at: new Date().toISOString(),
      handoff_reason: p.reason.slice(0, 300),
      cancel_reason: "handoff",
      follow_up_at: null,
    })
    .eq("id", p.enrollmentId)
    .eq("workspace_id", p.workspaceId)
    .select("owner_id, contact_id, lead_id")
    .maybeSingle();
  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("assigned_to, contact_phone")
    .eq("id", p.conversationId)
    .maybeSingle();
  const assignee = conv?.assigned_to ?? enr?.owner_id ?? null;
  if (assignee) {
    await admin.from("activities").insert({
      owner_id: assignee,
      assigned_to: assignee,
      type: "task",
      subject: "SDR: assumir conversa no WhatsApp",
      body: `Motivo: ${p.reason || "solicitado"}. Telefone: ${conv?.contact_phone ?? ""}`,
      related_contact_id: enr?.contact_id ?? null,
      related_lead_id: enr?.lead_id ?? null,
      due_date: new Date().toISOString(),
    });
  }
  await recordSdrAction(admin, {
    workspace_id: p.workspaceId,
    enrollment_id: p.enrollmentId,
    kind: "handoff",
    status: "success",
    payload: { reason: p.reason },
    created_by: p.actorUserId,
  });
}

/**
 * Oportunidade sem duplicata: reaproveita o negócio do enrollment ou um negócio
 * aberto já ligado ao mesmo contato/lead; só cria quando nenhum existe.
 */
export async function ensureOpportunity(
  admin: Admin,
  p: {
    workspaceId: string;
    enrollment: {
      id: string;
      owner_id: string;
      deal_id: string | null;
      contact_id: string | null;
      lead_id: string | null;
    };
    title: string;
    offerNames: string[];
  },
): Promise<string | null> {
  if (p.enrollment.deal_id) return p.enrollment.deal_id;
  let dealId: string | null = null;
  if (p.enrollment.contact_id) {
    const { data } = await admin
      .from("deal_contacts")
      .select("deal_id, deals!inner(id, workspace_id, stage)")
      .eq("contact_id", p.enrollment.contact_id)
      .eq("deals.workspace_id", p.workspaceId)
      .not("deals.stage", "in", "(won,lost)")
      .limit(1);
    dealId = (data?.[0]?.deal_id as string | undefined) ?? null;
  }
  if (!dealId && p.enrollment.lead_id) {
    const { data } = await admin
      .from("deals")
      .select("id")
      .eq("workspace_id", p.workspaceId)
      .eq("lead_id", p.enrollment.lead_id)
      .not("stage", "in", "(won,lost)")
      .limit(1);
    dealId = (data?.[0]?.id as string | undefined) ?? null;
  }
  if (!dealId) {
    const { data: created, error } = await admin
      .from("deals")
      .insert({
        owner_id: p.enrollment.owner_id,
        workspace_id: p.workspaceId,
        name: p.title.slice(0, 200),
        lead_id: p.enrollment.lead_id,
        description: `Oportunidade identificada pelo SDR: ${p.offerNames.join(", ")}. Valor: sob proposta (a definir pelo especialista).`,
        external_ids: { sdr_enrollment_id: p.enrollment.id },
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar negócio: ${error.message}`);
    dealId = created.id as string;
    if (p.enrollment.contact_id)
      await admin
        .from("deal_contacts")
        .insert({ deal_id: dealId, contact_id: p.enrollment.contact_id });
  }
  await admin.from("sdr_enrollments").update({ deal_id: dealId }).eq("id", p.enrollment.id);
  await recordSdrAction(admin, {
    workspace_id: p.workspaceId,
    enrollment_id: p.enrollment.id,
    kind: "opportunity",
    status: "success",
    provider_ref: dealId,
  });
  return dealId;
}

/**
 * Concilia reservas feitas pelo link do SDR. Reunião só fica "confirmada"
 * quando o Google devolveu o evento; falha fica visível e pode ser reenviada.
 */
export async function reconcileMeetings(
  admin: Admin,
  limit = 50,
  workspaceIds?: string[],
): Promise<number> {
  const { data: rows } = await admin
    .from("sdr_enrollments")
    .select(
      "id, workspace_id, contact_id, lead_id, booking_id, meeting_status, last_action_at, playbook:sdr_playbooks(booking_page_id)",
    )
    .in("meeting_status", ["link_sent", "pending_sync", "sync_failed"])
    .in("workspace_id", workspaceIds ?? [])
    .limit(limit);
  let changed = 0;
  for (const e of rows ?? []) {
    let booking = null as null | Record<string, string | null>;
    if (e.booking_id) {
      ({ data: booking } = await admin
        .from("bookings")
        .select("id, status, gcal_event_id, calendar_sync_error")
        .eq("id", e.booking_id)
        .maybeSingle());
    } else if ((e.contact_id || e.lead_id) && (e as any).playbook?.booking_page_id) {
      // Só reservas da página de agenda do playbook contam como reunião do SDR.
      const q = admin
        .from("bookings")
        .select("id, status, gcal_event_id, calendar_sync_error")
        .eq("workspace_id", e.workspace_id)
        .eq("page_id", (e as any).playbook.booking_page_id)
        .gte("created_at", e.last_action_at ?? new Date(0).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      ({ data: booking } = await (
        e.contact_id ? q.eq("contact_id", e.contact_id) : q.eq("lead_id", e.lead_id)
      ).maybeSingle());
    }
    if (!booking) continue;
    const st = meetingStatus(booking as never);
    const status = st === "none" ? e.meeting_status : st;
    if (status === e.meeting_status && e.booking_id) continue;
    await admin
      .from("sdr_enrollments")
      .update({
        booking_id: booking.id,
        meeting_status: status,
        ...(status === "confirmed"
          ? { commercial_stage: "meeting_booked", follow_up_at: null, cancel_reason: "meeting" }
          : {}),
      })
      .eq("id", e.id);
    await recordSdrAction(admin, {
      workspace_id: e.workspace_id,
      enrollment_id: e.id,
      kind: "meeting",
      status: status === "confirmed" ? "success" : status === "sync_failed" ? "failed" : "pending",
      provider_ref: (booking.gcal_event_id as string | null) ?? null,
      error: (booking.calendar_sync_error as string | null) ?? null,
    });
    changed++;
  }
  return changed;
}

/** Reenvio idempotente ao Google: só tenta quando ainda não há evento criado. */
export async function retryBookingSync(admin: Admin, workspaceId: string, bookingId: string) {
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, page_id, workspace_id, start_at, end_at, invitee_name, invitee_email, notes, gcal_event_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.workspace_id !== workspaceId) throw new Error("Reserva não encontrada");
  if (b.gcal_event_id) return { status: "confirmed" as const, eventId: b.gcal_event_id as string };
  const { data: page } = await admin
    .from("booking_pages")
    .select("*")
    .eq("id", b.page_id)
    .maybeSingle();
  if (!page) throw new Error("Página de agendamento não encontrada");
  const { pushBookingToGoogle } = await import("@/lib/booking/engine.server");
  const r = await pushBookingToGoogle(page, b);
  await admin
    .from("bookings")
    .update(
      r.eventId
        ? { gcal_event_id: r.eventId, meet_link: r.meetLink, calendar_sync_error: null }
        : { calendar_sync_error: r.error },
    )
    .eq("id", b.id)
    .is("gcal_event_id", null);
  return r.eventId
    ? { status: "confirmed" as const, eventId: r.eventId }
    : { status: "sync_failed" as const, error: r.error };
}
