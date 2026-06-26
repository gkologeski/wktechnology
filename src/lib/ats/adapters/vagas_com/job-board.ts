/**
 * Vagas.com Job Board Adapter — Onda 5 / slice 1.
 *
 * Status: integration-ready com PROVIDER MOCK.
 * Integração real requer contrato com Vagas.com (API B2B) e variáveis
 * `VAGAS_API_TOKEN` + `VAGAS_COMPANY_ID`.
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
  return Boolean(process.env.VAGAS_API_TOKEN && process.env.VAGAS_COMPANY_ID);
}

function mockPost(input: JobPostPayload): AdapterResult<JobPostResult> {
  const externalId = `mock-vg-${input.jobId.slice(0, 8)}-${Date.now().toString(36)}`;
  return {
    ok: true,
    data: {
      externalId,
      url: `https://www.vagas.com.br/vagas/${externalId}`,
    },
  };
}

export const VagasComJobBoardAdapter: JobBoardAdapter = {
  capabilities: CAPABILITIES,
  async postJob(_ctx: AdapterContext, input: JobPostPayload) {
    if (!isLive()) return mockPost(input);
    return mockPost(input);
  },
  async closeJob() {
    return { ok: true, data: { closed: true } };
  },
};

export const __vagasIsLive = isLive;
