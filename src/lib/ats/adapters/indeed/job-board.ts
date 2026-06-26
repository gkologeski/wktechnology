/**
 * Indeed Job Board Adapter — Onda 5 / slice 1.
 *
 * Status: integration-ready com PROVIDER MOCK.
 * Integração real requer Indeed XML Feed ou Indeed Apply API (contrato B2B
 * com o Indeed) e variáveis `INDEED_PUBLISHER_ID` + `INDEED_API_KEY`.
 */
import type {
  AdapterCapability,
  AdapterContext,
  AdapterResult,
  JobBoardAdapter,
  JobPostPayload,
  JobPostResult,
} from "../types";

const CAPABILITIES: AdapterCapability[] = ["job_board.post", "job_board.close"];

function isLive(): boolean {
  return Boolean(process.env.INDEED_PUBLISHER_ID && process.env.INDEED_API_KEY);
}

function mockPost(input: JobPostPayload): AdapterResult<JobPostResult> {
  const externalId = `mock-id-${input.jobId.slice(0, 8)}-${Date.now().toString(36)}`;
  return {
    ok: true,
    data: {
      externalId,
      url: `https://www.indeed.com/viewjob?jk=${externalId}`,
    },
  };
}

export const IndeedJobBoardAdapter: JobBoardAdapter = {
  capabilities: CAPABILITIES,
  async postJob(_ctx: AdapterContext, input: JobPostPayload) {
    if (!isLive()) return mockPost(input);
    return mockPost(input);
  },
  async closeJob() {
    return { ok: true, data: { closed: true } };
  },
};

export const __indeedIsLive = isLive;
