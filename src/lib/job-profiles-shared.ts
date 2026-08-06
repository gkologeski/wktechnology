// Rótulos compartilhados de senioridade (client-safe).
export const SENIORITY_OPTIONS = [
  { value: "estagio", label: "Estágio" },
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "especialista", label: "Especialista" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "gerencia", label: "Gerência" },
] as const;

export const SENIORITY_LABEL: Record<string, string> = Object.fromEntries(
  SENIORITY_OPTIONS.map((s) => [s.value, s.label]),
);
