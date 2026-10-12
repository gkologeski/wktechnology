// Áreas da Prospecção (TechSales) e compatibilidade com os links antigos `?tab=`.
// Módulo puro: usado pela rota e pelos testes.

export const AREA_VALUES = ["visao", "trabalho", "campanhas", "publicos", "resultados"] as const;
export type Area = (typeof AREA_VALUES)[number];

export const SECTION_VALUES = [
  "fila",
  "nutricao",
  "qualificacao",
  "cadencias",
  "roteiros",
  "questionarios",
  "playbooks",
  "base",
  "apollo",
  "enriquecimento",
] as const;
export type Section = (typeof SECTION_VALUES)[number];

export const LEGACY_TAB_VALUES = [
  "fila",
  "base",
  "nutricao",
  "questionarios",
  "cadencias",
  "scoring",
  "playbooks",
  "enrichment",
  "prospecting",
  "scripts",
  "voice",
  "sdr",
] as const;
export type LegacyTab = (typeof LEGACY_TAB_VALUES)[number];

export type LegacyTarget =
  | { kind: "area"; area: Area; section?: Section }
  | { kind: "route"; to: "/settings/voice-agent" | "/agents/sdr" };

/** Destino novo de cada aba antiga; nenhum link salvo deixa de abrir. */
export const LEGACY_TAB_MAP: Record<LegacyTab, LegacyTarget> = {
  fila: { kind: "area", area: "trabalho", section: "fila" },
  nutricao: { kind: "area", area: "trabalho", section: "nutricao" },
  scoring: { kind: "area", area: "trabalho", section: "qualificacao" },
  cadencias: { kind: "area", area: "campanhas", section: "cadencias" },
  scripts: { kind: "area", area: "campanhas", section: "roteiros" },
  questionarios: { kind: "area", area: "campanhas", section: "questionarios" },
  playbooks: { kind: "area", area: "campanhas", section: "playbooks" },
  base: { kind: "area", area: "publicos", section: "base" },
  prospecting: { kind: "area", area: "publicos", section: "apollo" },
  enrichment: { kind: "area", area: "publicos", section: "enriquecimento" },
  voice: { kind: "route", to: "/settings/voice-agent" },
  sdr: { kind: "route", to: "/agents/sdr" },
};

export const AREA_SECTIONS: Record<Area, readonly Section[]> = {
  visao: [],
  trabalho: ["fila", "nutricao", "qualificacao"],
  campanhas: ["cadencias", "roteiros", "questionarios", "playbooks"],
  publicos: ["base", "apollo", "enriquecimento"],
  resultados: [],
};

/** Escolhe a seção válida da área entre as permitidas ao usuário. */
export function resolveSection(
  area: Area,
  requested: Section | undefined,
  allowed: (s: Section) => boolean,
): Section | undefined {
  const list = AREA_SECTIONS[area].filter(allowed);
  if (requested && list.includes(requested)) return requested;
  return list[0];
}
