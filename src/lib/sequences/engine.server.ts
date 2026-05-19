// Sequence executor: avança enrollments cujo next_run_at já passou.
// Chamado pelo endpoint /api/public/hooks/sequences-tick a cada minuto.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SequenceEntity, SequenceStep } from "./types";

interface EnrollmentRow {
  id: string;
  owner_id: string;
  sequence_id: string;
  entity_id: string;
  current_step: number;
  status: string;
}

interface SequenceRow {
  id: string;
  entity: SequenceEntity;
  enabled: boolean;
  steps: SequenceStep[];
}

function addDays(days: number): string {
  return new Date(Date.now() + Math.max(0, days) * 86_400_000).toISOString();
}

async function executeStep(
  supabase: SupabaseClient,
  enrollment: EnrollmentRow,
  seq: SequenceRow,
  step: SequenceStep,
) {
  if (step.type === "wait") return;
  const relCol = seq.entity === "leads" ? "related_lead_id" : "related_contact_id";
  const { error } = await supabase.from("activities").insert({
    owner_id: enrollment.owner_id,
    type: step.type === "email" ? "email" : "task",
    subject: step.subject,
    body: "body" in step ? step.body ?? null : null,
    due_date: new Date().toISOString(),
    [relCol]: enrollment.entity_id,
  });
  if (error) throw new Error(error.message);
}

export async function tickSequences(supabase: SupabaseClient, limit = 100) {
  const nowIso = new Date().toISOString();
  const { data: enrollments, error } = await supabase
    .from("sequence_enrollments")
    .select("id, owner_id, sequence_id, entity_id, current_step, status")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  const seqCache = new Map<string, SequenceRow | null>();

  for (const enr of (enrollments ?? []) as EnrollmentRow[]) {
    try {
      let seq = seqCache.get(enr.sequence_id);
      if (seq === undefined) {
        const { data } = await supabase
          .from("sequences")
          .select("id, entity, enabled, steps")
          .eq("id", enr.sequence_id)
          .maybeSingle();
        seq = (data as SequenceRow | null) ?? null;
        seqCache.set(enr.sequence_id, seq);
      }
      if (!seq || !seq.enabled) {
        await supabase
          .from("sequence_enrollments")
          .update({ status: "paused", next_run_at: null })
          .eq("id", enr.id);
        results.push({ id: enr.id, ok: true });
        continue;
      }

      const steps = Array.isArray(seq.steps) ? seq.steps : [];
      const step = steps[enr.current_step];
      if (!step) {
        await supabase
          .from("sequence_enrollments")
          .update({ status: "completed", next_run_at: null, finished_at: nowIso })
          .eq("id", enr.id);
        results.push({ id: enr.id, ok: true });
        continue;
      }

      await executeStep(supabase, enr, seq, step);

      const nextIdx = enr.current_step + 1;
      const next = steps[nextIdx];
      const update: { current_step: number; status?: string; next_run_at?: string | null; finished_at?: string } = { current_step: nextIdx };
      if (!next) {
        update.status = "completed";
        update.next_run_at = null;
        update.finished_at = new Date().toISOString();
      } else {
        update.next_run_at = addDays(next.wait_days ?? 0);
      }
      await supabase.from("sequence_enrollments").update(update).eq("id", enr.id);
      results.push({ id: enr.id, ok: true });
    } catch (e) {
      results.push({ id: enr.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { processed: results.length, results };
}
