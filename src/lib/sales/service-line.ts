// Linhas de serviço da operação (hunting, outsourcing, fábrica, consultoria) e
// o caminho comercial recomendado para cada uma. Módulo puro, sem I/O.

export type ServiceLine = "hunting" | "outsourcing" | "software_factory" | "consulting";

export const SERVICE_LINES: ServiceLine[] = [
  "hunting",
  "outsourcing",
  "software_factory",
  "consulting",
];

export const SERVICE_LINE_LABEL: Record<ServiceLine, string> = {
  hunting: "Hunting",
  outsourcing: "Outsourcing",
  software_factory: "Fábrica de software",
  consulting: "Consultoria",
};

/** Seções sugeridas para a proposta de cada linha de serviço. */
export const SERVICE_LINE_PROPOSAL_SECTIONS: Record<ServiceLine, string[]> = {
  hunting: ["Perfil da vaga", "Garantia de reposição", "Prazos"],
  outsourcing: ["SLA", "Substituição de profissional", "Reajuste"],
  software_factory: ["Escopo", "Marcos", "Critérios de aceite"],
  consulting: ["Metodologia", "Entregáveis"],
};

export function isServiceLine(v: unknown): v is ServiceLine {
  return typeof v === "string" && (SERVICE_LINES as string[]).includes(v);
}

export function serviceLineLabel(v: string | null | undefined): string | null {
  return isServiceLine(v) ? SERVICE_LINE_LABEL[v] : null;
}
