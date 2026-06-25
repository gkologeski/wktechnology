// Engine de lembretes de entrevista (D-1 e 1h antes).
import { sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SENDER_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_NAME_DEFAULT = "TechHire ATS";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

async function getBrandingFor(
  ownerId: string,
): Promise<{ productName: string; primaryColor: string | null }> {
  const { data: wm } = await admin
    .from("workspace_modules")
    .select("workspace_id")
    .eq("module_id", "ats")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!wm?.workspace_id) return { productName: FROM_NAME_DEFAULT, primaryColor: null };
  const { data: b } = await admin
    .from("module_branding")
    .select("product_name, primary_color")
    .eq("workspace_id", wm.workspace_id)
    .eq("module_id", "ats")
    .maybeSingle();
  return {
    productName: (b?.product_name as string) || FROM_NAME_DEFAULT,
    primaryColor: (b?.primary_color as string) || null,
  };
}

function fmt(d: Date): string {
  return d.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
}

async function sendReminderEmail(args: {
  to: string;
  candidateName: string;
  jobTitle: string;
  scheduledAt: string;
  meetUrl: string | null;
  location: string | null;
  ownerId: string;
  reminderType: "d1" | "1h";
  messageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY missing" };
  const branding = await getBrandingFor(args.ownerId);
  const color = branding.primaryColor || "#0ea5e9";
  const when = fmt(new Date(args.scheduledAt));
  const label =
    args.reminderType === "d1" ? "Sua entrevista é amanhã" : "Sua entrevista começa em 1 hora";
  const subject = `${label} — ${args.jobTitle}`;
  const linkLine = args.meetUrl
    ? `<p>Link da reunião: <a href="${args.meetUrl}" style="color:${color}">${args.meetUrl}</a></p>`
    : args.location
      ? `<p>Local: <strong>${args.location}</strong></p>`
      : "";
  const html = `
<div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px;color:${color}">${label}</h1>
  <p>Olá <strong>${args.candidateName}</strong>,</p>
  <p>Lembrando: você tem uma entrevista para a vaga <strong>${args.jobTitle}</strong> em <strong>${when}</strong>.</p>
  ${linkLine}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#64748b">Enviado por ${branding.productName}.</p>
</div>`.trim();
  try {
    await sendLovableEmail(
      {
        to: args.to,
        from: `${branding.productName} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: `${label}. Entrevista para ${args.jobTitle} em ${when}.${args.meetUrl ? " Link: " + args.meetUrl : ""}`,
        label: `ats-interview-${args.reminderType}`,
        idempotency_key: args.messageId,
        message_id: args.messageId,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Processa lembretes pendentes. */
export async function tickAtsInterviewReminders(
  limit = 30,
): Promise<{ d1: number; h1: number; failed: number }> {
  const nowIso = new Date().toISOString();
  const in25h = new Date(Date.now() + 25 * 3600_000).toISOString();
  const in75m = new Date(Date.now() + 75 * 60_000).toISOString();
  const in23h = new Date(Date.now() + 23 * 3600_000).toISOString();

  // D-1: entre 23h e 25h, sem reminder_d1
  const { data: d1Rows } = await admin
    .from("ats_interviews")
    .select("id, owner_id, candidate_id, job_id, scheduled_at, meet_url, location")
    .eq("status", "scheduled")
    .is("reminder_d1_sent_at", null)
    .gte("scheduled_at", in23h)
    .lte("scheduled_at", in25h)
    .limit(limit);

  // 1h: nos próximos 75min, sem reminder_1h
  const { data: h1Rows } = await admin
    .from("ats_interviews")
    .select("id, owner_id, candidate_id, job_id, scheduled_at, meet_url, location")
    .eq("status", "scheduled")
    .is("reminder_1h_sent_at", null)
    .gte("scheduled_at", nowIso)
    .lte("scheduled_at", in75m)
    .limit(limit);

  let d1 = 0;
  let h1 = 0;
  let failed = 0;

  const process = async (
    rows: Array<{
      id: string;
      owner_id: string;
      candidate_id: string;
      job_id: string;
      scheduled_at: string;
      meet_url: string | null;
      location: string | null;
    }>,
    type: "d1" | "1h",
  ) => {
    for (const r of rows) {
      const { data: cand } = await admin
        .from("ats_candidates")
        .select("full_name, email")
        .eq("id", r.candidate_id)
        .maybeSingle();
      const { data: job } = await admin
        .from("ats_jobs")
        .select("title")
        .eq("id", r.job_id)
        .maybeSingle();
      if (!cand?.email) continue;
      const res = await sendReminderEmail({
        to: cand.email as string,
        candidateName: (cand.full_name as string) || "candidato(a)",
        jobTitle: (job?.title as string) || "vaga",
        scheduledAt: r.scheduled_at,
        meetUrl: r.meet_url,
        location: r.location,
        ownerId: r.owner_id,
        reminderType: type,
        messageId: `${r.id}-${type}`,
      });
      if (res.ok) {
        if (type === "d1") d1++;
        else h1++;
        const patch =
          type === "d1"
            ? { reminder_d1_sent_at: new Date().toISOString() }
            : { reminder_1h_sent_at: new Date().toISOString() };
        await admin.from("ats_interviews").update(patch).eq("id", r.id);
      } else {
        failed++;
        console.error("[ats-interview-reminders]", res.error);
      }
    }
  };

  await process((d1Rows ?? []) as never[], "d1");
  await process((h1Rows ?? []) as never[], "1h");
  return { d1, h1, failed };
}

/** Confirma um slot escolhido pelo candidato via token público. */
export async function confirmSelfScheduledSlot(args: {
  token: string;
  slot: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await admin
    .from("ats_interviews")
    .select(
      "id, status, slots, self_schedule_expires_at, owner_id, application_id, job_id, candidate_id, duration_min",
    )
    .eq("self_schedule_token", args.token)
    .maybeSingle();
  if (!row) return { ok: false, error: "Token inválido" };
  if (row.status !== "pending_candidate")
    return { ok: false, error: "Esta entrevista já foi confirmada" };
  if (row.self_schedule_expires_at && new Date(row.self_schedule_expires_at) < new Date())
    return { ok: false, error: "Link expirado" };
  const slots = Array.isArray(row.slots) ? (row.slots as string[]) : [];
  if (!slots.includes(args.slot)) return { ok: false, error: "Horário indisponível" };

  await admin
    .from("ats_interviews")
    .update({
      status: "scheduled",
      scheduled_at: args.slot,
      self_schedule_token: null,
    })
    .eq("id", row.id);
  await admin.from("ats_application_events").insert({
    owner_id: row.owner_id,
    application_id: row.application_id,
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    event_type: "interview_self_scheduled",
    metadata: { interview_id: row.id, scheduled_at: args.slot },
  });
  return { ok: true };
}
