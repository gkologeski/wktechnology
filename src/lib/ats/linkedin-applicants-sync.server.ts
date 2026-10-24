import { firstAtsStageValue } from "./stages";
/**
 * Sync automático de aplicantes LinkedIn → ats_applications.
 *
 * Chamado tanto pelo cron horário (`/api/public/hooks/linkedin-applicants-sync`)
 * quanto pela ação "Sincronizar agora" na aba Postagens da vaga.
 *
 * Regras:
 *  - Só considera postings `provider='linkedin'`, `status='published'`, `is_mock=false`
 *    e com `external_id` preenchido.
 *  - Dedupe do candidato via `linkedin_url`, `profile_public_id` (embutido na
 *    URL) ou `email`. Fallback: cria novo `ats_candidates`.
 *  - Dedupe da candidatura via UNIQUE (`job_id`, `provider`, `provider_applicant_id`).
 *  - Erros por posting isolados — nunca aborta o batch inteiro.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sourcePhone } from "@/lib/phone/phone-boundary";
import { LinkedInJobBoardAdapter } from "./adapters/linkedin/job-board";
import type { JobApplicantRecord } from "./adapters/types";

type PostingRow = {
  id: string;
  owner_id: string;
  job_id: string;
  provider: string;
  status: string;
  external_id: string | null;
  is_mock: boolean;
  metadata: Record<string, unknown> | null;
};

export type SyncPostingResult = {
  postingId: string;
  ok: boolean;
  fetched: number;
  createdCandidates: number;
  createdApplications: number;
  skipped: number;
  error: string | null;
};

function toIsoOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function resolveCandidateId(
  ownerId: string,
  workspaceId: string,
  applicant: JobApplicantRecord,
): Promise<{ id: string; created: boolean }> {
  const linkedinUrl = applicant.linkedinUrl?.toLowerCase().replace(/\/$/, "") ?? null;
  const email = applicant.email?.toLowerCase() ?? null;

  async function exactCandidate(
    field: "linkedin_url" | "email",
    value: string,
  ): Promise<string | null> {
    const escaped = value.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await supabaseAdmin
      .from("ats_candidates")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike(field, escaped)
      .limit(2);
    if (error) throw new Error(error.message);
    if (data && data.length > 1) throw new Error("ambiguous_candidate_" + field);
    return data?.[0]?.id ?? null;
  }
  if (linkedinUrl) {
    const id = await exactCandidate("linkedin_url", linkedinUrl);
    if (id) return { id, created: false };
  }
  if (email) {
    const id = await exactCandidate("email", email);
    if (id) {
      if (linkedinUrl)
        await supabaseAdmin
          .from("ats_candidates")
          .update({ linkedin_url: applicant.linkedinUrl })
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .is("linkedin_url", null);
      return { id, created: false };
    }
  }

  // 3. cria novo
  const { data: created, error } = await supabaseAdmin
    .from("ats_candidates")
    .insert({
      owner_id: ownerId,
      workspace_id: workspaceId,
      assigned_to: ownerId,
      full_name: applicant.fullName ?? "Candidato LinkedIn",
      email: applicant.email,
      phone: sourcePhone(applicant.phone),
      linkedin_url: applicant.linkedinUrl,
      location: applicant.location,
      headline: applicant.headline,
      current_position: applicant.headline,
      cv_url: applicant.resumeUrl,
      source: "linkedin_apply",
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: created!.id as string, created: true };
}

export async function syncPostingApplicants(postingId: string): Promise<SyncPostingResult> {
  const result: SyncPostingResult = {
    postingId,
    ok: false,
    fetched: 0,
    createdCandidates: 0,
    createdApplications: 0,
    skipped: 0,
    error: null,
  };

  const { data: postingRow, error: pErr } = await supabaseAdmin
    .from("ats_job_postings")
    .select("id, owner_id, job_id, provider, status, external_id, is_mock, metadata")
    .eq("id", postingId)
    .maybeSingle();

  if (pErr || !postingRow) {
    result.error = pErr?.message ?? "posting_not_found";
    return result;
  }

  const posting = postingRow as PostingRow;
  if (
    posting.provider !== "linkedin" ||
    posting.status !== "published" ||
    posting.is_mock ||
    !posting.external_id
  ) {
    result.error = "posting_not_syncable";
    return result;
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("ats_jobs")
    .select("workspace_id, pipeline_id")
    .eq("id", posting.job_id)
    .single();
  if (jobError || !job?.workspace_id) {
    result.error = "posting_job_workspace_missing";
    return result;
  }
  const { data: pipeline } = job.pipeline_id
    ? await supabaseAdmin
        .from("ats_pipelines")
        .select("stages")
        .eq("id", job.pipeline_id)
        .eq("workspace_id", job.workspace_id)
        .maybeSingle()
    : { data: null };
  const initialStage = firstAtsStageValue(pipeline?.stages);
  const meta = (posting.metadata ?? {}) as Record<string, unknown>;
  let cursor: string | null = (meta.applicants_sync_cursor as string | null | undefined) ?? null;

  try {
    // Paginação: até 5 páginas por execução (evita loops longos + rate limit).
    for (let page = 0; page < 5; page++) {
      const listRes = await LinkedInJobBoardAdapter.listApplicants!(
        {
          ownerId: posting.owner_id,
          provider: "linkedin",
          config: {},
          credentialsSecretRef: null,
        },
        { externalId: posting.external_id, cursor, limit: 50 },
      );

      if (!listRes.ok) {
        result.error = listRes.error;
        break;
      }

      const { applicants, nextCursor } = listRes.data;
      result.fetched += applicants.length;

      for (const applicant of applicants) {
        try {
          // Dedupe rápido: já existe aplicação?
          const { data: existing } = await supabaseAdmin
            .from("ats_applications")
            .select("id")
            .eq("job_id", posting.job_id)
            .eq("provider", "linkedin")
            .eq("provider_applicant_id", applicant.providerApplicantId)
            .limit(1)
            .maybeSingle();
          if (existing?.id) {
            result.skipped += 1;
            continue;
          }

          const { id: candidateId, created } = await resolveCandidateId(
            posting.owner_id,
            job.workspace_id,
            applicant,
          );
          if (created) result.createdCandidates += 1;

          const appliedAt = toIsoOrNull(applicant.appliedAt) ?? new Date().toISOString();

          const { error: insErr } = await supabaseAdmin.from("ats_applications").insert({
            owner_id: posting.owner_id,
            workspace_id: job.workspace_id,
            assigned_to: posting.owner_id,
            job_id: posting.job_id,
            candidate_id: candidateId,
            stage_value: initialStage,
            status: "active",
            source: "linkedin_easy_apply",
            applied_at: appliedAt,
            provider: "linkedin",
            provider_applicant_id: applicant.providerApplicantId,
            position: 0,
          } as never);

          if (insErr) {
            // Dedupe race — ignora se for violação de unique
            if (!insErr.message.includes("duplicate")) {
              throw new Error(insErr.message);
            }
            result.skipped += 1;
            continue;
          }
          result.createdApplications += 1;
        } catch (e) {
          // erro por candidato — não aborta o batch
          result.skipped += 1;
          result.error ??= (e as Error).message;
          console.error("[linkedin-applicants-sync] applicant error", {
            postingId,
            providerApplicantId: applicant.providerApplicantId,
            error: (e as Error).message,
          });
        }
      }

      if (result.error) break; // Retry this page; completed rows are deduplicated.
      cursor = nextCursor;
      if (!cursor || applicants.length === 0) break;
    }

    result.ok = !result.error;
  } catch (e) {
    result.error = (e as Error).message;
  }

  // Persiste cursor + contadores no metadata do posting
  const nextMeta: Record<string, unknown> = {
    ...meta,
    applicants_sync_cursor: cursor,
    last_applicants_sync_at: new Date().toISOString(),
    applicants_synced_count: Number(meta.applicants_synced_count ?? 0) + result.createdApplications,
    last_applicants_sync_error: result.error,
  };

  await supabaseAdmin
    .from("ats_job_postings")
    .update({ metadata: nextMeta as never, last_synced_at: new Date().toISOString() })
    .eq("id", postingId);

  return result;
}

export async function listSyncablePostings(limit = 100): Promise<PostingRow[]> {
  const cutoff = new Date(Date.now() - 55 * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("ats_job_postings")
    .select("id, owner_id, job_id, provider, status, external_id, is_mock, metadata")
    .eq("provider", "linkedin")
    .eq("status", "published")
    .eq("is_mock", false)
    .not("external_id", "is", null)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  return (data ?? []) as PostingRow[];
}
