// Helpers server-only dos indicadores de horas (jornada, alocações e soma em segundos).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AllocationSlice, WorkSchedule } from "@/lib/projects/time-entry.shared";

/** Jornada e alocações vigentes da pessoa do People ligada ao login (RLS do usuário). */
export async function loadCapacity(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<{
  schedule: WorkSchedule | null;
  allocations: AllocationSlice[];
  personLinked: boolean;
}> {
  const { data: people } = await supabase
    .from("people")
    .select("id, work_schedule")
    .eq("profile_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .limit(2);
  // Mais de uma pessoa para o mesmo login é ambíguo: não escolhemos uma por conta própria.
  if (!people || people.length !== 1) {
    return { schedule: null, allocations: [], personLinked: (people?.length ?? 0) > 0 };
  }
  const person = people[0]!;
  const { data: allocations } = await supabase
    .from("people_allocations")
    .select("allocation_pct, starts_at, ends_at, status")
    .eq("person_id", person.id)
    .eq("status", "active");
  return {
    schedule: (person.work_schedule as WorkSchedule | null) ?? null,
    allocations: (allocations ?? []).map((a) => ({
      allocation_pct: a.allocation_pct as number | null,
      starts_at: a.starts_at as string | null,
      ends_at: a.ends_at as string | null,
    })),
    personLinked: true,
  };
}

/** Segundos apontados por dia (paginado no banco; usa duração canônica ou UTC exato do importado). */
export async function sumEntrySeconds(
  supabase: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const pageSize = 1000;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("project_time_entries")
      .select("id, entry_date, duration_seconds, duration_minutes, hours, started_at, stopped_at")
      .eq("user_id", userId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const e of data ?? []) {
      const secs =
        e.duration_seconds ??
        (e.started_at && e.stopped_at
          ? Math.max(0, Math.floor((Date.parse(e.stopped_at) - Date.parse(e.started_at)) / 1000))
          : e.duration_minutes != null
            ? e.duration_minutes * 60
            : Math.round((e.hours ?? 0) * 3600));
      out.set(e.entry_date, (out.get(e.entry_date) ?? 0) + secs);
    }
    if ((data ?? []).length < pageSize) break;
  }
  return out;
}

export function weekBounds(isoDate: string): { from: string; to: string } {
  const ref = new Date(`${isoDate}T12:00:00Z`);
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function monthBounds(isoDate: string): { from: string; to: string } {
  const [y, m] = isoDate.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const last = new Date(Date.UTC(y, m, 0, 12));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}
