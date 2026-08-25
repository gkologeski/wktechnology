/**
 * ATS Integration Adapter Contracts — Fase 0.
 *
 * Contratos isolados por categoria de provedor. As Ondas 5–8 implementam
 * cada adapter (LinkedIn, Indeed, HackerRank, Checkr, BambooHR…) seguindo
 * estas interfaces. O `core.functions.ts` continua sendo o ponto único
 * de persistência em `integrations` / `enrichment_jobs`.
 *
 * Cada adapter recebe sempre:
 *  - ownerId: workspace dono da operação
 *  - integration: linha de `public.integrations` (status, config, credenciais)
 *
 * E retorna SEMPRE um objeto serializável (sem Response/streams/SDK clients).
 */

export type AdapterCapability =
  | "job_board.post"
  | "job_board.update"
  | "job_board.close"
  | "job_board.candidates_pull"
  | "assessment.invite"
  | "assessment.fetch_result"
  | "background_check.start"
  | "background_check.fetch_result"
  | "hris.handoff_hire"
  | "video.transcribe"
  | "video.recording_url";

export type AdapterResult<T> =
  | { ok: true; data: T; credits_used?: number }
  | { ok: false; error: string; retriable?: boolean };

export type AdapterContext = {
  ownerId: string;
  /** Slug do provider em `public.integrations.provider`. */
  provider: string;
  /** Config livre por provider (URLs, IDs de conta, etc.). */
  config: Record<string, unknown>;
  /** Referência para o secret armazenado (nunca o valor cru). */
  credentialsSecretRef: string | null;
};

/** --- Job Boards (LinkedIn, Indeed, Vagas, Catho, Glassdoor) --- */
export type JobPostPayload = {
  jobId: string;
  title: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  remote: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  /** Config específica do provider (ex.: LinkedIn Company ID, geo, apply). */
  providerConfig?: Record<string, unknown>;
};
export type JobPostResult = { externalId: string; url: string };

export type JobApplicantRecord = {
  providerApplicantId: string;
  fullName: string | null;
  headline: string | null;
  linkedinUrl: string | null;
  profilePublicId: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  resumeUrl: string | null;
  appliedAt: string | null;
  raw?: Record<string, unknown>;
};

export type ListApplicantsResult = {
  applicants: JobApplicantRecord[];
  nextCursor: string | null;
};

export interface JobBoardAdapter {
  capabilities: AdapterCapability[];
  postJob(ctx: AdapterContext, input: JobPostPayload): Promise<AdapterResult<JobPostResult>>;
  updateJob?(
    ctx: AdapterContext,
    input: JobPostPayload & { externalId: string },
  ): Promise<AdapterResult<JobPostResult>>;
  closeJob?(ctx: AdapterContext, externalId: string): Promise<AdapterResult<{ closed: true }>>;
  pullCandidates?(
    ctx: AdapterContext,
    externalId: string,
  ): Promise<AdapterResult<{ candidates: Array<Record<string, unknown>> }>>;
  /** Onda 5 — sync automático de aplicantes por posting. */
  listApplicants?(
    ctx: AdapterContext,
    input: { externalId: string; cursor?: string | null; limit?: number },
  ): Promise<AdapterResult<ListApplicantsResult>>;
}

/** --- Assessments (HackerRank, Codility, iMocha) --- */
export type AssessmentInvite = {
  candidateId: string;
  candidateEmail: string;
  testId: string;
  jobId?: string;
};
export type AssessmentResult = {
  externalAttemptId: string;
  score: number | null;
  passed: boolean | null;
  reportUrl?: string;
  raw?: Record<string, unknown>;
};

export interface AssessmentAdapter {
  capabilities: AdapterCapability[];
  invite(
    ctx: AdapterContext,
    input: AssessmentInvite,
  ): Promise<AdapterResult<{ externalAttemptId: string }>>;
  fetchResult(
    ctx: AdapterContext,
    externalAttemptId: string,
  ): Promise<AdapterResult<AssessmentResult>>;
}

/** --- Background Check (Checkr e equivalentes BR) --- */
export type BackgroundCheckRequest = {
  candidateId: string;
  candidateEmail: string;
  packageSlug: string;
  consentAcceptedAt: string;
};
export type BackgroundCheckResult = {
  externalId: string;
  status: "pending" | "clear" | "consider" | "suspended";
  reportUrl?: string;
};

export interface BackgroundCheckAdapter {
  capabilities: AdapterCapability[];
  start(
    ctx: AdapterContext,
    input: BackgroundCheckRequest,
  ): Promise<AdapterResult<{ externalId: string }>>;
  fetchResult(
    ctx: AdapterContext,
    externalId: string,
  ): Promise<AdapterResult<BackgroundCheckResult>>;
}

/** --- HRIS handoff (BambooHR, Gupy People, etc.) --- */
export type HrisHirePayload = {
  candidateId: string;
  fullName: string;
  email: string;
  hireDate: string;
  jobTitle: string;
  department?: string;
  salary?: { amount: number; currency: string };
};
export interface HrisAdapter {
  capabilities: AdapterCapability[];
  handoffHire(
    ctx: AdapterContext,
    input: HrisHirePayload,
  ): Promise<AdapterResult<{ externalEmployeeId: string }>>;
}

/** Union útil para um registry tipado. */
export type AnyAtsAdapter =
  | JobBoardAdapter
  | AssessmentAdapter
  | BackgroundCheckAdapter
  | HrisAdapter;
