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

/** Seções do Estúdio que valem para o workspace inteiro (não só para o agente aberto). */
const WORKSPACE_WIDE: ReadonlySet<SdrSectionId> = new Set(["sdr-catalog", "sdr-settings"]);

export function isWorkspaceWideSection(section: SdrSectionId): boolean {
  return WORKSPACE_WIDE.has(section);
}

/**
 * Conversa de teste fixa à direita: todas as seções do Estúdio, exceto
 * "Persona e teste", que já traz o teste ligado ao rascunho em edição.
 */
export function hasStudioTestSide(section: SdrSectionId): boolean {
  return viewOfSection(section).id === "studio" && section !== "sdr-agent";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o agente do endereço; só aceita um identificador válido. */
export function parseSdrAgent(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
}

/**
 * Agente aberto no Estúdio: o do endereço (se existe na lista) → principal →
 * primeiro com questionário → primeiro da lista.
 */
export function resolveStudioAgent(
  agents: ReadonlyArray<{ id: string; questionnaire_id?: string | null }>,
  requested: string | undefined,
  defaultId: string | null | undefined,
): string | null {
  if (requested && agents.some((a) => a.id === requested)) return requested;
  if (defaultId && agents.some((a) => a.id === defaultId)) return defaultId;
  return (agents.find((a) => a.questionnaire_id) ?? agents[0])?.id ?? null;
}
