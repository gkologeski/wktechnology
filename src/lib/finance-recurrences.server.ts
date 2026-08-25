// Sprint H — Fase 2: engine server-only para avançar recorrências financeiras.
// Não expõe API pública: consumido por finance-recurrences.functions.ts e pelo
// cron banking-tick / recurrences-tick.
import type { SupabaseClient } from "@supabase/supabase-js";

type Cadence = "weekly" | "monthly" | "yearly" | "custom_days";

export type RecurrenceRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  direction: "receivable" | "payable";
  template: Record<string, unknown>;
  cadence: Cadence;
  interval_days: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  occurrences_generated: number;
  next_run_date: string;
  active: boolean;
  last_generated_entry_id: string | null;
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, months: number, dayOfMonth?: number | null): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const targetMonth = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1));
  const desired = dayOfMonth ?? d.getUTCDate();
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(desired, lastDay));
  return target.toISOString().slice(0, 10);
}

export function computeNextRunDate(row: RecurrenceRow, from?: string): string {
  const base = from ?? row.next_run_date;
  switch (row.cadence) {
    case "weekly":
      return addDaysISO(base, 7);
    case "yearly":
      return addMonthsISO(base, 12, row.day_of_month);
    case "custom_days":
      return addDaysISO(base, Math.max(1, row.interval_days ?? 30));
    case "monthly":
    default:
      return addMonthsISO(base, 1, row.day_of_month);
  }
}

// Insere um financial_entry a partir do template e avança next_run_date.
// Retorna o estado atualizado ou null se não gerou (fim, limite, inativa).
export async function advanceRecurrenceOnce(
  supabase: SupabaseClient,
  row: RecurrenceRow,
  today: string,
): Promise<{ next_run_date: string; occurrences_generated: number; active: boolean } | null> {
  if (!row.active) return null;
  if (row.next_run_date > today) return null;
  if (row.max_occurrences && row.occurrences_generated >= row.max_occurrences) {
    await supabase.from("financial_recurrences").update({ active: false }).eq("id", row.id);
    return null;
  }
  if (row.end_date && row.next_run_date > row.end_date) {
    await supabase.from("financial_recurrences").update({ active: false }).eq("id", row.id);
    return null;
  }

  const t = row.template as Record<string, unknown>;
  const entryPayload = {
    workspace_id: row.workspace_id,
    owner_id: row.owner_id,
    direction: row.direction,
    origin_type: "manual" as const,
    status: "open" as const,
    description: String(t.description ?? "Recorrência"),
    amount: Number(t.amount ?? 0),
    currency: (t.currency as string) ?? "BRL",
    category_id: (t.category_id as string | null) ?? null,
    counterparty_company_id: (t.counterparty_company_id as string | null) ?? null,
    contract_id: (t.contract_id as string | null) ?? null,
    service_id: (t.service_id as string | null) ?? null,
    project_id: (t.project_id as string | null) ?? null,
    payment_method: (t.payment_method as string | null) ?? null,
    notes: (t.notes as string | null) ?? null,
    due_date: row.next_run_date,
    external_ref: `recurrence:${row.id}`,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("financial_entries")
    .insert(entryPayload)
    .select("id")
    .single();
  if (insErr) throw insErr;

  const nextRun = computeNextRunDate(row);
  const newCount = row.occurrences_generated + 1;
  const reachedMax = !!row.max_occurrences && newCount >= row.max_occurrences;
  const reachedEnd = !!row.end_date && nextRun > (row.end_date as string);
  const stillActive = !reachedMax && !reachedEnd;

  const { error: updErr } = await supabase
    .from("financial_recurrences")
    .update({
      next_run_date: nextRun,
      occurrences_generated: newCount,
      last_generated_entry_id: inserted?.id ?? null,
      active: stillActive,
    })
    .eq("id", row.id);
  if (updErr) throw updErr;

  return { next_run_date: nextRun, occurrences_generated: newCount, active: stillActive };
}

// Executado pelo cron. Percorre todas as recorrências ativas com next_run_date<=hoje
// usando o cliente admin (bypassa RLS). Não deve ser chamado da UI.
export async function runAllDueRecurrences(admin: SupabaseClient): Promise<{
  processed: number;
  generated: number;
  errors: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await admin
    .from("financial_recurrences")
    .select("*")
    .eq("active", true)
    .lte("next_run_date", today)
    .limit(500);
  if (error) throw error;
  let generated = 0;
  let errors = 0;
  for (const r of (due as RecurrenceRow[] | null) ?? []) {
    try {
      for (let i = 0; i < 24; i++) {
        const advanced = await advanceRecurrenceOnce(admin, r, today);
        if (!advanced) break;
        generated++;
        r.next_run_date = advanced.next_run_date;
        r.occurrences_generated = advanced.occurrences_generated;
        r.active = advanced.active;
        if (!advanced.active || r.next_run_date > today) break;
      }
    } catch (err) {
      errors++;
      console.error("[recurrences-tick] failed", r.id, err);
    }
  }
  return { processed: (due ?? []).length, generated, errors };
}
