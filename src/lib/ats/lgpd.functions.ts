// ATS LGPD/DSAR: candidate-scoped data subject requests, consent tracking and retention.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

export type DsarType = "export" | "erasure" | "rectification" | "access";
export type DsarStatus = "pending" | "in_progress" | "completed" | "rejected";

export interface DsarRequest {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  subject_email: string | null;
  request_type: DsarType;
  status: DsarStatus;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface CandidateConsent {
  id: string;
  candidate_id: string;
  purpose: string;
  granted: boolean;
  source: string;
  legal_basis: string | null;
  expires_at: string | null;
  granted_at: string;
  revoked_at: string | null;
}

export interface CandidateExportSnapshot {
  exported_at: string;
  candidate: Json;
  applications: Json;
  consents: Json;
  scorecards: Json;
  interviews: Json;
}

const createSchema = z.object({
  candidate_id: z.string().uuid(),
  request_type: z.enum(["export", "erasure", "rectification", "access"]),
  subject_email: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listDsarRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: DsarStatus } = {}) => input)
  .handler(async ({ data, context }): Promise<DsarRequest[]> => {
    const { supabase, userId } = context;
    let q = supabase
      .from("ats_dsar_requests")
      .select(
        "id, candidate_id, subject_email, request_type, status, notes, created_at, processed_at, ats_candidates!inner(full_name)",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      candidate_id: r.candidate_id as string,
      candidate_name: (r.ats_candidates as { full_name?: string } | null)?.full_name ?? null,
      subject_email: (r.subject_email as string | null) ?? null,
      request_type: r.request_type as DsarType,
      status: r.status as DsarStatus,
      notes: (r.notes as string | null) ?? null,
      created_at: r.created_at as string,
      processed_at: (r.processed_at as string | null) ?? null,
    }));
  });

export const createDsarRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createSchema>) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ats_dsar_requests")
      .insert({
        owner_id: userId,
        candidate_id: data.candidate_id,
        request_type: data.request_type,
        subject_email: data.subject_email ?? null,
        notes: data.notes ?? null,
        requested_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const exportCandidateData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidate_id: string; dsar_id?: string }) => input)
  .handler(async ({ data, context }): Promise<CandidateExportSnapshot> => {
    const { supabase, userId } = context;
    const cid = data.candidate_id;

    // Fetch applications first so we can fan out to scorecard responses by application_id.
    const { data: appsData } = await supabase
      .from("ats_applications")
      .select("*")
      .eq("owner_id", userId)
      .eq("candidate_id", cid);
    const appIds = (appsData ?? []).map((a: { id: string }) => a.id);

    const [cand, cons, scor, intv] = await Promise.all([
      supabase
        .from("ats_candidates")
        .select("*")
        .eq("owner_id", userId)
        .eq("id", cid)
        .maybeSingle(),
      supabase
        .from("ats_candidate_consents")
        .select("*")
        .eq("owner_id", userId)
        .eq("candidate_id", cid),
      appIds.length
        ? supabase.from("ats_scorecard_responses").select("*").in("application_id", appIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabase.from("ats_interviews").select("*").eq("candidate_id", cid),
    ]);

    const applicationsList = (appsData ?? []) as unknown as Json;
    const consentsList = (cons.data ?? []) as unknown as Json;
    const scorecardsList = ((scor as { data?: unknown[] }).data ?? []) as unknown as Json;
    const interviewsList = (intv.data ?? []) as unknown as Json;

    const snapshot: CandidateExportSnapshot = {
      exported_at: new Date().toISOString(),
      candidate: (cand.data ?? null) as unknown as Json,
      applications: applicationsList,
      consents: consentsList,
      scorecards: scorecardsList,
      interviews: interviewsList,
    };

    if (data.dsar_id) {
      await supabase
        .from("ats_dsar_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: userId,
          result: {
            kind: "export",
            counts: {
              applications: (appsData ?? []).length,
              consents: (cons.data ?? []).length,
              scorecards: ((scor as { data?: unknown[] }).data ?? []).length,
              interviews: (intv.data ?? []).length,
            },
          },
        })
        .eq("id", data.dsar_id)
        .eq("owner_id", userId);
    }

    return snapshot;
  });

export const eraseCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidate_id: string; dsar_id?: string; confirm: string }) => {
    if (input?.confirm !== "ANONIMIZAR") {
      throw new Error('Confirme digitando exatamente "ANONIMIZAR".');
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("anonymize_ats_candidate", {
      _candidate_id: data.candidate_id,
    });
    if (error) throw new Error(error.message);

    if (data.dsar_id) {
      await supabase
        .from("ats_dsar_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: userId,
          result: { kind: "erasure" },
        })
        .eq("id", data.dsar_id)
        .eq("owner_id", userId);
    }
    return { ok: true };
  });

export const updateDsarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: DsarStatus; notes?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      status: DsarStatus;
      notes?: string | null;
      processed_at?: string;
      processed_by?: string;
    } = { status: data.status };
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "completed" || data.status === "rejected") {
      patch.processed_at = new Date().toISOString();
      patch.processed_by = userId;
    }

    const { error } = await supabase
      .from("ats_dsar_requests")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCandidateConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidate_id: string }) => input)
  .handler(async ({ data, context }): Promise<CandidateConsent[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ats_candidate_consents")
      .select(
        "id, candidate_id, purpose, granted, source, legal_basis, expires_at, granted_at, revoked_at",
      )
      .eq("owner_id", userId)
      .eq("candidate_id", data.candidate_id)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows as CandidateConsent[]) ?? [];
  });

export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      candidate_id: string;
      purpose: string;
      granted: boolean;
      legal_basis?: string | null;
      source?: string;
      expires_at?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ats_candidate_consents").insert({
      owner_id: userId,
      candidate_id: data.candidate_id,
      purpose: data.purpose,
      granted: data.granted,
      legal_basis: data.legal_basis ?? null,
      source: data.source ?? "manual",
      expires_at: data.expires_at ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_candidate_consents")
      .update({ granted: false, revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface RetentionCandidate {
  id: string;
  full_name: string;
  email: string | null;
  retention_until: string;
  days_overdue: number;
}

export const listRetentionDue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetentionCandidate[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ats_candidates")
      .select("id, full_name, email, retention_until")
      .eq("owner_id", userId)
      .not("retention_until", "is", null)
      .is("lgpd_redacted_at", null)
      .lte("retention_until", new Date().toISOString())
      .order("retention_until", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const now = Date.now();
    return (
      (rows ?? []) as Array<{
        id: string;
        full_name: string;
        email: string | null;
        retention_until: string;
      }>
    ).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      retention_until: r.retention_until,
      days_overdue: Math.max(
        0,
        Math.floor((now - new Date(r.retention_until).getTime()) / 86_400_000),
      ),
    }));
  });

export const setCandidateRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidate_id: string; retention_until: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_candidates")
      .update({ retention_until: data.retention_until })
      .eq("id", data.candidate_id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
