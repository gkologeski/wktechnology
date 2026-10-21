// Opções fixas dos campos da ficha de Pessoa (client-safe).
import { SENIORITY_OPTIONS } from "@/lib/job-profiles-shared";

export const SENIORITY_LABELS: string[] = SENIORITY_OPTIONS.map((s) => s.label);

export const EDUCATION_OPTIONS = [
  "Ensino fundamental",
  "Ensino médio incompleto",
  "Ensino médio completo",
  "Técnico",
  "Superior incompleto",
  "Superior em andamento",
  "Superior completo",
  "Pós-graduação/MBA",
  "Mestrado",
  "Doutorado",
];

export const SHIRT_SIZE_OPTIONS = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

export const RELATIONSHIP_OPTIONS = [
  "Mãe",
  "Pai",
  "Cônjuge/Companheiro(a)",
  "Filho(a)",
  "Irmão(ã)",
  "Avô/Avó",
  "Tio(a)",
  "Primo(a)",
  "Amigo(a)",
  "Outro",
];

export const MARITAL_STATUS_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Separado(a)",
  "Viúvo(a)",
];

/** Valor preenchido que não pertence à lista (cadastro antigo digitado à mão). */
export function isLegacyValue(value: string | null | undefined, options: readonly string[]) {
  const v = (value ?? "").trim();
  return v.length > 0 && !options.includes(v);
}

/** Rótulo de senioridade a partir do valor do cargo (ex.: "senior" → "Sênior"). */
export function seniorityLabelFromProfile(value: string | null | undefined): string | null {
  if (!value) return null;
  return SENIORITY_OPTIONS.find((s) => s.value === value || s.label === value)?.label ?? null;
}

/** Senioridade só é preenchida pelo cargo quando ainda está vazia. */
export function nextSeniority(current: string, profileSeniority: string | null | undefined) {
  if (current.trim()) return current;
  return seniorityLabelFromProfile(profileSeniority) ?? current;
}
