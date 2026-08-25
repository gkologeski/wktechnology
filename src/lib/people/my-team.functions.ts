// TechPeople — /people/my-team
// Lista os liderados diretos do usuário autenticado (people.manager_id →
// person.profile_id = auth.uid()), com métricas rápidas do time.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyTeamMember = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  email: string | null;
  photo_url: string | null;
  role_title: string | null;
  status: string;
  employment_type: string;
  hire_date: string | null;
  active_allocations: number;
  hours_this_month: number;
  pending_approval_hours: number;
  docs_expiring_30d: number;
  next_one_on_one: string | null;
};

type PersonMini = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  email: string | null;
  photo_url: string | null;
  role_title: string | null;
  status: string;
  employment_type: string;
  hire_date: string | null;
  archived: boolean;
};

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const getMyTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: MyTeamMember[] }> => {
    const { supabase, userId } = context;

    // 1) Identifica registros de "pessoa" que representam o usuário logado.
    const { data: myPeople, error: mErr } = await supabase
      .from("people")
      .select("id")
      .eq("profile_id", userId)
      .eq("archived", false);
    if (mErr) throw new Error(mErr.message);
    const myPeopleIds = ((myPeople as { id: string }[] | null) ?? []).map((p) => p.id);
    if (myPeopleIds.length === 0) return { members: [] };

    // 2) Busca liderados diretos.
    const { data: team, error: tErr } = await supabase
      .from("people")
      .select(
        "id, full_name, preferred_name, email, photo_url, role_title, status, employment_type, hire_date, archived",
      )
      .in("manager_id", myPeopleIds)
      .eq("archived", false)
      .order("full_name", { ascending: true });
    if (tErr) throw new Error(tErr.message);
    const members = ((team as PersonMini[] | null) ?? []).filter((p) => !p.archived);
    if (members.length === 0) return { members: [] };

    const teamIds = members.map((m) => m.id);
    const mStart = monthStart();
    const doc30 = plusDaysIso(30);
    const nowIso = new Date().toISOString();

    // 3) Métricas em paralelo.
    const [allocsRes, entriesRes, docsRes, oneOnOnesRes] = await Promise.all([
      supabase
        .from("people_allocations")
        .select("person_id, status")
        .in("person_id", teamIds)
        .eq("status", "active"),
      supabase
        .from("project_time_entries")
        .select("person_id, hours, approved_at, entry_date")
        .in("person_id", teamIds)
        .gte("entry_date", mStart),
      supabase
        .from("people_documents")
        .select("person_id, expires_on")
        .in("person_id", teamIds)
        .not("expires_on", "is", null)
        .lte("expires_on", doc30),
      supabase
        .from("people_one_on_ones")
        .select("person_id, scheduled_at")
        .in("person_id", teamIds)
        .gte("scheduled_at", nowIso)
        .order("scheduled_at", { ascending: true }),
    ]);

    const allocCount = new Map<string, number>();
    for (const a of (allocsRes.data as { person_id: string }[] | null) ?? []) {
      allocCount.set(a.person_id, (allocCount.get(a.person_id) ?? 0) + 1);
    }

    const hoursMonth = new Map<string, number>();
    const pendingHours = new Map<string, number>();
    for (const e of (entriesRes.data as
      | {
          person_id: string;
          hours: number | null;
          approved_at: string | null;
        }[]
      | null) ?? []) {
      const h = Number(e.hours ?? 0);
      hoursMonth.set(e.person_id, (hoursMonth.get(e.person_id) ?? 0) + h);
      if (!e.approved_at) {
        pendingHours.set(e.person_id, (pendingHours.get(e.person_id) ?? 0) + h);
      }
    }

    const docsExp = new Map<string, number>();
    for (const d of (docsRes.data as { person_id: string }[] | null) ?? []) {
      docsExp.set(d.person_id, (docsExp.get(d.person_id) ?? 0) + 1);
    }

    const nextOoO = new Map<string, string>();
    for (const o of (oneOnOnesRes.data as
      | {
          person_id: string;
          scheduled_at: string;
        }[]
      | null) ?? []) {
      if (!nextOoO.has(o.person_id)) nextOoO.set(o.person_id, o.scheduled_at);
    }

    const result: MyTeamMember[] = members.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      preferred_name: m.preferred_name,
      email: m.email,
      photo_url: m.photo_url,
      role_title: m.role_title,
      status: m.status,
      employment_type: m.employment_type,
      hire_date: m.hire_date,
      active_allocations: allocCount.get(m.id) ?? 0,
      hours_this_month: Number((hoursMonth.get(m.id) ?? 0).toFixed(2)),
      pending_approval_hours: Number((pendingHours.get(m.id) ?? 0).toFixed(2)),
      docs_expiring_30d: docsExp.get(m.id) ?? 0,
      next_one_on_one: nextOoO.get(m.id) ?? null,
    }));
    return { members: result };
  });
