import { ATS_JOB_STATUSES } from "@/lib/ats/stages";
import type { JobStatus } from "@/components/ats/ui";

export const STATUS_TO_BADGE: Record<string, JobStatus> = {
  published: "open",
  draft: "draft",
  on_hold: "onhold",
  filled: "closed",
  closed: "closed",
};

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATS_JOB_STATUSES.map((s) => [s.value, s.label]),
);

export const SENIORITY_LABEL: Record<string, string> = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  lead: "Líder",
  principal: "Principal",
};

export const REMOTE_LABEL: Record<string, string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};

export const EMPLOYMENT_LABEL: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  contract: "Contrato",
  internship: "Estágio",
  temporary: "Temporário",
};
