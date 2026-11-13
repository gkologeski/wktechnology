// Agendamento durante a ligação: consulta a agenda Google real do anfitrião
// definido pela distribuição da campanha e marca uma única reunião por ligação.
// Chamado só pelo retorno autenticado da Vapi (VAPI_WEBHOOK_SECRET) com o id de
// uma ligação ativa; nunca recebe workspace, anfitrião ou alvo de fora.
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import {
  formatSlotPt,
  generateSlots,
  overlapsBusy,
  pickDiverse,
  type Busy,
} from "@/lib/prospecting/sdr/tools/scheduling";
import {
  chooseHost,
  countBodyParams,
  matchOffer,
  meetingTemplateVariables,
  voiceSchedule,
  VOICE_TOOL_AVAILABILITY,
  VOICE_TOOL_BOOK,
  type MeetingMode,
  type Offer,
  type VoiceToolCall,
} from "./voice-booking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
const ACTIVE = ["queued", "ringing", "in_progress"];
const FALLBACK =
  "A agenda não está disponível agora. Diga ao cliente que vai mandar os horários pelo WhatsApp neste mesmo número.";

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = {
  attempt: Record<string, unknown> & { id: string; workspace_id: string; campaign_id: string };
  campaign: Record<string, unknown>;
  hostId: string;
  accountId: string;
  calendarId: string;
};

async function loadContext(sb: Admin, callId: string): Promise<Ctx | string> {
  const { data: att } = await sb
    .from("prospecting_call_attempts")
    .select(
      "id, workspace_id, campaign_id, lead_id, contact_id, status, script_id, host_user_id, meeting_status, meeting_offers, meeting_start_at, meeting_link",
    )
    .eq("vapi_call_id", callId)
    .maybeSingle();
  if (!att?.campaign_id || !ACTIVE.includes(att.status)) return "Ligação não está ativa.";
  const { data: camp } = await sb
    .from("prospecting_campaigns")
    .select(
      "id, workspace_id, status, meeting_assignment_mode, meeting_member_ids, meeting_duration_minutes, meeting_horizon_days, meeting_rr_cursor, name",
    )
    .eq("id", att.campaign_id)
    .eq("workspace_id", att.workspace_id)
    .maybeSingle();
  const mode = (camp?.meeting_assignment_mode ?? "unassigned") as MeetingMode;
  if (!camp || mode === "unassigned") return "Campanha sem agendamento na ligação.";
  if (att.script_id) {
    const { data: script } = await sb
      .from("prospecting_scripts")
      .select("allow_booking")
      .eq("id", att.script_id)
      .maybeSingle();
    if (!script?.allow_booking) return "Roteiro sem agendamento na ligação.";
  }

  let hostId = att.host_user_id as string | null;
  if (!hostId) {
    const { data: accs } = await sb
      .from("calendar_accounts")
      .select("owner_id")
      .eq("workspace_id", att.workspace_id)
      .eq("provider", "google")
      .not("refresh_token", "is", null);
    const { data: mems } = await sb
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", att.workspace_id)
      .eq("status", "active");
    const active = new Set(((mems ?? []) as { user_id: string }[]).map((m) => m.user_id));
    const hosts = new Set(
      ((accs ?? []) as { owner_id: string }[])
        .map((a) => a.owner_id)
        .filter((id) => active.has(id)),
    );
    let ownerId: string | null = null;
    if (mode === "auto") {
      const table = att.contact_id ? "contacts" : "leads";
      const { data: rec } = await sb
        .from(table)
        .select("assigned_to")
        .eq("id", att.contact_id ?? att.lead_id)
        .maybeSingle();
      ownerId = (rec?.assigned_to as string | null) ?? null;
    }
    const cursor = Number(camp.meeting_rr_cursor ?? 0);
    const pick = chooseHost({
      mode,
      memberIds: (camp.meeting_member_ids ?? []) as string[],
      cursor,
      recordOwnerId: ownerId,
      hosts,
    });
    if (!pick.hostId) return "Nenhum especialista com agenda disponível.";
    hostId = pick.hostId;
    if (mode === "round_robin") {
      // Avança o rodízio só se ninguém avançou antes (ligações simultâneas).
      await sb
        .from("prospecting_campaigns")
        .update({ meeting_rr_cursor: pick.nextCursor })
        .eq("id", camp.id)
        .eq("meeting_rr_cursor", cursor);
    }
    const { data: saved } = await sb
      .from("prospecting_call_attempts")
      .update({ host_user_id: hostId })
      .eq("id", att.id)
      .is("host_user_id", null)
      .select("host_user_id");
    if (!saved?.length) {
      const { data: again } = await sb
        .from("prospecting_call_attempts")
        .select("host_user_id")
        .eq("id", att.id)
        .maybeSingle();
      hostId = (again?.host_user_id as string | null) ?? hostId;
    }
  }
  const { data: acc } = await sb
    .from("calendar_accounts")
    .select("id, primary_calendar_id")
    .eq("workspace_id", att.workspace_id)
    .eq("owner_id", hostId)
    .eq("provider", "google")
    .not("refresh_token", "is", null)
    .limit(1)
    .maybeSingle();
  if (!acc) return "Especialista sem agenda conectada.";
  try {
    await assertSalesWorker(sb, "prospecting_campaigns", camp.id, [
      { member_id: hostId as string },
      {
        table: att.contact_id ? "contacts" : "leads",
        id: (att.contact_id ?? att.lead_id) as string,
      },
      { resource: "techsales.marketing.campaigns", action: "create" },
    ]);
  } catch {
    return "Sem permissão atual para agendar.";
  }
  return {
    attempt: att,
    campaign: camp,
    hostId: hostId as string,
    accountId: acc.id,
    calendarId: acc.primary_calendar_id || "primary",
  };
}

async function freeBusy(sb: Admin, c: Ctx, from: number, to: number): Promise<Busy[] | null> {
  const { googleToken } = await import("@/lib/prospecting/sdr/tools/store.server");
  try {
    const token = await googleToken(sb, c.accountId, c.attempt.workspace_id);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        items: [{ id: c.calendarId }],
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>;
    };
    const cal = j.calendars?.[c.calendarId];
    // Erro ou agenda ausente nunca vira "livre".
    if (!cal || cal.errors?.length) return null;
    return (cal.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  } catch {
    return null;
  }
}

function sched(c: Ctx) {
  return voiceSchedule(
    Number(c.campaign.meeting_duration_minutes ?? 30),
    Number(c.campaign.meeting_horizon_days ?? 7),
  );
}

async function availability(sb: Admin, c: Ctx): Promise<string> {
  if (c.attempt.meeting_status === "booked")
    return `A reunião já foi marcada para ${formatSlotPt(Date.parse(String(c.attempt.meeting_start_at)), sched(c).timezone)}. Não marque outra.`;
  const s = sched(c);
  const now = Date.now();
  const busy = await freeBusy(sb, c, now, now + (s.horizon_days + 1) * 86400000);
  if (!busy) return FALLBACK;
  const prev = (c.attempt.meeting_offers ?? []) as Offer[];
  const slots = pickDiverse(
    generateSlots(s, busy, now),
    s.timezone,
    3,
    prev.map((o) => o.start),
  );
  if (!slots.length)
    return "Não há horários livres nos próximos dias. Diga que o especialista vai enviar opções pelo WhatsApp.";
  const offers: Offer[] = slots.map((x, i) => ({ option: i + 1, start: x.start, end: x.end }));
  await sb
    .from("prospecting_call_attempts")
    .update({ meeting_offers: offers })
    .eq("id", c.attempt.id);
  return (
    "Horários livres: " +
    offers.map((o) => `opção ${o.option}: ${formatSlotPt(o.start, s.timezone)}`).join("; ") +
    ". Ofereça ao cliente e, após confirmação, chame marcar_reuniao com o número da opção."
  );
}

async function book(sb: Admin, c: Ctx, args: Record<string, unknown>): Promise<string> {
  const s = sched(c);
  if (c.attempt.meeting_status === "booked")
    return `A reunião já está marcada para ${formatSlotPt(Date.parse(String(c.attempt.meeting_start_at)), s.timezone)}.`;
  const offer = matchOffer((c.attempt.meeting_offers ?? []) as Offer[], args.opcao);
  if (!offer) return "Opção inválida. Chame consultar_horarios e ofereça as opções devolvidas.";
  // Reserva: só uma marcação por ligação.
  const { data: claimed } = await sb
    .from("prospecting_call_attempts")
    .update({ meeting_status: "booking", meeting_error: null })
    .eq("id", c.attempt.id)
    .or("meeting_status.is.null,meeting_status.eq.failed")
    .select("id");
  if (!claimed?.length) return "A marcação já está em andamento. Aguarde e não marque outra.";
  const fail = async (error: string, uncertain = false) => {
    await sb
      .from("prospecting_call_attempts")
      .update({ meeting_status: uncertain ? "booking" : "failed", meeting_error: error })
      .eq("id", c.attempt.id);
    return uncertain
      ? "Não foi possível confirmar a marcação agora. Diga que o especialista confirma pelo WhatsApp."
      : FALLBACK;
  };
  const busy = await freeBusy(sb, c, offer.start - 3600000, offer.end + 3600000);
  if (!busy) return fail("Agenda indisponível na reconferência");
  if (overlapsBusy(s, offer, busy))
    return (
      await fail("Horário ocupado na reconferência"),
      "Esse horário acabou de ser ocupado. Chame consultar_horarios para novas opções."
    );

  const table = c.attempt.contact_id ? "contacts" : "leads";
  const { data: rec } = await sb
    .from(table)
    .select("first_name, last_name, company_name")
    .eq("id", c.attempt.contact_id ?? c.attempt.lead_id)
    .maybeSingle();
  const name = [rec?.first_name, rec?.last_name].filter(Boolean).join(" ").trim() || "Cliente";
  const title = `Reunião · ${name}${rec?.company_name ? ` (${rec.company_name})` : ""}`;
  // Id determinístico: repetir a chamada nunca cria dois eventos.
  const eventId = `voice${String(c.attempt.id).replace(/-/g, "")}`;
  const { googleToken } = await import("@/lib/prospecting/sdr/tools/store.server");
  let link: string | null = null;
  try {
    const token = await googleToken(sb, c.accountId, c.attempt.workspace_id);
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.calendarId)}`;
    const res = await fetch(`${base}/events?conferenceDataVersion=1&sendUpdates=none`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: eventId,
        summary: title,
        description: `Marcada pela assistente de voz na campanha "${String(c.campaign.name ?? "")}".`,
        start: { dateTime: new Date(offer.start).toISOString(), timeZone: s.timezone },
        end: { dateTime: new Date(offer.end).toISOString(), timeZone: s.timezone },
        conferenceData: {
          createRequest: { requestId: eventId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    });
    let j: Record<string, unknown> | null = null;
    if (res.status === 409) {
      const g = await fetch(`${base}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (g.ok) j = (await g.json()) as Record<string, unknown>;
    } else if (res.ok) j = (await res.json()) as Record<string, unknown>;
    if (!j) return fail(`Google respondeu ${res.status}`, res.status >= 500 || res.status === 429);
    const conf = j.conferenceData as
      | { entryPoints?: { entryPointType: string; uri: string }[] }
      | undefined;
    link =
      (j.hangoutLink as string | undefined) ??
      conf?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;
  } catch (e) {
    return fail((e as Error).message.slice(0, 200), true);
  }

  const { data: act } = await sb
    .from("activities")
    .insert({
      workspace_id: c.attempt.workspace_id,
      owner_id: c.attempt.workspace_id,
      assigned_to: c.hostId,
      type: "meeting",
      subject: title,
      body: `Reunião marcada durante a ligação.${link ? ` Link: ${link}` : ""}`,
      due_date: new Date(offer.start).toISOString(),
      related_lead_id: c.attempt.lead_id ?? null,
      related_contact_id: c.attempt.contact_id ?? null,
      external_ids: {
        provider: "google",
        event_id: eventId,
        meet_link: link,
        call_attempt_id: c.attempt.id,
      },
    })
    .select("id")
    .maybeSingle();
  await sb
    .from("prospecting_call_attempts")
    .update({
      meeting_status: "booked",
      meeting_start_at: new Date(offer.start).toISOString(),
      meeting_link: link,
      meeting_event_id: eventId,
      meeting_id: act?.id ?? null,
      meeting_error: null,
    })
    .eq("id", c.attempt.id);
  return `Reunião marcada para ${formatSlotPt(offer.start, s.timezone)}. Confirme ao cliente e diga que o link vai pelo WhatsApp neste número.`;
}

/** Responde às funções chamadas pela assistente durante a ligação. */
export async function handleVoiceToolCalls(
  callId: string,
  calls: VoiceToolCall[],
): Promise<{ toolCallId: string; result: string }[]> {
  const sb = await admin();
  const results: { toolCallId: string; result: string }[] = [];
  for (const call of calls) {
    let result = FALLBACK;
    try {
      const ctx = await loadContext(sb, callId);
      if (typeof ctx === "string") result = `${ctx} ${FALLBACK}`;
      else if (call.name === VOICE_TOOL_AVAILABILITY) result = await availability(sb, ctx);
      else if (call.name === VOICE_TOOL_BOOK) result = await book(sb, ctx, call.args);
      else result = "Função desconhecida.";
    } catch (e) {
      console.error("[voice-booking]", (e as Error).message);
    }
    results.push({ toolCallId: call.id, result });
  }
  return results;
}

/** Depois da ligação: envia o link pelo WhatsApp (modelo aprovado), uma única vez. */
export async function sendMeetingWhatsApp(attemptId: string): Promise<{ status: string }> {
  const sb = await admin();
  const { data: att } = await sb
    .from("prospecting_call_attempts")
    .select(
      "id, workspace_id, campaign_id, lead_id, contact_id, meeting_status, meeting_start_at, meeting_link, meeting_whatsapp_status",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!att?.campaign_id || att.meeting_status !== "booked" || att.meeting_whatsapp_status)
    return { status: "skip" };
  const { data: camp } = await sb
    .from("prospecting_campaigns")
    .select("id, meeting_template_name, meeting_template_language, followup_sender_phone_number_id")
    .eq("id", att.campaign_id)
    .eq("workspace_id", att.workspace_id)
    .maybeSingle();
  if (!camp?.meeting_template_name) return { status: "skip" };
  const { data: claimed } = await sb
    .from("prospecting_call_attempts")
    .update({ meeting_whatsapp_status: "sending" })
    .eq("id", attemptId)
    .is("meeting_whatsapp_status", null)
    .select("id");
  if (!claimed?.length) return { status: "skip" };
  const finish = async (status: string, err?: string) => {
    await sb
      .from("prospecting_call_attempts")
      .update({ meeting_whatsapp_status: status, ...(err ? { meeting_error: err } : {}) })
      .eq("id", attemptId);
    return { status };
  };
  try {
    const table = att.contact_id ? "contacts" : "leads";
    const targetId = (att.contact_id ?? att.lead_id) as string;
    await assertSalesWorker(sb, "prospecting_campaigns", camp.id, [
      { table, id: targetId },
      { resource: "techsales.marketing.campaigns", action: "create" },
    ]);
    const { data: row } = await sb
      .from(table)
      .select(
        att.contact_id
          ? "first_name, phone, mobile_phone, whatsapp_e164"
          : "first_name, phone, whatsapp_e164",
      )
      .eq("id", targetId)
      .eq("workspace_id", att.workspace_id)
      .maybeSingle();
    const phone = row?.whatsapp_e164 || row?.mobile_phone || row?.phone;
    if (!phone) return finish("skipped", "Sem telefone para WhatsApp");
    const { normalizePhone, metaSend, resolveWaNumber } =
      await import("@/lib/whatsapp/meta-channel.server");
    const num = await resolveWaNumber(
      att.workspace_id,
      camp.followup_sender_phone_number_id ?? null,
    );
    const { loadApprovedTemplates } = await import("@/lib/whatsapp/templates.server");
    const tpls = await loadApprovedTemplates(sb, att.workspace_id, {
      phoneNumberId: num.phoneNumberId,
    });
    const tpl = tpls.find(
      (t) =>
        t.name === camp.meeting_template_name &&
        (!camp.meeting_template_language || t.language === camp.meeting_template_language),
    );
    if (!tpl) return finish("failed", "Modelo da reunião não está aprovado");
    const variables = meetingTemplateVariables(countBodyParams(tpl.components), {
      firstName: String(row?.first_name ?? "").trim() || "tudo bem",
      when: formatSlotPt(Date.parse(att.meeting_start_at), voiceSchedule(30, 7).timezone),
      link: att.meeting_link ?? "",
    });
    await metaSend(num, {
      to: normalizePhone(phone),
      body: "",
      template: { name: tpl.name, language: tpl.language, variables },
    });
    return finish("sent");
  } catch (e) {
    return finish("failed", (e as Error).message.slice(0, 300));
  }
}
