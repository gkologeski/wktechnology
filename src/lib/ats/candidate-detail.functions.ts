import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const IdInput = z.object({ id: z.string().uuid() });

export type CandidateApplication = {
  id: string;
  job_id: string;
  job_title: string | null;
  job_status: string | null;
  stage_value: string;
  status: string;
  source: string | null;
  ai_match_score: number | null;
  applied_at: string | null;
  moved_at: string | null;
  assigned_to: string | null;
};

export type CandidatePoolMembership = {
  membership_id: string;
  pool_id: string;
  pool_name: string;
  added_at: string;
};

export type CandidateInterview = {
  id: string;
  scheduled_at: string | null;
  status: string;
  kind: string | null;
  job_id: string | null;
  job_title: string | null;
};

export type CandidateOffer = {
  id: string;
  job_id: string | null;
  job_title: string | null;
  status: string;
  salary_amount: number | null;
  salary_currency: string | null;
  sent_at: string | null;
  signed_at: string | null;
};

export type CandidateFlag = {
  id: string;
  kind: string;
  severity: string | null;
  details_json: string | null;
  resolved: boolean | null;
  created_at: string;
};

export type CandidateEvent = {
  id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  created_at: string;
  metadata_json: string | null;
};

export type RichJson = string | number | boolean | null | RichJson[] | { [key: string]: RichJson };

export type CandidateDetail = {
  candidate: {
    id: string;
    assigned_to: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    location: string | null;
    current_position: string | null;
    current_company: string | null;
    cv_url: string | null;
    skills: string[];
    tags: string[];
    source: string | null;
    score: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    last_touch_at: string | null;
    next_action_at: string | null;
    // Rich profile data (LinkedIn capture v2.0+)
    headline: string | null;
    about: string | null;
    photo_url: string | null;
    open_to_work: boolean | null;
    connection_degree: string | null;
    capture_version: string | null;
    captured_at: string | null;
    experiences: RichJson;
    education: RichJson;
    certifications: RichJson;
    languages: RichJson;
    skills_detailed: RichJson;
    projects: RichJson;
    publications: RichJson;
    volunteering: RichJson;
    external_links: RichJson;
    available_actions: RichJson;
    current_company_data: RichJson;
    recent_activity: RichJson;
    recommendations: RichJson;
  };
  derived_status: "hired" | "offer" | "interview" | "in_process" | "archived" | "new";
  applications: CandidateApplication[];
  pools: CandidatePoolMembership[];
  interviews: CandidateInterview[];
  offers: CandidateOffer[];
  flags: CandidateFlag[];
  events: CandidateEvent[];
};

export const getCandidateDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: cand, error: candErr } = await supabase
      .from("ats_candidates")
      .select(
        "id, owner_id, assigned_to, full_name, email, phone, linkedin_url, location, current_position, current_company, cv_url, skills, tags, source, score, notes, created_at, updated_at, last_touch_at, next_action_at, headline, about, photo_url, open_to_work, connection_degree, capture_version, captured_at, experiences, education, certifications, languages, skills_detailed, projects, publications, volunteering, external_links, available_actions, current_company_data, recent_activity, recommendations",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (candErr) throw new Error(candErr.message);
    if (!cand) return null;

    const { data: appsRaw } = await supabase
      .from("ats_applications")
      .select(
        "id, job_id, stage_value, status, source, ai_match_score, applied_at, moved_at, assigned_to",
      )
      .eq("candidate_id", data.id)
      .order("moved_at", { ascending: false });
    const apps = (appsRaw ?? []) as unknown as Array<{
      id: string;
      job_id: string;
      stage_value: string;
      status: string;
      source: string | null;
      ai_match_score: number | null;
      applied_at: string | null;
      moved_at: string | null;
      assigned_to: string | null;
    }>;

    const jobIds = Array.from(new Set(apps.map((a) => a.job_id).filter(Boolean)));
    const jobMap = new Map<string, { title: string | null; status: string | null }>();
    if (jobIds.length) {
      const { data: jobs } = await supabase
        .from("ats_jobs")
        .select("id, title, status")
        .in("id", jobIds);
      for (const j of (jobs ?? []) as unknown as Array<{
        id: string;
        title: string | null;
        status: string | null;
      }>) {
        jobMap.set(j.id, { title: j.title, status: j.status });
      }
    }

    const applications: CandidateApplication[] = apps.map((a) => ({
      id: a.id,
      job_id: a.job_id,
      job_title: jobMap.get(a.job_id)?.title ?? null,
      job_status: jobMap.get(a.job_id)?.status ?? null,
      stage_value: a.stage_value,
      status: a.status,
      source: a.source,
      ai_match_score: a.ai_match_score,
      applied_at: a.applied_at,
      moved_at: a.moved_at,
      assigned_to: a.assigned_to,
    }));

    // Pools
    const { data: poolRowsRaw } = await supabase
      .from("ats_talent_pool_members")
      .select("id, pool_id, added_at")
      .eq("candidate_id", data.id);
    const poolRows = (poolRowsRaw ?? []) as unknown as Array<{
      id: string;
      pool_id: string;
      added_at: string;
    }>;
    const poolIds = Array.from(new Set(poolRows.map((r) => r.pool_id)));
    const poolMap = new Map<string, string>();
    if (poolIds.length) {
      const { data: pools } = await supabase
        .from("ats_talent_pools")
        .select("id, name")
        .in("id", poolIds);
      for (const p of (pools ?? []) as unknown as Array<{ id: string; name: string }>) {
        poolMap.set(p.id, p.name);
      }
    }
    const pools: CandidatePoolMembership[] = poolRows.map((m) => ({
      membership_id: m.id,
      pool_id: m.pool_id,
      pool_name: poolMap.get(m.pool_id) ?? "Pool",
      added_at: m.added_at,
    }));

    // Interviews
    const { data: ivRowsRaw } = await supabase
      .from("ats_interviews")
      .select("id, scheduled_at, status, kind, job_id")
      .eq("candidate_id", data.id)
      .order("scheduled_at", { ascending: false })
      .limit(20);
    const ivRows = (ivRowsRaw ?? []) as unknown as Array<{
      id: string;
      scheduled_at: string | null;
      status: string;
      kind: string | null;
      job_id: string | null;
    }>;
    const ivJobIds = Array.from(new Set(ivRows.map((r) => r.job_id).filter(Boolean) as string[]));
    const ivJobMap = new Map<string, string | null>();
    if (ivJobIds.length) {
      const { data: js } = await supabase.from("ats_jobs").select("id, title").in("id", ivJobIds);
      for (const j of (js ?? []) as unknown as Array<{ id: string; title: string | null }>) {
        ivJobMap.set(j.id, j.title);
      }
    }
    const interviews: CandidateInterview[] = ivRows.map((i) => ({
      id: i.id,
      scheduled_at: i.scheduled_at,
      status: i.status,
      kind: i.kind,
      job_id: i.job_id,
      job_title: i.job_id ? (ivJobMap.get(i.job_id) ?? null) : null,
    }));

    // Offers
    const { data: offerRowsRaw } = await supabase
      .from("ats_offers")
      .select("id, job_id, status, salary_amount, salary_currency, sent_at, signed_at")
      .eq("candidate_id", data.id)
      .order("sent_at", { ascending: false });
    const offerRows = (offerRowsRaw ?? []) as unknown as Array<{
      id: string;
      job_id: string | null;
      status: string;
      salary_amount: number | null;
      salary_currency: string | null;
      sent_at: string | null;
      signed_at: string | null;
    }>;
    const offJobIds = Array.from(
      new Set(offerRows.map((r) => r.job_id).filter(Boolean) as string[]),
    );
    const offJobMap = new Map<string, string | null>();
    if (offJobIds.length) {
      const { data: js } = await supabase.from("ats_jobs").select("id, title").in("id", offJobIds);
      for (const j of (js ?? []) as unknown as Array<{ id: string; title: string | null }>) {
        offJobMap.set(j.id, j.title);
      }
    }
    const offers: CandidateOffer[] = offerRows.map((o) => ({
      id: o.id,
      job_id: o.job_id,
      job_title: o.job_id ? (offJobMap.get(o.job_id) ?? null) : null,
      status: o.status,
      salary_amount: o.salary_amount,
      salary_currency: o.salary_currency,
      sent_at: o.sent_at,
      signed_at: o.signed_at,
    }));

    // Flags
    const { data: flagRowsRaw } = await supabase
      .from("ats_candidate_flags")
      .select("id, kind, severity, details, resolved, created_at")
      .eq("candidate_id", data.id)
      .order("created_at", { ascending: false });
    const flags: CandidateFlag[] = (
      (flagRowsRaw ?? []) as unknown as Array<{
        id: string;
        kind: string;
        severity: string | null;
        details: unknown;
        resolved: boolean | null;
        created_at: string;
      }>
    ).map((f) => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      details_json: f.details == null ? null : JSON.stringify(f.details),
      resolved: f.resolved,
      created_at: f.created_at,
    }));

    // Events
    const appIds = apps.map((a) => a.id);
    let events: CandidateEvent[] = [];
    if (appIds.length) {
      const { data: evRowsRaw } = await supabase
        .from("ats_application_events")
        .select("id, event_type, from_stage, to_stage, created_at, metadata")
        .in("application_id", appIds)
        .order("created_at", { ascending: false })
        .limit(50);
      events = (
        (evRowsRaw ?? []) as unknown as Array<{
          id: string;
          event_type: string;
          from_stage: string | null;
          to_stage: string | null;
          created_at: string;
          metadata: unknown;
        }>
      ).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        from_stage: e.from_stage,
        to_stage: e.to_stage,
        created_at: e.created_at,
        metadata_json: e.metadata == null ? null : JSON.stringify(e.metadata),
      }));
    }

    // Derived status
    const now = Date.now();
    let derived: CandidateDetail["derived_status"] = "new";
    if (offers.some((o) => o.status === "accepted" || o.status === "signed")) derived = "hired";
    else if (offers.some((o) => o.status === "sent" || o.status === "viewed")) derived = "offer";
    else if (
      interviews.some(
        (i) =>
          i.scheduled_at && new Date(i.scheduled_at).getTime() > now && i.status !== "cancelled",
      )
    )
      derived = "interview";
    else if (applications.some((a) => a.status === "active")) derived = "in_process";
    else if (
      applications.length > 0 &&
      applications.every((a) => a.status === "rejected" || a.status === "withdrawn")
    )
      derived = "archived";

    const detail: CandidateDetail = {
      candidate: {
        id: cand.id as string,
        assigned_to: (cand.assigned_to as string | null) ?? null,
        full_name: cand.full_name as string,
        email: (cand.email as string | null) ?? null,
        phone: (cand.phone as string | null) ?? null,
        linkedin_url: (cand.linkedin_url as string | null) ?? null,
        location: (cand.location as string | null) ?? null,
        current_position: (cand.current_position as string | null) ?? null,
        current_company: (cand.current_company as string | null) ?? null,
        cv_url: (cand.cv_url as string | null) ?? null,
        skills: (cand.skills as string[] | null) ?? [],
        tags: (cand.tags as string[] | null) ?? [],
        source: (cand.source as string | null) ?? null,
        score: (cand.score as number | null) ?? null,
        notes: (cand.notes as string | null) ?? null,
        created_at: cand.created_at as string,
        updated_at: cand.updated_at as string,
        last_touch_at: (cand.last_touch_at as string | null) ?? null,
        next_action_at: (cand.next_action_at as string | null) ?? null,
        headline: ((cand as Record<string, unknown>).headline as string | null) ?? null,
        about: ((cand as Record<string, unknown>).about as string | null) ?? null,
        photo_url: ((cand as Record<string, unknown>).photo_url as string | null) ?? null,
        open_to_work: ((cand as Record<string, unknown>).open_to_work as boolean | null) ?? null,
        connection_degree:
          ((cand as Record<string, unknown>).connection_degree as string | null) ?? null,
        capture_version:
          ((cand as Record<string, unknown>).capture_version as string | null) ?? null,
        captured_at: ((cand as Record<string, unknown>).captured_at as string | null) ?? null,
        experiences: ((cand as Record<string, unknown>).experiences as RichJson) ?? null,
        education: ((cand as Record<string, unknown>).education as RichJson) ?? null,
        certifications: ((cand as Record<string, unknown>).certifications as RichJson) ?? null,
        languages: ((cand as Record<string, unknown>).languages as RichJson) ?? null,
        skills_detailed: ((cand as Record<string, unknown>).skills_detailed as RichJson) ?? null,
        projects: ((cand as Record<string, unknown>).projects as RichJson) ?? null,
        publications: ((cand as Record<string, unknown>).publications as RichJson) ?? null,
        volunteering: ((cand as Record<string, unknown>).volunteering as RichJson) ?? null,
        external_links: ((cand as Record<string, unknown>).external_links as RichJson) ?? null,
        available_actions:
          ((cand as Record<string, unknown>).available_actions as RichJson) ?? null,
        current_company_data:
          ((cand as Record<string, unknown>).current_company_data as RichJson) ?? null,
        recent_activity: ((cand as Record<string, unknown>).recent_activity as RichJson) ?? null,
        recommendations: ((cand as Record<string, unknown>).recommendations as RichJson) ?? null,
      },
      derived_status: derived,
      applications,
      pools,
      interviews,
      offers,
      flags,
      events,
    };
    return detail;
  });

export const removeCandidateFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ membership_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await deleteByIdGuarded(
      supabase,
      "ats_talent_pool_members",
      data.membership_id,
      "Você não tem permissão para excluir este membro do pool.",
    );
    return { ok: true };
  });
