// Engine de envio de e-mails do ATS (Fase 1).
// Processa duas filas:
//   1. ats_candidate_email_queue — e-mails para o CANDIDATO (confirmação de candidatura)
//   2. ats_stage_email_log — e-mails configurados por stage pelo RECRUTADOR
// Em ambos os casos usamos a infra Lovable (@lovable.dev/email-js) via SUBDOMÍNIO
// já verificado pelo workspace.
import { sendLovableEmail } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOrCreateEmailUnsubscribeToken } from "@/lib/email-unsubscribe.server";

// Sender padrão do projeto — coincide com o utilizado em transactional/send.ts.
const SENDER_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_DOMAIN = "notify.crm.wktechnology.com.br";
const FROM_NAME_DEFAULT = "TechHire ATS";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderTemplate(tpl: string, vars: Record<string, string | null | undefined>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

async function getBrandingFor(ownerId: string): Promise<{
  productName: string;
  primaryColor: string | null;
}> {
  const { data: wm } = await admin
    .from("workspace_modules")
    .select("workspace_id")
    .eq("module_id", "ats")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!wm?.workspace_id) {
    return { productName: FROM_NAME_DEFAULT, primaryColor: null };
  }
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

async function sendOne(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  ownerId: string;
  label: string;
  messageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY missing" };
  const branding = await getBrandingFor(args.ownerId);
  try {
    const unsubscribeToken = await getOrCreateEmailUnsubscribeToken(args.to);
    await sendLovableEmail(
      {
        to: args.to,
        from: `${branding.productName} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: args.subject,
        html: args.html,
        text: args.text,
        purpose: "transactional",
        label: args.label,
        idempotency_key: args.messageId,
        message_id: args.messageId,
        unsubscribe_token: unsubscribeToken,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Processa fila de e-mails ao CANDIDATO. */
export async function tickAtsCandidateEmails(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const { data: pending } = await admin
    .from("ats_candidate_email_queue")
    .select("id, owner_id, application_id, candidate_id, job_id, to_email, subject, body_html, body_text, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  const rows = (pending ?? []) as Array<{
    id: string;
    owner_id: string;
    application_id: string | null;
    candidate_id: string;
    job_id: string | null;
    to_email: string;
    subject: string;
    body_html: string;
    body_text: string | null;
    attempts: number;
  }>;

  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    const res = await sendOne({
      to: r.to_email,
      subject: r.subject,
      html: r.body_html,
      text: r.body_text || stripHtml(r.body_html),
      ownerId: r.owner_id,
      label: "ats-candidate",
      messageId: r.id,
    });
    if (res.ok) {
      sent++;
      await admin
        .from("ats_candidate_email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (r.application_id) {
        await admin.from("ats_application_events").insert({
          owner_id: r.owner_id,
          application_id: r.application_id,
          job_id: r.job_id,
          candidate_id: r.candidate_id,
          event_type: "candidate_email_sent",
          metadata: { subject: r.subject, queue_id: r.id },
        });
      }
    } else {
      failed++;
      const newAttempts = r.attempts + 1;
      await admin
        .from("ats_candidate_email_queue")
        .update({
          status: newAttempts >= 5 ? "failed" : "pending",
          attempts: newAttempts,
          error: res.error,
          scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", r.id);
    }
  }
  return { processed: rows.length, sent, failed };
}

/** Processa fila de e-mails de STAGE (recrutador → candidato). */
export async function tickAtsStageEmails(limit = 20): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const { data: pending } = await admin
    .from("ats_stage_email_log")
    .select("id, owner_id, application_id, candidate_id, job_id, stage_value, to_email, subject, body, status, sent_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  const rows = (pending ?? []) as Array<{
    id: string;
    owner_id: string;
    application_id: string | null;
    candidate_id: string | null;
    job_id: string | null;
    stage_value: string;
    to_email: string;
    subject: string;
    body: string;
    status: string;
  }>;

  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    // Resolve as variáveis oferecidas na interface (ATS_CANDIDATE_TOKENS):
    // candidate.*, job.*, company.name e stage — mantendo as chaves legadas
    // `candidate_name`/`job_title` para templates já salvos.
    let candidateName: string | null = null;
    let candidateEmail: string | null = null;
    let jobTitle: string | null = null;
    let jobDepartment: string | null = null;
    if (r.candidate_id) {
      const { data: c } = await admin
        .from("ats_candidates")
        .select("full_name, email")
        .eq("id", r.candidate_id)
        .maybeSingle();
      candidateName = (c?.full_name as string) || null;
      candidateEmail = (c?.email as string) || null;
    }
    if (r.job_id) {
      const { data: j } = await admin
        .from("ats_jobs")
        .select("title, department")
        .eq("id", r.job_id)
        .maybeSingle();
      jobTitle = (j?.title as string) || null;
      jobDepartment = (j?.department as string) || null;
    }
    const branding = await getBrandingFor(r.owner_id);
    const firstName = (candidateName ?? "").split(" ")[0] || null;
    const vars = {
      // chaves legadas
      candidate_name: candidateName,
      job_title: jobTitle,
      stage: r.stage_value,
      // chaves exibidas na interface
      "candidate.full_name": candidateName,
      "candidate.first_name": firstName,
      "candidate.email": candidateEmail ?? r.to_email,
      "job.title": jobTitle,
      "job.department": jobDepartment,
      "company.name": branding.productName,
    };
    const subject = renderTemplate(r.subject, vars);
    const bodyHtml = renderTemplate(r.body, vars);


    const res = await sendOne({
      to: r.to_email,
      subject,
      html: bodyHtml,
      text: stripHtml(bodyHtml),
      ownerId: r.owner_id,
      label: `ats-stage-${r.stage_value}`,
      messageId: r.id,
    });
    if (res.ok) {
      sent++;
      await admin
        .from("ats_stage_email_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (r.application_id) {
        await admin.from("ats_application_events").insert({
          owner_id: r.owner_id,
          application_id: r.application_id,
          job_id: r.job_id,
          candidate_id: r.candidate_id,
          event_type: "stage_email_sent",
          metadata: { stage: r.stage_value, subject, log_id: r.id },
        });
      }
    } else {
      failed++;
      await admin
        .from("ats_stage_email_log")
        .update({ status: "failed", error: res.error, sent_at: new Date().toISOString() })
        .eq("id", r.id);
    }
  }
  return { processed: rows.length, sent, failed };
}

/** Helper público para enfileirar a confirmação de candidatura pública. */
export async function enqueueApplicationConfirmation(args: {
  ownerId: string;
  applicationId: string | null;
  candidateId: string;
  jobId: string;
  toEmail: string;
  candidateName: string;
  jobTitle: string;
}): Promise<void> {
  const branding = await getBrandingFor(args.ownerId);
  const color = branding.primaryColor || "#0ea5e9";
  const subject = `Recebemos sua candidatura para ${args.jobTitle}`;
  const html = `
<div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px;color:${color}">Candidatura recebida 🎉</h1>
  <p>Olá <strong>${args.candidateName}</strong>,</p>
  <p>Recebemos sua candidatura para a vaga <strong>${args.jobTitle}</strong>.
  Nosso time vai analisar seu perfil e te retorna em breve.</p>
  <p>Você pode acompanhar o status pelo e-mail deste contato.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#64748b">Enviado por ${branding.productName}.</p>
</div>`.trim();
  await admin.from("ats_candidate_email_queue").insert({
    owner_id: args.ownerId,
    application_id: args.applicationId,
    candidate_id: args.candidateId,
    job_id: args.jobId,
    to_email: args.toEmail,
    subject,
    body_html: html,
  });
}
