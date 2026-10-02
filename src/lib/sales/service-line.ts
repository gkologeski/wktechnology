// Linhas de serviço da operação (hunting, outsourcing, fábrica, consultoria).
// A linha NÃO é escolhida à mão: ela vem do Serviço do Catálogo usado nos
// itens da cotação/negócio. Módulo puro, sem I/O.

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

/** Seção do esqueleto de proposta: título + texto-base editável. */
export type ProposalSection = { title: string; text: string };

/** Esqueletos de proposta (PT-BR) por linha de serviço. */
export const SERVICE_LINE_PROPOSAL_SECTIONS: Record<ServiceLine, ProposalSection[]> = {
  outsourcing: [
    {
      title: "Perfil dos profissionais",
      text: "Descrever perfis, senioridade, tecnologias e quantidade de profissionais alocados.",
    },
    {
      title: "Jornada e alocação",
      text: "Jornada de referência de 160 horas/mês por profissional, em regime remoto, híbrido ou presencial conforme acordado.",
    },
    {
      title: "SLA de início e substituição",
      text: "Apresentação de candidatos em até 10 dias úteis; substituição de profissional em até 15 dias úteis, sem custo adicional.",
    },
    {
      title: "Gestão operacional",
      text: "Acompanhamento mensal de desempenho, relatório de horas e ponto focal de gestão da conta.",
    },
    {
      title: "Reajuste",
      text: "Valores reajustados anualmente pelo índice acordado (ex.: IPCA), a partir da data de início da alocação.",
    },
  ],
  software_factory: [
    {
      title: "Entendimento do projeto",
      text: "Contexto do cliente, objetivos de negócio e problema a ser resolvido.",
    },
    {
      title: "Escopo funcional",
      text: "Funcionalidades incluídas e, expressamente, o que está fora do escopo.",
    },
    {
      title: "Metodologia e sprints",
      text: "Desenvolvimento ágil em sprints de 2 semanas, com cerimônias de planejamento, revisão e retrospectiva.",
    },
    {
      title: "Marcos de entrega",
      text: "Relação dos marcos, datas previstas e entregáveis de cada marco.",
    },
    {
      title: "Critérios de aceite",
      text: "Homologação pelo cliente em até 5 dias úteis após cada entrega; ausência de manifestação implica aceite.",
    },
    {
      title: "Garantia técnica",
      text: "Correção de defeitos sem custo por 90 dias após o aceite final.",
    },
    {
      title: "Cronograma financeiro",
      text: "Pagamentos vinculados ao aceite de cada marco de entrega.",
    },
  ],
  hunting: [
    {
      title: "Perfil da vaga",
      text: "Cargo, responsabilidades, requisitos técnicos e comportamentais, faixa salarial e modelo de trabalho.",
    },
    {
      title: "Metodologia",
      text: "Mapeamento de mercado, abordagem ativa, entrevistas técnicas e comportamentais e apresentação de parecer.",
    },
    {
      title: "Prazos",
      text: "Apresentação da shortlist em até 15 dias úteis a partir do kick-off.",
    },
    {
      title: "Garantia de reposição",
      text: "Reposição sem custo caso o profissional seja desligado em até 90 dias da admissão.",
    },
    {
      title: "Honorários",
      text: "Taxa de sucesso sobre o salário anual do contratado, faturada na data de admissão.",
    },
  ],
  consulting: [
    {
      title: "Diagnóstico inicial",
      text: "Levantamento da situação atual, entrevistas com áreas envolvidas e análise de processos e sistemas.",
    },
    {
      title: "Metodologia",
      text: "Etapas do trabalho, reuniões e workshops previstos e forma de validação com o cliente.",
    },
    {
      title: "Entregáveis",
      text: "Relatórios, recomendações e plano de ação executivo.",
    },
    {
      title: "Cronograma",
      text: "Duração prevista por etapa e data de apresentação final.",
    },
    {
      title: "Especialistas alocados",
      text: "Perfil e dedicação dos consultores envolvidos.",
    },
  ],
};

export function isServiceLine(v: unknown): v is ServiceLine {
  return typeof v === "string" && (SERVICE_LINES as string[]).includes(v);
}

export function serviceLineLabel(v: string | null | undefined): string | null {
  return isServiceLine(v) ? SERVICE_LINE_LABEL[v] : null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Deduz a linha a partir do Serviço do Catálogo (código ou nome). */
export function serviceLineFromCatalog(
  service: { code?: string | null; name?: string | null } | null | undefined,
): ServiceLine | null {
  if (!service) return null;
  const name = normalize(service.name ?? "");
  if (name.includes("outsourcing") || name.includes("alocacao")) return "outsourcing";
  if (name.includes("fabrica") || name.includes("software")) return "software_factory";
  if (name.includes("hunting") || name.includes("recrutamento")) return "hunting";
  if (name.includes("consultoria")) return "consulting";
  const code = (service.code ?? "").toUpperCase();
  if (code.startsWith("OS")) return "outsourcing";
  if (code.startsWith("FS")) return "software_factory";
  if (code.startsWith("CT")) return "consulting";
  if (code.startsWith("H")) return "hunting";
  return null;
}
