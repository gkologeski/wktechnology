// Trilhas de treinamento por papel (Ajuda Fase 3). Cada trilha é uma sequência
// fixa de artigos oficiais de um módulo; o acesso continua sendo o da Ajuda.
import type { HelpModuleKey } from "./help-access";

export type TrainingTrack = {
  id: string;
  module: HelpModuleKey;
  role: string;
  title: string;
  description: string;
  slugs: string[];
};

const BASE = [
  "visao-geral",
  "primeiros-15-minutos",
  "campos-e-status",
  "permissoes",
  "erros-comuns",
  "perguntas-frequentes",
];

export const TRAINING_TRACKS: TrainingTrack[] = [
  {
    id: "todos",
    module: "core",
    role: "Todos os colaboradores",
    title: "Fundamentos do TechERP",
    description: "Configurações compartilhadas, acesso e conceitos comuns a todos os módulos.",
    slugs: BASE,
  },
  {
    id: "vendas",
    module: "crm",
    role: "Vendas e pré-vendas",
    title: "Operar o TechSales",
    description: "Leads, contatos, negócios, prospecção, WhatsApp e propostas.",
    slugs: BASE,
  },
  {
    id: "recrutamento",
    module: "ats",
    role: "Recrutamento e seleção",
    title: "Operar o TechHire",
    description: "Vagas, candidatos, entrevistas, ofertas e contratação.",
    slugs: BASE,
  },
  {
    id: "pessoas",
    module: "people",
    role: "Pessoas e departamento pessoal",
    title: "Operar o TechPeople",
    description: "Cadastro de pessoas, alocações, documentos, benefícios e onboarding.",
    slugs: BASE,
  },
  {
    id: "contratos",
    module: "contracts",
    role: "Jurídico e contratos",
    title: "Operar o TechContracts",
    description: "Contratos, aprovações, assinatura, serviços e medições.",
    slugs: BASE,
  },
  {
    id: "projetos",
    module: "projects",
    role: "Gestão de projetos",
    title: "Operar o TechProjects",
    description: "Projetos, tarefas, apontamento de horas, aprovação e cobrança.",
    slugs: BASE,
  },
  {
    id: "financeiro",
    module: "finance",
    role: "Financeiro",
    title: "Operar o TechFinance",
    description: "Títulos, baixas, conciliação, DRE e fluxo de caixa.",
    slugs: BASE,
  },
];

export const QUIZ_PASS_SCORE = 4;
export const QUIZ_SIZE = 5;

export function findTrack(id: string): TrainingTrack | null {
  return TRAINING_TRACKS.find((t) => t.id === id) ?? null;
}
