import { z } from "zod";

export const SERVICE_SCOPE_TYPES = [
  "consultoria",
  "suporte",
  "desenvolvimento",
  "alocacao",
  "implantacao",
  "personalizado",
] as const;
export type ServiceScopeType = (typeof SERVICE_SCOPE_TYPES)[number];

export const CONTRACTING_MODALITIES = ["fixed_price", "hourly", "monthly"] as const;
export type ContractingModality = (typeof CONTRACTING_MODALITIES)[number];

export type GuidedFieldDef = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
};

export const SERVICE_SCOPE_TYPE_META: Record<
  ServiceScopeType,
  { label: string; shortDesc: string }
> = {
  consultoria: {
    label: "Consultoria",
    shortDesc: "Diagnóstico, metodologia, atividades, horas previstas e entregáveis",
  },
  suporte: {
    label: "Suporte e sustentação",
    shortDesc: "Sistemas atendidos, cobertura, canais, SLA, franquia e excedentes",
  },
  desenvolvimento: {
    label: "Desenvolvimento de software",
    shortDesc: "Funcionalidades, entregáveis, aceite, esforço, etapas e mudanças",
  },
  alocacao: {
    label: "Alocação de profissionais",
    shortDesc: "Perfil, senioridade, quantidade, carga horária, atuação e substituição",
  },
  implantacao: {
    label: "Implantação e integração",
    shortDesc: "Sistemas, ambientes, migração, integrações, treinamento e go-live",
  },
  personalizado: {
    label: "Outro serviço / Personalizado",
    shortDesc: "Descreva as atividades, entregáveis e regras operacionais",
  },
};

export const CONTRACTING_MODALITY_META: Record<
  ContractingModality,
  { label: string; hint: string }
> = {
  fixed_price: {
    label: "Preço fechado",
    hint: "Escopo, entregáveis, aceite e marcos de pagamento bem definidos.",
  },
  hourly: {
    label: "Por hora",
    hint: "Valor da hora, estimativa, apontamento, aprovação e limite de consumo.",
  },
  monthly: {
    label: "Mensalidade",
    hint: "Cobertura contínua, franquia, excedentes, vigência e reajuste.",
  },
};

export const GENERAL_SCOPE_FIELDS: readonly GuidedFieldDef[] = [
  {
    key: "objective",
    label: "Objetivo e necessidade do cliente",
    placeholder:
      "Ex.: Atender demandas evolutivas e suporte técnico ao ERP, garantindo estabilidade e previsibilidade.",
    multiline: true,
  },
  {
    key: "expected_result",
    label: "Resultado esperado",
    placeholder:
      "Ex.: Redução de chamados recorrentes, agilidade na resolução e documentação atualizada.",
  },
  {
    key: "timeline",
    label: "Previsão de início, duração e etapas",
    placeholder:
      "Ex.: Início em até 5 dias úteis após assinatura, kickoff inicial e acompanhamento mensal.",
  },
  {
    key: "client_responsibilities",
    label: "Responsabilidades do cliente (acessos, dados e aprovações)",
    placeholder:
      "Ex.: Fornecer acessos VPN/ambientes, ponto focal técnico e validação em até 3 dias úteis.",
  },
  {
    key: "general_exclusions",
    label: "Exclusões gerais (o que não está incluso)",
    placeholder:
      "Ex.: Licenças de terceiros, custos de nuvem/infraestrutura e demandas fora do escopo.",
  },
] as const;

export const SERVICE_TYPE_FIELDS: Record<ServiceScopeType, readonly GuidedFieldDef[]> = {
  desenvolvimento: [
    {
      key: "features",
      label: "Funcionalidades e escopo da solução",
      placeholder: "Ex.: Módulo de pedidos, painel gerencial e API de integração com ERP.",
      multiline: true,
    },
    {
      key: "deliverables",
      label: "Entregáveis e etapas / marcos",
      placeholder:
        "Ex.: Especificação funcional, sprints quinzenais, homologação e código versionado.",
      multiline: true,
    },
    {
      key: "acceptance_criteria",
      label: "Critérios de aceite e homologação",
      placeholder: "Ex.: Validação em ambiente de homologação em até 5 dias úteis por marco.",
    },
    {
      key: "effort_estimate",
      label: "Estimativa de esforço / equipe",
      placeholder: "Ex.: 240 horas estimadas com 1 Dev Sênior e 1 QA parcial.",
    },
    {
      key: "change_management",
      label: "Tratamento de mudanças de escopo",
      placeholder: "Ex.: Alterações fora do escopo inicial serão orçadas à parte via aditivo.",
    },
  ],
  alocacao: [
    {
      key: "profile_seniority",
      label: "Perfil profissional e senioridade",
      placeholder: "Ex.: Desenvolvedor Full Stack Sênior (TypeScript/React/Node).",
    },
    {
      key: "headcount_hours",
      label: "Quantidade de profissionais e carga horária",
      placeholder: "Ex.: 1 profissional dedicado, 168 horas/mês (8h/dia em dias úteis).",
    },
    {
      key: "work_model",
      label: "Modelo de atuação e ritos",
      placeholder: "Ex.: 100% remoto, integrado às dailys e ferramentas de gestão do cliente.",
    },
    {
      key: "rate_and_timesheet",
      label: "Valor hora/mensal e apontamento",
      placeholder: "Ex.: Cobrança mensal por horas apontadas no relatório aprovado.",
    },
    {
      key: "replacement_rules",
      label: "Regras de substituição e gestão",
      placeholder: "Ex.: Substituição em até 15 dias úteis mediante solicitação justificada.",
    },
  ],
  suporte: [
    {
      key: "covered_systems",
      label: "Sistemas, módulos ou ambientes atendidos",
      placeholder: "Ex.: ERP corporativo, rotinas fiscais, integrações e banco de dados.",
      multiline: true,
    },
    {
      key: "coverage_hours",
      label: "Horário de cobertura e dias de atendimento",
      placeholder: "Ex.: Segunda a sexta, das 08h30 às 18h (Brasília), exceto feriados.",
    },
    {
      key: "channels",
      label: "Canais de acionamento",
      placeholder: "Ex.: Portal de chamados, e-mail de suporte e grupo de WhatsApp.",
    },
    {
      key: "sla_priorities",
      label: "Níveis de prioridade e SLA (resposta e resolução)",
      placeholder: "Ex.: Crítico: resposta em 2h / solução em 8h; Alto: 4h; Normal: 1 dia útil.",
      multiline: true,
    },
    {
      key: "hours_allowance_overage",
      label: "Franquia de horas, acúmulo/expiração e excedentes",
      placeholder:
        "Ex.: Pacote de 18h; horas não utilizadas não acumulam; excedentes sob aprovação prévia.",
      multiline: true,
    },
  ],
  consultoria: [
    {
      key: "diagnosis_goal",
      label: "Objetivo específico e contexto da consultoria",
      placeholder:
        "Ex.: Diagnosticar gargalos nos processos atuais e orientar a equipe na sustentação.",
      multiline: true,
    },
    {
      key: "methodology",
      label: "Metodologia e abordagem de trabalho",
      placeholder:
        "Ex.: Entrevistas técnicas, análise de ambiente, sessões guiadas e plano priorizado.",
      multiline: true,
    },
    {
      key: "activities_hours",
      label: "Atividades incluídas e horas previstas",
      placeholder: "Ex.: 18 horas de consultoria técnica sob demanda para apoio operacional.",
    },
    {
      key: "client_participation",
      label: "Participação esperada do cliente",
      placeholder: "Ex.: Participação do responsável técnico e disponibilização de acessos.",
    },
    {
      key: "deliverables",
      label: "Entregáveis (diagnóstico, plano de ação, relatórios)",
      placeholder: "Ex.: Relatório técnico de horas, recomendações e plano de ação priorizado.",
    },
  ],
  implantacao: [
    {
      key: "systems_environments",
      label: "Sistemas envolvidos e ambientes",
      placeholder: "Ex.: ERP, CRM e ambiente de homologação + produção.",
    },
    {
      key: "migration_integrations",
      label: "Migração de dados e integrações previstas",
      placeholder: "Ex.: Migração de cadastros base e integração via API REST.",
      multiline: true,
    },
    {
      key: "training",
      label: "Treinamento e transferência de conhecimento",
      placeholder: "Ex.: 2 sessões remotas gravadas para usuários-chave e guia rápido.",
    },
    {
      key: "golive_criteria",
      label: "Critérios de entrada em produção (go-live)",
      placeholder: "Ex.: Validação dos fluxos críticos em homologação e aprovação formal.",
    },
  ],
  personalizado: [
    {
      key: "activities",
      label: "Atividades previstas",
      placeholder: "Descreva com suas palavras o que será executado neste serviço.",
      multiline: true,
    },
    {
      key: "deliverables",
      label: "Entregáveis e critérios de conclusão",
      placeholder: "Ex.: Relatórios, configurações concluídas ou aprovação do responsável.",
    },
    {
      key: "rules_exclusions",
      label: "Regras operacionais e exclusões",
      placeholder: "Ex.: Horários, prazos de resposta ou o que não está contemplado.",
    },
  ],
};

export const MODALITY_FIELD: Record<ContractingModality, GuidedFieldDef> = {
  fixed_price: {
    key: "modality_rules",
    label: "Regras de preço fechado (marcos, aceite e faturamento)",
    placeholder:
      "Ex.: Faturamento vinculado à aprovação dos marcos; mudanças de escopo avaliadas à parte.",
  },
  hourly: {
    key: "modality_rules",
    label: "Regras por hora (apontamento, aprovação e limite de consumo)",
    placeholder:
      "Ex.: Apontamento por demanda, envio de extrato para aprovação e aviso ao atingir 80%.",
  },
  monthly: {
    key: "modality_rules",
    label: "Regras de mensalidade (franquia, excedentes, vigência e reajuste)",
    placeholder:
      "Ex.: Vigência inicial de 12 meses, reajuste anual pelo IPCA e excedentes sob aprovação.",
  },
};

export const ProposalScopeServiceItemSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(240),
  billing: z.string().max(240).optional().default(""),
  serviceType: z.enum(SERVICE_SCOPE_TYPES),
  modality: z.enum(CONTRACTING_MODALITIES),
  answers: z.record(z.string().max(64), z.string().max(4000)).default({}),
  freeNotes: z.string().max(6000).default(""),
});
export type ProposalScopeServiceItem = z.infer<typeof ProposalScopeServiceItemSchema>;

export const ProposalScopeBriefSchema = z.object({
  general: z.record(z.string().max(64), z.string().max(4000)).default({}),
  services: z.array(ProposalScopeServiceItemSchema).max(20).default([]),
});
export type ProposalScopeBrief = z.infer<typeof ProposalScopeBriefSchema>;

export type GeneratedScopeSection = {
  title: string;
  content: string;
};

export function detectServiceScopeType(name: string, billing = ""): ServiceScopeType {
  const hay = `${name} ${billing}`.toLowerCase();
  if (/suporte|sustenta|sla|chamado|atendimento|help\s?desk|manuten/.test(hay)) return "suporte";
  if (/implanta|integra|migra|setup|onboarding|go-?live/.test(hay)) return "implantacao";
  if (/aloca|outsourcing|hunting|squad|dedicad|profissiona|body\s?shop/.test(hay))
    return "alocacao";
  if (/desenvolv|software|f[aá]brica|sistema|aplicativo|app|web|mobile|api/.test(hay)) {
    return "desenvolvimento";
  }
  if (/consultor|diagn[oó]st|assessor|auditoria|estrat[eé]g|pacote\s+de\s+horas/.test(hay)) {
    return "consultoria";
  }
  return "consultoria";
}

export function detectContractingModality(name: string, billing = ""): ContractingModality {
  const hay = `${name} ${billing}`.toLowerCase();
  if (/\/m[eê]s|mensal|recorren|assinatura|anual/.test(hay)) return "monthly";
  if (/hora|\/h\b|pacote|banco\s+de\s+horas|\d+\s*h\b/.test(hay)) return "hourly";
  return "fixed_price";
}

export function parseScopeBrief(raw: unknown): ProposalScopeBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const res = ProposalScopeBriefSchema.safeParse(raw);
  return res.success ? res.data : null;
}

export function buildInitialScopeBrief(
  items: ReadonlyArray<{ id: string; name: string; billing: string }>,
  saved?: ProposalScopeBrief | null,
): ProposalScopeBrief {
  if (saved && (saved.services.length > 0 || Object.values(saved.general).some((v) => v.trim()))) {
    return {
      general: { ...saved.general },
      services: saved.services.map((s) => ({ ...s, answers: { ...s.answers } })),
    };
  }
  const services: ProposalScopeServiceItem[] =
    items.length > 0
      ? items.map((it) => ({
          id: it.id,
          name: it.name,
          billing: it.billing,
          serviceType: detectServiceScopeType(it.name, it.billing),
          modality: detectContractingModality(it.name, it.billing),
          answers: {},
          freeNotes: "",
        }))
      : [
          {
            id: "svc-1",
            name: "Serviço principal",
            billing: "",
            serviceType: "consultoria",
            modality: "hourly",
            answers: {},
            freeNotes: "",
          },
        ];
  return { general: {}, services };
}

export function hasAnyScopeInput(brief: ProposalScopeBrief): boolean {
  if (Object.values(brief.general).some((v) => v.trim().length > 0)) return true;
  return brief.services.some(
    (s) =>
      s.freeNotes.trim().length > 0 || Object.values(s.answers).some((v) => v.trim().length > 0),
  );
}
