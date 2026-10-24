import { getActiveWorkspaceId, assertAnyPermission } from "@/lib/access-control/enforce.server";
import { assertHrRecordAccess } from "@/lib/access-control/hr-records.server";
import {
  complianceRpc,
  complianceKeys,
  dsarStatusSchema,
  consentSchema,
  createRequestSchema,
} from "./compliance.server";
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
  can_update: boolean;
  can_export: boolean;
  can_erase: boolean;
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
  scope: Json;
}

async function complianceWorkspace(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const workspace = await getActiveWorkspaceId(context.supabase, context.userId);
  await assertAnyPermission(context.supabase, context.userId, workspace, complianceKeys("view"));
  return workspace;
}

export const listDsarRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: DsarStatus } = {}) =>
    z.object({ status: dsarStatusSchema.optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<DsarRequest[]> => {
    const workspace = await complianceWorkspace(context);
    let q = context.supabase
      .from("ats_dsar_requests")
      .select(
        "id,candidate_id,subject_email,request_type,status,notes,created_at,processed_at,ats_candidates!inner(full_name)",
      )
      .eq("workspace_id", workspace)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const caps = await complianceRpc<
      Array<{ candidate_id: string; can_update: boolean; can_export: boolean; can_erase: boolean }>
    >(context.supabase, "ats_compliance_capabilities", {
      _candidates: (rows ?? []).map((r) => r.candidate_id),
    });
    const byId = new Map(caps.map((c) => [c.candidate_id, c]));
    return (rows ?? []).map((r) => ({
      ...r,
      candidate_name: r.ats_candidates?.full_name ?? null,
      request_type: r.request_type as DsarType,
      status: r.status as DsarStatus,
      can_update: byId.get(r.candidate_id)?.can_update === true,
      can_export: byId.get(r.candidate_id)?.can_export === true,
      can_erase: byId.get(r.candidate_id)?.can_erase === true,
    }));
  });

export const createDsarRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createRequestSchema>) => createRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const result = await complianceRpc<{ ok: boolean; id: string }>(
      context.supabase,
      "ats_compliance_write",
      { _action: "create_request", _candidate: data.candidate_id, _payload: data },
    );
    if (result.ok !== true || !result.id)
      throw new Error("Não foi possível confirmar a solicitação.");
    return { id: result.id };
  });
export const exportCandidateData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { candidate_id: string; dsar_id?: string }) =>
    z.object({ candidate_id: z.string().uuid(), dsar_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(
    async ({ data, context }): Promise<CandidateExportSnapshot> =>
      complianceRpc(context.supabase, "ats_compliance_export", {
        _candidate: data.candidate_id,
        _request: data.dsar_id ?? null,
      }),
  );
export const eraseCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { candidate_id: string; dsar_id?: string; confirm: string }) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        dsar_id: z.string().uuid().optional(),
        confirm: z.literal("ANONIMIZAR"),
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: true }> =>
      complianceRpc(context.supabase, "ats_compliance_write", {
        _action: "erase",
        _candidate: data.candidate_id,
        _request: data.dsar_id ?? null,
        _payload: { confirm: data.confirm },
      }),
  );
export const updateDsarStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: DsarStatus; notes?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        status: dsarStatusSchema,
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    complianceRpc<{ ok: true }>(context.supabase, "ats_compliance_write", {
      _action: "status",
      _request: data.id,
      _payload: data,
    }),
  );

export const listCandidateConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { candidate_id: string }) =>
    z.object({ candidate_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CandidateConsent[]> => {
    const workspace = await complianceWorkspace(context);
    await assertHrRecordAccess(context.supabase, "candidates", "view", data.candidate_id);
    const { data: rows, error } = await context.supabase
      .from("ats_candidate_consents")
      .select("id,candidate_id,purpose,granted,source,legal_basis,expires_at,granted_at,revoked_at")
      .eq("workspace_id", workspace)
      .eq("candidate_id", data.candidate_id)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof consentSchema>) => consentSchema.parse(d))
  .handler(async ({ data, context }) =>
    complianceRpc<{ ok: true }>(context.supabase, "ats_compliance_write", {
      _action: "record_consent",
      _candidate: data.candidate_id,
      _payload: data,
    }),
  );
export const revokeConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) =>
    complianceRpc<{ ok: true }>(context.supabase, "ats_compliance_write", {
      _action: "revoke_consent",
      _payload: data,
    }),
  );

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
    const workspace = await complianceWorkspace(context);
    const { data: rows, error } = await context.supabase
      .from("ats_candidates")
      .select("id,full_name,email,retention_until")
      .eq("workspace_id", workspace)
      .not("retention_until", "is", null)
      .is("lgpd_redacted_at", null)
      .lte("retention_until", new Date().toISOString())
      .order("retention_until", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const caps = await complianceRpc<Array<{ candidate_id: string }>>(
      context.supabase,
      "ats_compliance_capabilities",
      { _candidates: (rows ?? []).map((r) => r.id) },
    );
    const visible = new Set(caps.map((r) => r.candidate_id));
    return (rows ?? [])
      .filter((r) => visible.has(r.id))
      .map((r) => ({
        ...r,
        retention_until: r.retention_until!,
        days_overdue: Math.max(
          0,
          Math.floor((Date.now() - new Date(r.retention_until!).getTime()) / 86400000),
        ),
      }));
  });
export const setCandidateRetention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { candidate_id: string; retention_until: string | null }) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        retention_until: z.string().datetime({ offset: true }).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    complianceRpc<{ ok: true }>(context.supabase, "ats_compliance_write", {
      _action: "retention",
      _candidate: data.candidate_id,
      _payload: data,
    }),
  );
