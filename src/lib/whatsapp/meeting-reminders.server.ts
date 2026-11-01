// Disparo dos lembretes de reunião por WhatsApp (server-only, chamado pelo cron).
// Sempre por modelo aprovado; no máximo um envio por reunião + opção + horário
// (reserva única em meeting_reminder_dispatches).
import {
  buildTemplateVariables,
  dueOffsets,
  LATE_TOLERANCE_MS,
  resolveReminderValues,
} from "./meeting-reminders";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

type Rule = {
  workspace_id: string;
  offset_minutes: number;
  template_name: string;
  template_language: string;
  variable_map: string[];
};

export async function tickMeetingReminders(limit = 300): Promise<Record<string, number>> {
  const { supabaseAdmin: sb } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: Sb;
  };
  const stats = { workspaces: 0, scanned: 0, sent: 0, failed: 0, skipped: 0 };
  const { data: settings, error } = await sb
    .from("meeting_reminder_settings")
    .select("workspace_id, sender_phone_number_id")
    .eq("enabled", true);
  if (error) throw new Error(error.message);
  const now = Date.now();
  for (const s of settings ?? []) {
    stats.workspaces++;
    const { data: rules } = await sb
      .from("meeting_reminder_rules")
      .select("workspace_id, offset_minutes, template_name, template_language, variable_map")
      .eq("workspace_id", s.workspace_id)
      .eq("enabled", true);
    const ruleList = (rules ?? []) as Rule[];
    if (!ruleList.length) continue;
    const maxOffset = Math.max(...ruleList.map((r) => r.offset_minutes));
    const { data: meetings } = await sb
      .from("activities")
      .select(
        "id, workspace_id, subject, due_date, meeting_location, related_contact_id, related_lead_id, assigned_to, owner_id",
      )
      .eq("workspace_id", s.workspace_id)
      .eq("type", "meeting")
      .eq("completed", false)
      .eq("wa_reminders_disabled", false)
      .is("deleted_at", null)
      .gt("due_date", new Date(now).toISOString())
      .lte("due_date", new Date(now + maxOffset * 60_000 + LATE_TOLERANCE_MS).toISOString())
      .order("due_date")
      .limit(limit);
    const offsets = ruleList.map((r) => r.offset_minutes);
    let approved: Set<string> | null = null;
    for (const m of meetings ?? []) {
      stats.scanned++;
      const meetingAt = new Date(m.due_date);
      for (const off of dueOffsets(meetingAt.getTime(), now, offsets)) {
        const rule = ruleList.find((r) => r.offset_minutes === off)!;
        if (!approved) {
          try {
            const { loadApprovedTemplates } = await import("./templates.server");
            const list = await loadApprovedTemplates(sb, s.workspace_id, {
              phoneNumberId: s.sender_phone_number_id ?? null,
            });
            approved = new Set(list.map((t) => `${t.name}|${t.language}`));
          } catch {
            approved = new Set();
          }
        }
        const r = await sendOne(sb, m, meetingAt, rule, s.sender_phone_number_id, approved);
        stats[r]++;
      }
    }
  }
  return stats;
}

async function sendOne(
  sb: Sb,
  m: Record<string, string | null>,
  meetingAt: Date,
  rule: Rule,
  sender: string | null,
  approved: Set<string>,
): Promise<"sent" | "failed" | "skipped"> {
  // Reserva: a chave única impede duplicidade entre execuções concorrentes.
  const { data: claim, error: claimErr } = await sb
    .from("meeting_reminder_dispatches")
    .insert({
      workspace_id: m.workspace_id,
      activity_id: m.id,
      offset_minutes: rule.offset_minutes,
      meeting_at: meetingAt.toISOString(),
      status: "sending",
      template_name: rule.template_name,
    })
    .select("id")
    .maybeSingle();
  if (claimErr || !claim) return "skipped";
  const finish = async (
    status: "sent" | "failed" | "skipped",
    extra: Record<string, unknown> = {},
  ) => {
    await sb
      .from("meeting_reminder_dispatches")
      .update({ status, ...extra })
      .eq("id", claim.id);
    return status;
  };
  try {
    if (!approved.has(`${rule.template_name}|${rule.template_language}`))
      return finish("failed", { error: "Modelo não está mais aprovado na Meta" });
    const person = await loadPerson(sb, m);
    if (!person) return finish("skipped", { error: "Reunião sem contato ou lead vinculado" });
    const { pickWhatsAppNumber } = await import("@/lib/phone/whatsapp-e164");
    const pick = pickWhatsAppNumber([person.whatsapp_e164, person.mobile_phone, person.phone]);
    if (!pick.e164) return finish("skipped", { error: "Sem celular de WhatsApp válido" });
    const { normalizePhone, findConversationNumber, resolveWaNumber, metaSend } =
      await import("./meta-channel.server");
    const to = normalizePhone(pick.e164);
    const { brPhoneVariants } = await import("./phone-variants");
    const opt = await sb
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", m.workspace_id)
      .in("contact_phone", brPhoneVariants(to))
      .not("opted_out_at", "is", null)
      .limit(1);
    if (opt.error) return finish("failed", { error: "Não foi possível verificar descadastro" });
    if (opt.data?.length)
      return finish("skipped", { error: "Contato descadastrado", to_phone: to });
    let ownerName: string | null = null;
    const ownerId = m.assigned_to ?? m.owner_id;
    if (ownerId) {
      const { data: p } = await sb
        .from("profiles")
        .select("full_name")
        .eq("id", ownerId)
        .maybeSingle();
      ownerName = p?.full_name ?? null;
    }
    const values = resolveReminderValues({
      firstName: person.first_name,
      meetingAt,
      location: m.meeting_location,
      ownerName,
      subject: m.subject,
    });
    const vars = buildTemplateVariables(rule.variable_map ?? [], values);
    if (!vars)
      return finish("failed", {
        error: "Variável do modelo sem valor nesta reunião",
        to_phone: to,
      });
    const existing = await findConversationNumber(sb, m.workspace_id!, to);
    const num = await resolveWaNumber(m.workspace_id!, sender ?? existing?.phoneNumberId ?? null);
    const { wamid, raw } = await metaSend(num, {
      to,
      body: "",
      template: { name: rule.template_name, language: rule.template_language, variables: vars },
    });
    await recordMessage(sb, m, num, to, wamid, raw, rule).catch((e) =>
      console.warn("[meeting-reminder] registro falhou (envio ok)", e),
    );
    return finish("sent", {
      to_phone: to,
      wa_message_id: wamid,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "erro";
    console.error("[meeting-reminder]", m.id, msg);
    return finish("failed", { error: msg });
  }
}

async function loadPerson(sb: Sb, m: Record<string, string | null>) {
  const cols = "first_name, whatsapp_e164, mobile_phone, phone";
  if (m.related_contact_id) {
    const { data } = await sb
      .from("contacts")
      .select(cols)
      .eq("id", m.related_contact_id)
      .eq("workspace_id", m.workspace_id)
      .maybeSingle();
    if (data) return data;
  }
  if (m.related_lead_id) {
    const { data } = await sb
      .from("leads")
      .select(cols)
      .eq("id", m.related_lead_id)
      .eq("workspace_id", m.workspace_id)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function recordMessage(
  sb: Sb,
  m: Record<string, string | null>,
  num: { displayPhoneNumber: string; phoneNumberId: string },
  to: string,
  wamid: string | null,
  raw: unknown,
  rule: Rule,
) {
  const preview = `[lembrete de reunião · ${rule.template_name}]`;
  const { data: conv } = await sb
    .from("whatsapp_conversations")
    .upsert(
      {
        owner_id: m.workspace_id,
        workspace_id: m.workspace_id,
        ...(m.related_contact_id ? { contact_id: m.related_contact_id } : {}),
        contact_phone: to,
        twilio_number: num.displayPhoneNumber,
        provider: "meta",
        wa_phone_number_id: num.phoneNumberId,
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
      },
      { onConflict: "contact_phone,twilio_number" },
    )
    .select("id")
    .single();
  if (!conv?.id) return;
  const { ensureWhatsAppConversationIdentity } =
    await import("@/lib/inbox/identity-resolution.server");
  await ensureWhatsAppConversationIdentity(sb, conv.id, {}).catch(() => null);
  await sb.from("whatsapp_messages").insert({
    conversation_id: conv.id,
    owner_id: m.workspace_id,
    workspace_id: m.workspace_id,
    direction: "outbound",
    body: preview,
    from_number: num.displayPhoneNumber,
    to_number: to,
    provider: "meta",
    wa_message_id: wamid,
    status: "accepted",
    template_name: rule.template_name,
    is_template: true,
    sent_at: new Date().toISOString(),
    raw: {
      ...(raw as object),
      source: { origin: "meeting_reminder", activity_id: m.id, offset: rule.offset_minutes },
    },
  });
}
