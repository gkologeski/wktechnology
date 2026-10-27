/**
 * Arquitetura de navegação da página do Agente SDR: três áreas (Operação,
 * Estúdio e Resultados), cada uma com suas seções. Somente metadados de
 * apresentação; não concede nem verifica permissões.
 */

export type SdrViewId = "operation" | "studio" | "results";

export type SdrSectionId =
  | "sdr-supervision"
  | "enrollments"
  | "sdr-agent"
  | "playbook"
  | "sdr-agent-config"
  | "sdr-skills"
  | "sdr-catalog"
  | "sdr-settings"
  | "sdr-results";

export type SdrView = {
  id: SdrViewId;
  label: string;
  description: string;
  sections: ReadonlyArray<{ id: SdrSectionId; label: string }>;
};

export const SDR_VIEWS: ReadonlyArray<SdrView> = [
  {
    id: "operation",
    label: "Operação",
    description: "Revise rascunhos, assuma conversas e veja quem está em atendimento.",
    sections: [
      { id: "sdr-supervision", label: "Supervisão" },
      { id: "enrollments", label: "Em atendimento" },
    ],
  },
  {
    id: "studio",
    label: "Estúdio",
    description: "Monte a persona, o roteiro, as habilidades e os materiais do agente.",
    sections: [
      { id: "sdr-agent", label: "Persona e teste" },
      { id: "playbook", label: "Playbook" },
      { id: "sdr-agent-config", label: "Configuração do agente" },
      { id: "sdr-skills", label: "Habilidades e ferramentas" },
      { id: "sdr-catalog", label: "Portfólio e materiais" },
      { id: "sdr-settings", label: "Regras gerais" },
    ],
  },
  {
    id: "results",
    label: "Resultados",
    description: "Acompanhe conversas, qualificações e reuniões dos últimos 30 dias.",
    sections: [{ id: "sdr-results", label: "Resultados" }],
  },
];

export const DEFAULT_SDR_SECTION: SdrSectionId = "sdr-supervision";

const SECTION_IDS = new Set<string>(SDR_VIEWS.flatMap((v) => v.sections.map((s) => s.id)));

/** Lê a seção do endereço; valores desconhecidos são ignorados. */
export function parseSdrSection(value: unknown): SdrSectionId | undefined {
  return typeof value === "string" && SECTION_IDS.has(value) ? (value as SdrSectionId) : undefined;
}

/** Área à qual a seção pertence; seção desconhecida cai na Operação. */
export function viewOfSection(section: SdrSectionId | undefined): SdrView {
  return SDR_VIEWS.find((v) => v.sections.some((s) => s.id === section)) ?? SDR_VIEWS[0];
}
