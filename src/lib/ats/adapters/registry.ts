/**
 * Registry vazio de adapters de ATS. Cada Onda registra seus adapters aqui
 * (LinkedIn, Indeed, HackerRank, Checkr, BambooHR…).
 *
 * Padrão: importações lazy via dynamic import dentro do server-fn que precisa
 * do adapter (evita inflar o bundle e respeita `tanstack-supabase-import-graph`).
 *
 * Exemplo de uso futuro (Onda 5):
 *   const { LinkedInJobBoardAdapter } =
 *     await import("@/lib/ats/adapters/linkedin/job-board");
 */
import type {
  AssessmentAdapter,
  BackgroundCheckAdapter,
  HrisAdapter,
  JobBoardAdapter,
} from "./types";

export type AtsAdapterCategory = "job_board" | "assessment" | "background_check" | "hris";

export type AtsAdapterDescriptor = {
  slug: string;
  name: string;
  category: AtsAdapterCategory;
  /** Onda do roadmap em que este adapter é entregue. */
  wave: 5 | 6 | 7 | 8;
  /** Implementação ainda pendente (apenas casca). */
  comingSoon?: boolean;
  /** Feature flag que controla a exposição do adapter na UI. */
  featureFlag?: string;
  docs?: string;
};

export const ATS_ADAPTERS: AtsAdapterDescriptor[] = [
  // Onda 5 — Distribuição & Sourcing
  {
    slug: "linkedin",
    name: "LinkedIn Jobs",
    category: "job_board",
    wave: 5,
    comingSoon: true,
    featureFlag: "ats.sourcing.multi_posting",
  },
  {
    slug: "indeed",
    name: "Indeed",
    category: "job_board",
    wave: 5,
    comingSoon: true,
    featureFlag: "ats.sourcing.multi_posting",
  },
  {
    slug: "vagas_com",
    name: "Vagas.com",
    category: "job_board",
    wave: 5,
    comingSoon: true,
    featureFlag: "ats.sourcing.multi_posting",
  },
  // Onda 6 — Avaliação
  {
    slug: "hackerrank",
    name: "HackerRank",
    category: "assessment",
    wave: 6,
    comingSoon: true,
    featureFlag: "ats.assessment.hackerrank",
  },
  {
    slug: "codility",
    name: "Codility",
    category: "assessment",
    wave: 6,
    comingSoon: true,
    featureFlag: "ats.assessment.codility",
  },
  {
    slug: "checkr",
    name: "Checkr",
    category: "background_check",
    wave: 6,
    comingSoon: true,
    featureFlag: "ats.background_check.checkr",
  },
  // Onda 8 — Mobilidade & HRIS
  {
    slug: "bamboohr",
    name: "BambooHR",
    category: "hris",
    wave: 8,
    comingSoon: true,
    featureFlag: "ats.hris.bamboohr",
  },
];

export function listAdaptersByCategory(category: AtsAdapterCategory) {
  return ATS_ADAPTERS.filter((a) => a.category === category);
}

export function findAdapterDescriptor(slug: string): AtsAdapterDescriptor | undefined {
  return ATS_ADAPTERS.find((a) => a.slug === slug);
}

// Tipos re-exportados para uso por implementações:
export type { JobBoardAdapter, AssessmentAdapter, BackgroundCheckAdapter, HrisAdapter };
