// Server functions de export CSV do ATS (candidatos e candidaturas).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

export const exportAtsCandidatesCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("ats_candidates")
      .select(
        "full_name, email, phone, linkedin_url, location, current_position, current_company, skills, tags, source, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) => ({
      ...r,
      skills: Array.isArray(r.skills) ? (r.skills as string[]).join(" | ") : "",
      tags: Array.isArray(r.tags) ? (r.tags as string[]).join(" | ") : "",
    }));
    const headers = [
      "full_name",
      "email",
      "phone",
      "linkedin_url",
      "location",
      "current_position",
      "current_company",
      "skills",
      "tags",
      "source",
      "created_at",
    ];
    return {
      filename: `candidatos-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: rowsToCsv(headers, rows),
    };
  });

export const exportJobApplicationsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: apps, error } = await supabase
      .from("ats_applications")
      .select("id, candidate_id, stage_value, status, source, applied_at, moved_at, ai_match_score")
      .eq("workspace_id", workspaceId)
      .eq("job_id", data.jobId);
    if (error) throw new Error(error.message);
    const candidateIds = Array.from(new Set((apps ?? []).map((a) => a.candidate_id as string)));
    const candMap = new Map<
      string,
      { full_name: string; email: string | null; phone: string | null }
    >();
    if (candidateIds.length) {
      const { data: cands } = await supabase
        .from("ats_candidates")
        .select("id, full_name, email, phone")
        .in("id", candidateIds);
      for (const c of (cands ?? []) as Array<{
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
      }>) {
        candMap.set(c.id, { full_name: c.full_name, email: c.email, phone: c.phone });
      }
    }
    const rows = (apps ?? []).map((a) => {
      const c = candMap.get(a.candidate_id as string);
      return {
        full_name: c?.full_name ?? "",
        email: c?.email ?? "",
        phone: c?.phone ?? "",
        stage_value: a.stage_value,
        status: a.status,
        source: a.source,
        applied_at: a.applied_at,
        moved_at: a.moved_at,
        ai_match_score: a.ai_match_score ?? "",
      };
    });
    const headers = [
      "full_name",
      "email",
      "phone",
      "stage_value",
      "status",
      "source",
      "applied_at",
      "moved_at",
      "ai_match_score",
    ];
    return { filename: `candidaturas-${data.jobId}.csv`, csv: rowsToCsv(headers, rows) };
  });

export const listApplicationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await supabase
      .from("ats_application_events")
      .select("id, event_type, from_stage, to_stage, actor_id, metadata, created_at")
      .eq("workspace_id", workspaceId)
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
