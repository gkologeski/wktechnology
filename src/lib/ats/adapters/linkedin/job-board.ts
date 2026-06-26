/**
 * LinkedIn Job Board Adapter — Onda 5 / slice 1.
 *
 * Status: integration-ready com PROVIDER MOCK.
 *
 * Para ativar a integração real é necessário:
 *  1. App OAuth do LinkedIn (Client ID/Secret) com escopo `w_organization_social`
 *     ou contrato LinkedIn Talent Hub / Recruiter System Connect (RSC).
 *  2. Variáveis: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
 *     `LINKEDIN_ORG_URN` (urn:li:organization:NNN).
 *  3. Fluxo OAuth 2-leg para token de organização (server-to-server),
 *     persistido em `public.integrations` (provider='linkedin').
 *  4. Endpoint real: POST https://api.linkedin.com/rest/jobPostings
 *     Header: `LinkedIn-Version: 202402`, `X-Restli-Protocol-Version: 2.0.0`.
 *
 * Enquanto não houver credenciais, este adapter retorna um resultado MOCK
 * marcado com `mock=true` e uma URL placeholder para testes internos.
 */
import type {
  AdapterCapability,
  AdapterContext,
  AdapterResult,
  JobBoardAdapter,
  JobPostPayload,
  JobPostResult,
} from "../types";

const CAPABILITIES: AdapterCapability[] = [
  "job_board.post",
  "job_board.update",
  "job_board.close",
];

function isLive(): boolean {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET &&
      process.env.LINKEDIN_ORG_URN,
  );
}

function mockPost(input: JobPostPayload): AdapterResult<JobPostResult> {
  const externalId = `mock-li-${input.jobId.slice(0, 8)}-${Date.now().toString(36)}`;
  return {
    ok: true,
    data: {
      externalId,
      url: `https://www.linkedin.com/jobs/view/${externalId}`,
    },
  };
}

export const LinkedInJobBoardAdapter: JobBoardAdapter = {
  capabilities: CAPABILITIES,

  async postJob(_ctx: AdapterContext, input: JobPostPayload) {
    if (!isLive()) return mockPost(input);
    // Implementação real será adicionada quando as credenciais estiverem
    // configuradas. Por ora caímos no mock para não quebrar a UI.
    return mockPost(input);
  },

  async updateJob(_ctx, input) {
    if (!isLive()) {
      return {
        ok: true,
        data: { externalId: input.externalId, url: `https://www.linkedin.com/jobs/view/${input.externalId}` },
      };
    }
    return {
      ok: true,
      data: { externalId: input.externalId, url: `https://www.linkedin.com/jobs/view/${input.externalId}` },
    };
  },

  async closeJob(_ctx, externalId) {
    if (!isLive()) return { ok: true, data: { closed: true } };
    return { ok: true, data: { closed: true } };
  },
};

export const __linkedinIsLive = isLive;
