/**
 * Sourcing Analytics — Onda 5 / Slice 2 / Fase 5.
 *
 * Métricas operacionais e de performance das cadências de sourcing:
 *  - Volume: enrollments ativos / pausados / respondidos / encerrados / falhos.
 *  - Engajamento: taxa de resposta (replied / total).
 *  - Eficiência: tempo médio até resposta (started_at → finished_at quando replied).
 *  - Por sequência: ranking com sends, falhas, respostas e response rate.
 *  - Por canal (step_log): sends / failures / skips por canal.
 *  - Funil por step_order: sends e falhas em cada degrau da cadência.
 *
 * Todas as queries respeitam RLS via `requireSupabaseAuth`. Aggregations
 * acontecem em memória, considerando o volume típico (centenas a poucos
 * milhares de eventos por workspace por janela).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EnrollmentRow = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  sequence_id: string;
};

type StepLogRow = {
  id: string;
  enrollment_id: string;
  step_order: number;
  channel: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type SequenceRow = { id: string; name: string };

export type SequencePerformance = {
  id: string;
  name: string;
  total_enrollments: number;
  active: number;
  replied: number;
  failed: number;
  finished: number;
  paused: number;
  response_rate: number; // replied / total
  failure_rate: number; // failed / total
  avg_time_to_reply_hours: number | null;
};

export type ChannelStats = {
  channel: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
};

export type StepFunnel = {
  step_order: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type DailyPoint = {
  date: string; // YYYY-MM-DD
  enrollments: number;
  sent: number;
  replied: number;
  failed: number;
};

export type VariantStats = {
  sequence_id: string;
  sequence_name: string;
  step_order: number;
  variant: string;
  sent: number;
  enrolled: number;
  replied: number;
  response_rate: number;
};

export type SourcingAnalyticsResult = {
  window_days: number;
  totals: {
    enrollments: number;
    active: number;
    paused: number;
    replied: number;
    failed: number;
    finished: number;
    response_rate: number;
    avg_time_to_reply_hours: number | null;
  };
  by_sequence: SequencePerformance[];
  by_channel: ChannelStats[];
  funnel: StepFunnel[];
  timeseries: DailyPoint[];
  by_variant: VariantStats[];
};

export const getSourcingAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<SourcingAnalyticsResult> => {
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const [enrollmentsRes, stepLogRes, sequencesRes] = await Promise.all([
      context.supabase
        .from("ats_sourcing_enrollments")
        .select("id, status, started_at, finished_at, sequence_id")
        .gte("started_at", since)
        .limit(5000),
      context.supabase
        .from("ats_sourcing_step_log")
        .select("id, enrollment_id, step_order, channel, status, created_at, metadata")
        .gte("created_at", since)
        .limit(10000),
      context.supabase.from("ats_sourcing_sequences").select("id, name").limit(500),
    ]);

    if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
    if (stepLogRes.error) throw new Error(stepLogRes.error.message);
    if (sequencesRes.error) throw new Error(sequencesRes.error.message);

    const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[];
    const stepLog = (stepLogRes.data ?? []) as StepLogRow[];
    const sequences = (sequencesRes.data ?? []) as SequenceRow[];
    const seqName = new Map(sequences.map((s) => [s.id, s.name]));

    // Totals
    const totals = {
      enrollments: enrollments.length,
      active: 0,
      paused: 0,
      replied: 0,
      failed: 0,
      finished: 0,
      response_rate: 0,
      avg_time_to_reply_hours: null as number | null,
    };
    const replyDurations: number[] = [];
    for (const e of enrollments) {
      if (e.status === "active") totals.active++;
      else if (e.status === "paused") totals.paused++;
      else if (e.status === "replied") totals.replied++;
      else if (e.status === "failed") totals.failed++;
      else if (e.status === "finished" || e.status === "completed") totals.finished++;

      if (e.status === "replied" && e.finished_at) {
        const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime();
        if (ms >= 0) replyDurations.push(ms / 3_600_000);
      }
    }
    totals.response_rate = totals.enrollments > 0 ? totals.replied / totals.enrollments : 0;
    totals.avg_time_to_reply_hours =
      replyDurations.length > 0
        ? replyDurations.reduce((a, b) => a + b, 0) / replyDurations.length
        : null;

    // By sequence
    const perSeq = new Map<string, SequencePerformance>();
    const seqDurations = new Map<string, number[]>();
    for (const e of enrollments) {
      const id = e.sequence_id;
      if (!id) continue;
      let row = perSeq.get(id);
      if (!row) {
        row = {
          id,
          name: seqName.get(id) ?? "—",
          total_enrollments: 0,
          active: 0,
          replied: 0,
          failed: 0,
          finished: 0,
          paused: 0,
          response_rate: 0,
          failure_rate: 0,
          avg_time_to_reply_hours: null,
        };
        perSeq.set(id, row);
      }
      row.total_enrollments++;
      if (e.status === "active") row.active++;
      else if (e.status === "paused") row.paused++;
      else if (e.status === "replied") row.replied++;
      else if (e.status === "failed") row.failed++;
      else if (e.status === "finished" || e.status === "completed") row.finished++;
      if (e.status === "replied" && e.finished_at) {
        const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime();
        if (ms >= 0) {
          const arr = seqDurations.get(id) ?? [];
          arr.push(ms / 3_600_000);
          seqDurations.set(id, arr);
        }
      }
    }
    for (const row of perSeq.values()) {
      row.response_rate = row.total_enrollments > 0 ? row.replied / row.total_enrollments : 0;
      row.failure_rate = row.total_enrollments > 0 ? row.failed / row.total_enrollments : 0;
      const arr = seqDurations.get(row.id) ?? [];
      row.avg_time_to_reply_hours =
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    }
    const by_sequence = Array.from(perSeq.values()).sort(
      (a, b) => b.total_enrollments - a.total_enrollments,
    );

    // By channel
    const perChannel = new Map<string, ChannelStats>();
    for (const l of stepLog) {
      let row = perChannel.get(l.channel);
      if (!row) {
        row = { channel: l.channel, sent: 0, failed: 0, skipped: 0, total: 0 };
        perChannel.set(l.channel, row);
      }
      row.total++;
      if (l.status === "sent" || l.status === "queued" || l.status === "completed") row.sent++;
      else if (l.status === "failed") row.failed++;
      else if (l.status === "skipped") row.skipped++;
    }
    const by_channel = Array.from(perChannel.values()).sort((a, b) => b.total - a.total);

    // Funnel by step_order
    const perStep = new Map<number, StepFunnel>();
    for (const l of stepLog) {
      let row = perStep.get(l.step_order);
      if (!row) {
        row = { step_order: l.step_order, sent: 0, failed: 0, skipped: 0 };
        perStep.set(l.step_order, row);
      }
      if (l.status === "sent" || l.status === "queued" || l.status === "completed") row.sent++;
      else if (l.status === "failed") row.failed++;
      else if (l.status === "skipped") row.skipped++;
    }
    const funnel = Array.from(perStep.values()).sort((a, b) => a.step_order - b.step_order);

    // Time series (daily)
    const dayKey = (iso: string) => iso.slice(0, 10);
    const tsMap = new Map<string, DailyPoint>();
    const ensureDay = (d: string) => {
      let row = tsMap.get(d);
      if (!row) {
        row = { date: d, enrollments: 0, sent: 0, replied: 0, failed: 0 };
        tsMap.set(d, row);
      }
      return row;
    };
    // Pre-fill the window with zeros so charts have a continuous x-axis
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      ensureDay(d);
    }
    for (const e of enrollments) {
      ensureDay(dayKey(e.started_at)).enrollments++;
      if (e.status === "replied" && e.finished_at) {
        ensureDay(dayKey(e.finished_at)).replied++;
      }
    }
    for (const l of stepLog) {
      const row = ensureDay(dayKey(l.created_at));
      if (l.status === "sent" || l.status === "queued" || l.status === "completed") row.sent++;
      else if (l.status === "failed") row.failed++;
    }
    const timeseries = Array.from(tsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // A/B variants — agrupa step_log por (sequence, step_order, variant) via enrollment→sequence.
    const enrMap = new Map<string, { sequence_id: string; status: string }>();
    for (const e of enrollments) enrMap.set(e.id, { sequence_id: e.sequence_id, status: e.status });
    type VKey = string;
    const variantMap = new Map<
      VKey,
      {
        sequence_id: string;
        step_order: number;
        variant: string;
        sent: number;
        enrollees: Set<string>;
      }
    >();
    for (const l of stepLog) {
      const enr = enrMap.get(l.enrollment_id);
      if (!enr) continue;
      const variant = String((l.metadata as { variant?: string } | null)?.variant ?? "A");
      const key = `${enr.sequence_id}::${l.step_order}::${variant}`;
      let row = variantMap.get(key);
      if (!row) {
        row = {
          sequence_id: enr.sequence_id,
          step_order: l.step_order,
          variant,
          sent: 0,
          enrollees: new Set(),
        };
        variantMap.set(key, row);
      }
      if (l.status === "sent" || l.status === "task_created" || l.status === "completed") {
        row.sent++;
        row.enrollees.add(l.enrollment_id);
      }
    }
    const by_variant: VariantStats[] = Array.from(variantMap.values())
      .map((r) => {
        const enrolled = r.enrollees.size;
        let replied = 0;
        for (const eid of r.enrollees) {
          if (enrMap.get(eid)?.status === "replied") replied++;
        }
        return {
          sequence_id: r.sequence_id,
          sequence_name: seqName.get(r.sequence_id) ?? "—",
          step_order: r.step_order,
          variant: r.variant,
          sent: r.sent,
          enrolled,
          replied,
          response_rate: enrolled > 0 ? replied / enrolled : 0,
        };
      })
      .sort(
        (a, b) =>
          a.sequence_name.localeCompare(b.sequence_name) ||
          a.step_order - b.step_order ||
          a.variant.localeCompare(b.variant),
      );

    return {
      window_days: data.days,
      totals,
      by_sequence,
      by_channel,
      funnel,
      timeseries,
      by_variant,
    };
  });
