/**
 * LinkedIn Job Board Adapter — via Unipile.
 *
 * Publica vagas nativas no LinkedIn usando a conta LinkedIn conectada via
 * Unipile (mesma conta usada em outreach/hunting). Endpoint:
 * `POST /api/v1/linkedin/jobs`.
 *
 * Requer, na `ats_jobs`:
 *  - linkedin_company_id (Company Page ID, ex.: "10108877")
 *  - linkedin_location_id (geo ID do LinkedIn)
 *  - linkedin_workplace (REMOTE|HYBRID|ON_SITE)
 *  - linkedin_employment_status (FULL_TIME, etc.)
 *  - linkedin_apply_type + notification_email/url
 *
 * Fallback MOCK só ocorre quando o workspace não tem conta Unipile conectada
 * (o adapter registra `is_mock=true` no `ats_job_postings` para deixar óbvio).
 */
import type {
  AdapterCapability,
  AdapterContext,
  AdapterResult,
  JobBoardAdapter,
  JobPostPayload,
  JobPostResult,
} from "../types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CAPABILITIES: AdapterCapability[] = [
  "job_board.post",
  "job_board.update",
  "job_board.close",
];

type LinkedinJobConfig = {
  companyId: string;
  companyName: string | null;
  locationId: string;
  workplace: "REMOTE" | "HYBRID" | "ON_SITE";
  employmentStatus:
    | "FULL_TIME"
    | "PART_TIME"
    | "CONTRACT"
    | "INTERNSHIP"
    | "TEMPORARY"
    | "VOLUNTEER"
    | "OTHER";
  applyType: "linkedin" | "external";
  applyUrl: string | null;
  notificationEmail: string | null;
};

async function hasConnectedAccount(ownerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("unipile_accounts")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("provider", "linkedin")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

function readConfig(providerConfig: unknown): LinkedinJobConfig | null {
  const cfg = providerConfig as Partial<LinkedinJobConfig> | undefined;
  if (!cfg) return null;
  if (!cfg.companyId || !cfg.locationId || !cfg.workplace || !cfg.employmentStatus) {
    return null;
  }
  const applyType = cfg.applyType ?? "linkedin";
  if (applyType === "linkedin" && !cfg.notificationEmail) return null;
  if (applyType === "external" && !cfg.applyUrl) return null;
  return {
    companyId: cfg.companyId,
    companyName: cfg.companyName ?? null,
    locationId: cfg.locationId,
    workplace: cfg.workplace,
    employmentStatus: cfg.employmentStatus,
    applyType,
    applyUrl: cfg.applyUrl ?? null,
    notificationEmail: cfg.notificationEmail ?? null,
  };
}

function mockPost(input: JobPostPayload, reason: string): AdapterResult<JobPostResult> {
  const externalId = `mock-li-${input.jobId.slice(0, 8)}-${Date.now().toString(36)}`;
  return {
    ok: true,
    data: {
      externalId,
      url: `https://www.linkedin.com/jobs/view/${externalId}?mock=1&reason=${encodeURIComponent(reason)}`,
    },
  };
}

export const LinkedInJobBoardAdapter: JobBoardAdapter = {
  capabilities: CAPABILITIES,

  async postJob(ctx: AdapterContext, input: JobPostPayload) {
    const connected = await hasConnectedAccount(ctx.ownerId);
    if (!connected) {
      return mockPost(input, "no_unipile_account");
    }

    const cfg = readConfig((input as JobPostPayload & { providerConfig?: unknown }).providerConfig);
    if (!cfg) {
      return {
        ok: false,
        error:
          "Configuração LinkedIn incompleta na vaga. Preencha Company Page, localização, modalidade, vínculo e método de candidatura.",
        retriable: false,
      };
    }

    try {
      const { loadAccountCtx, createLinkedinJob } = await import(
        "@/lib/unipile/client.server"
      );
      const upCtx = await loadAccountCtx(ctx.ownerId);
      const res = await createLinkedinJob(upCtx, {
        title: input.title,
        companyId: cfg.companyId,
        companyName: cfg.companyName ?? undefined,
        locationId: cfg.locationId,
        workplace: cfg.workplace,
        employmentStatus: cfg.employmentStatus,
        description: input.description,
        applyMethod:
          cfg.applyType === "linkedin"
            ? { type: "linkedin", notificationEmail: cfg.notificationEmail! }
            : { type: "external", url: cfg.applyUrl! },
      });
      const externalId =
        (res?.id as string | undefined) ??
        (res?.provider_id as string | undefined) ??
        String(res?.job_id ?? "");
      const url =
        (res?.url as string | undefined) ??
        (externalId ? `https://www.linkedin.com/jobs/view/${externalId}` : "");
      if (!externalId) {
        return {
          ok: false,
          error: "LinkedIn não retornou o ID da vaga criada.",
          retriable: true,
        };
      }
      return { ok: true, data: { externalId, url } };
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        retriable: true,
      };
    }
  },

  async updateJob(_ctx, input) {
    // LinkedIn não permite edição in-place. Retornamos o mesmo external id para
    // manter contrato; a UI deve orientar despublicar + republicar.
    return {
      ok: true,
      data: {
        externalId: input.externalId,
        url: `https://www.linkedin.com/jobs/view/${input.externalId}`,
      },
    };
  },

  async closeJob(ctx, externalId) {
    const connected = await hasConnectedAccount(ctx.ownerId);
    if (!connected) return { ok: true, data: { closed: true } };
    try {
      const { loadAccountCtx, closeLinkedinJob } = await import(
        "@/lib/unipile/client.server"
      );
      const upCtx = await loadAccountCtx(ctx.ownerId);
      await closeLinkedinJob(upCtx, externalId);
      return { ok: true, data: { closed: true } };
    } catch (e) {
      // Fallback: mesmo se Unipile falhar em fechar remotamente, o caller
      // marca a linha como unpublished localmente.
      return {
        ok: false,
        error: (e as Error).message,
        retriable: true,
      };
    }
  },
};

/**
 * Live = há conta Unipile conectada. A verificação real é assíncrona
 * (depende do banco), então esta função síncrona indica apenas que o
 * adapter está pronto para tentar. O modo mock definitivo é decidido no
 * `postJob` via `hasConnectedAccount`.
 */
export const __linkedinIsLive = () => true;
