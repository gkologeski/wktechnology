// Engine para processar agendamentos de export de relatórios.
// Chamado pelo /api/public/hooks/scheduled-exports-tick a cada hora.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { REPORT_ENTITIES, type ReportEntity } from "@/lib/reports.functions";
import {
  buildRawMime,
  ensureAccessToken,
  gmailSendRaw,
  type EmailAccountRow,
} from "@/lib/gmail.server";

interface ScheduleRow {
  id: string;
  owner_id: string;
  report_id: string;
  name: string;
  recipients: string[];
  frequency: "daily" | "weekly" | "monthly";
  hour_of_day: number;
  day_of_week: number | null;
  day_of_month: number | null;
  email_account_id: string | null;
}

interface ReportRow {
  id: string;
  name: string;
  entity: ReportEntity;
  config: {
    entity: ReportEntity;
    groupBy: string;
    metric: "count" | "sum" | "avg";
    metricField?: string;
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
  };
}

/** Calcula próximo horário com base em now (UTC). */
export function computeNextRun(
  schedule: Pick<ScheduleRow, "frequency" | "hour_of_day" | "day_of_week" | "day_of_month">,
  from: Date = new Date(),
): Date {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(schedule.hour_of_day);
  if (schedule.frequency === "daily") {
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (schedule.frequency === "weekly") {
    const target = schedule.day_of_week ?? 1;
    let diff = (target - next.getUTCDay() + 7) % 7;
    if (diff === 0 && next <= from) diff = 7;
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }
  // monthly
  const target = Math.min(28, schedule.day_of_month ?? 1);
  next.setUTCDate(target);
  if (next <= from) {
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(target);
  }
  return next;
}

async function runReport(
  supabase: SupabaseClient,
  ownerId: string,
  report: ReportRow,
): Promise<Array<{ key: string; value: number; count: number }>> {
  const cfg = report.config;
  const ent = REPORT_ENTITIES[cfg.entity];
  if (!ent) throw new Error(`Entidade inválida: ${cfg.entity}`);
  const cols =
    cfg.metric === "count" ? cfg.groupBy : `${cfg.groupBy},${cfg.metricField}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from(ent.table).select(cols).eq("owner_id", ownerId).limit(5000);
  if (cfg.dateField && (ent.date as readonly string[]).includes(cfg.dateField)) {
    if (cfg.dateFrom) q = q.gte(cfg.dateField, cfg.dateFrom);
    if (cfg.dateTo) q = q.lte(cfg.dateField, cfg.dateTo);
  }
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const buckets = new Map<string, { key: string; count: number; sum: number }>();
  for (const r of ((rows ?? []) as Record<string, unknown>[])) {
    const k = String(r[cfg.groupBy] ?? "—");
    const b = buckets.get(k) ?? { key: k, count: 0, sum: 0 };
    b.count += 1;
    if (cfg.metric !== "count" && cfg.metricField) {
      const v = Number(r[cfg.metricField] ?? 0);
      if (!Number.isNaN(v)) b.sum += v;
    }
    buckets.set(k, b);
  }
  const arr = Array.from(buckets.values()).map((b) => ({
    key: b.key,
    value: cfg.metric === "count" ? b.count : cfg.metric === "sum" ? b.sum : (b.count ? b.sum / b.count : 0),
    count: b.count,
  }));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, cfg.limit ?? 50);
}

function toCsv(report: ReportRow, rows: Array<{ key: string; value: number; count: number }>): string {
  const cfg = report.config;
  const metricLabel = cfg.metric === "count" ? "Quantidade" : cfg.metric === "sum" ? "Soma" : "Média";
  const lines = [`"${cfg.groupBy}","${metricLabel}","Quantidade"`];
  for (const r of rows) {
    lines.push(`"${String(r.key).replace(/"/g, '""')}",${r.value},${r.count}`);
  }
  return lines.join("\r\n") + "\r\n";
}

function buildMimeWithAttachment(opts: {
  from: string;
  to: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  filename: string;
  csv: string;
}): string {
  const mixedBoundary = `mix_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const altBoundary = `alt_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

  const altPart = [
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.bodyText,
    "",
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.bodyHtml,
    "",
    `--${altBoundary}--`,
  ].join("\r\n");

  const csvB64 = Buffer.from(opts.csv, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];

  const body = [
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    altPart,
    "",
    `--${mixedBoundary}`,
    `Content-Type: text/csv; charset=UTF-8; name="${opts.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${opts.filename}"`,
    "",
    csvB64,
    "",
    `--${mixedBoundary}--`,
    "",
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n" + body;
}

async function getGmailAccount(ownerId: string, accountId: string | null): Promise<EmailAccountRow | null> {
  let q = supabaseAdmin
    .from("email_accounts")
    .select("id, owner_id, email, access_token, refresh_token, expires_at, status, history_id")
    .eq("owner_id", ownerId)
    .eq("provider", "gmail")
    .eq("status", "connected");
  if (accountId) q = q.eq("id", accountId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as EmailAccountRow | undefined) ?? null;
}

export async function runExportNow(scheduleId: string): Promise<{
  ok: boolean;
  rows: number;
  storage_path?: string;
  error?: string;
}> {
  const { data: schedule, error: sErr } = await supabaseAdmin
    .from("report_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();
  if (sErr || !schedule) throw new Error(sErr?.message ?? "Agendamento não encontrado");

  const s = schedule as ScheduleRow;

  try {
    const { data: report, error: rErr } = await supabaseAdmin
      .from("custom_reports")
      .select("id, name, entity, config")
      .eq("id", s.report_id)
      .single();
    if (rErr || !report) throw new Error("Relatório não encontrado");

    const rows = await runReport(supabaseAdmin, s.owner_id, report as ReportRow);
    const csv = toCsv(report as ReportRow, rows);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `${(report as ReportRow).name.replace(/[^a-z0-9-_]/gi, "_")}_${stamp}.csv`;
    const storagePath = `${s.owner_id}/${s.id}/${filename}`;

    await supabaseAdmin.storage
      .from("exports")
      .upload(storagePath, new Blob([csv], { type: "text/csv" }), {
        upsert: true,
        contentType: "text/csv",
      });

    if (s.recipients.length > 0) {
      const account = await getGmailAccount(s.owner_id, s.email_account_id);
      if (!account) throw new Error("Nenhuma conta Gmail conectada para envio");
      const accessToken = await ensureAccessToken(account);

      const subject = `[Relatório agendado] ${(report as ReportRow).name}`;
      const bodyText = `Segue em anexo o relatório "${(report as ReportRow).name}" com ${rows.length} linhas.\n\nGerado em ${new Date().toISOString()}.\n\n— Lovable CRM`;
      const bodyHtml = `<p>Segue em anexo o relatório <strong>${(report as ReportRow).name}</strong> com <strong>${rows.length}</strong> linhas.</p><p>Gerado em ${new Date().toISOString()}.</p><p>— Lovable CRM</p>`;

      const raw = buildMimeWithAttachment({
        from: account.email,
        to: s.recipients,
        subject,
        bodyText,
        bodyHtml,
        filename,
        csv,
      });
      // Avoid unused import warning when no attachment helper needed:
      void buildRawMime;
      await gmailSendRaw(accessToken, raw);
    }

    const nextRun = computeNextRun(s).toISOString();
    await supabaseAdmin
      .from("report_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_error: null,
        next_run_at: nextRun,
      })
      .eq("id", s.id);

    return { ok: true, rows: rows.length, storage_path: storagePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("report_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "error",
        last_error: msg.slice(0, 1000),
        next_run_at: computeNextRun(s).toISOString(),
      })
      .eq("id", s.id);
    return { ok: false, rows: 0, error: msg };
  }
}

/** Processa todos os agendamentos com next_run_at vencido. */
export async function tickScheduledExports(limit = 25): Promise<{ processed: number; errors: number }> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("report_schedules")
    .select("id")
    .eq("enabled", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  let processed = 0;
  let errors = 0;
  for (const row of (due ?? []) as { id: string }[]) {
    const r = await runExportNow(row.id).catch((e) => ({ ok: false, error: String(e), rows: 0 }));
    processed += 1;
    if (!r.ok) errors += 1;
  }
  return { processed, errors };
}
