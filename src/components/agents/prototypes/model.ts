import { defaultConfig, type Config, type Dependency } from "@/lib/agents/flow/catalog";
import { validateGraph, type GraphEdge, type GraphNode } from "@/lib/agents/flow/runtime";
export type Agent = {
  id: string;
  name: string;
  purpose: string;
  persona: string;
  tone: string;
  instructions: string;
  host: string;
  channel: string;
  archived: boolean;
  sources: Source[];
  nodes: FlowNode[];
  edges: GraphEdge[];
};
export type Source = {
  id: string;
  name: string;
  type: string;
  scope: string;
  text: string;
  ready: boolean;
};
export type FlowNode = GraphNode & { title: string };
export const STEPS = [
  "Identidade",
  "Persona",
  "Conhecimento",
  "Fluxo",
  "Ferramentas e agenda",
  "Canais",
  "Teste",
  "Revisão",
];
export const AREAS = ["Fluxo", "Testar", "Métricas", "Conhecimento", "Lançamento"];
export const HOSTS = ["Closer · Equipe Comercial", "P.O. · Equipe de Projetos"];
const node = (
  id: string,
  type: string,
  title: string,
  x: number,
  y: number,
  config: Config = {},
): FlowNode => ({
  id,
  type,
  title,
  x,
  y,
  config: { ...defaultConfig(type), ...config },
});
export const makeNodes = (host: string = HOSTS[0]!, sources: string[] = []): FlowNode[] => [
  node("start", "start", "Início", 50, 205),
  node("guard", "guardrails", "Proteções", 310, 205),
  node("classify", "classify", "Classificar intenção", 595, 95),
  node("kb", "kb_search", "Buscar KB", 880, 30, { sources, minScore: 30 }),
  node("agent", "agent", "Agente", 1165, 30, {
    objective: "Entender a necessidade e avançar com uma pergunta por vez.",
  }),
  node("schedule", "schedule", "Agendar reunião", 1165, 250, { host }),
  node("human", "handoff", "Transferir para pessoa", 595, 365, { team: DEMO_OPTIONS.teams[0] }),
  node("end", "end", "Fim", 1450, 140),
];
export const makeEdges = (): GraphEdge[] =>
  [
    ["start", "guard", "próximo"],
    ["guard", "classify", "ok"],
    ["guard", "human", "blocked"],
    ["classify", "kb", "Comercial"],
    ["classify", "human", "Suporte"],
    ["classify", "schedule", "Outros"],
    ["kb", "agent", "encontrado"],
    ["kb", "human", "sem resposta"],
    ["agent", "end", "próximo"],
    ["schedule", "end", "agendado"],
    ["schedule", "human", "sem horário"],
  ].map(([from, to, port]) => ({ id: `${from}-${to}-${port}`, from: from!, to: to!, port: port! }));
/** Dados demonstrativos isolados e rotulados; não são registros reais do workspace. */
export const DEMO_OPTIONS = {
  hosts: HOSTS,
  teams: ["Equipe Comercial", "Equipe de Projetos", "Atendimento"],
  people: ["Closer (demo)", "P.O. (demo)", "Analista de atendimento (demo)"],
  pipelines: ["Funil de Vendas (demo)"],
  stages: ["Lead", "Qualificação", "Proposta", "Negociação"],
  tags: ["icp", "respondeu", "suporte"],
  media: ["Apresentação institucional.pdf (demo)", "Case IA Governança.pdf (demo)"],
  connections: ["Nenhuma conexão configurada"],
  fields: ["Segmento", "Cargo"],
};
export const DEMO_AVAILABLE: Dependency[] = ["kb", "catalog", "crm", "calendar", "inbox"];
export const DEMO_CATALOG = [
  { name: "IA Governança", active: true, category: "IA" },
  { name: "Alocação de profissionais", active: true, category: "Serviços" },
  { name: "BPO Administrativo/Financeiro", active: false, category: "Serviços" },
];
export const DEMO_SLOTS: Record<string, string[]> = {
  [HOSTS[0]!]: ["ter 10h", "qua 15h"],
  [HOSTS[1]!]: ["qui 9h"],
};
export const makeAgents = (): Agent[] => [
  {
    id: "sales",
    name: "Agente Vendas",
    purpose: "Prospecção e qualificação comercial",
    persona: "Sofia",
    tone: "Consultivo",
    instructions:
      "Converse de forma natural. Avance com uma pergunta por vez, sem repetir informações já recebidas.",
    host: HOSTS[0],
    channel: "WhatsApp · piloto",
    archived: false,
    sources: [
      {
        id: "catalog",
        name: "Catálogo de serviços",
        type: "Texto",
        scope: "Todos os agentes",
        text: "Serviços aprovados para descoberta de necessidades e qualificação comercial. Valores somente mediante proposta validada.",
        ready: true,
      },
      {
        id: "playbook",
        name: "Playbook de descoberta",
        type: "PDF",
        scope: "Só este agente",
        text: "Entender a necessidade, identificar prazo e encaminhar à equipe comercial com o contexto da conversa.",
        ready: true,
      },
    ],
    nodes: makeNodes(HOSTS[0]!, ["Catálogo de serviços", "Playbook de descoberta"]),
    edges: makeEdges(),
  },
  {
    id: "technical",
    name: "Agente Técnico",
    purpose: "Informações técnicas do projeto",
    persona: "Alex",
    tone: "Objetivo",
    instructions:
      "Responda com base nas fontes do projeto. Quando faltar evidência, encaminhe ao P.O.",
    host: HOSTS[1],
    channel: "Portal · demonstração",
    archived: false,
    sources: [
      {
        id: "project",
        name: "Guia do Projeto Aurora",
        type: "PDF",
        scope: "Só este agente",
        text: "Projeto demonstrativo. Entregas acompanhadas pelo P.O. e dúvidas de integração revisadas pela equipe técnica.",
        ready: true,
      },
    ],
    nodes: makeNodes(HOSTS[1]!, ["Guia do Projeto Aurora"]),
    edges: makeEdges(),
  },
  {
    id: "inbound",
    name: "Agente Receptivo",
    purpose: "Triagem e atendimento receptivo",
    persona: "Lia",
    tone: "Acolhedor",
    instructions:
      "Acolha a necessidade sem presumir oportunidade comercial. Respeite pedidos de atendimento humano.",
    host: HOSTS[0],
    channel: "Chat · demonstração",
    archived: false,
    sources: [
      {
        id: "faq",
        name: "Perguntas frequentes",
        type: "URL",
        scope: "Todos os agentes",
        text: "O atendimento pode encaminhar a conversa ao time responsável, mantendo o histórico e o contexto.",
        ready: true,
      },
    ],
    nodes: makeNodes(HOSTS[0]!, ["Perguntas frequentes"]),
    edges: makeEdges(),
  },
];
export function validateStep(agent: Agent, step: number): string | null {
  if (step === 0 && (!agent.name.trim() || !agent.purpose.trim()))
    return "Preencha o nome e a finalidade do agente.";
  if (step === 1 && (!agent.persona.trim() || !agent.instructions.trim()))
    return "Preencha a persona e as instruções.";
  if (step === 2 && !agent.sources.some((s) => s.ready))
    return "Adicione pelo menos uma fonte processada.";
  if (step === 4 && !agent.host) return "Escolha o anfitrião da agenda.";
  if (step === 3) {
    if (!agent.nodes.length) return "Adicione um bloco ao fluxo.";
    const err = flowIssues(agent).find((i) => i.level === "erro");
    if (err) return err.message;
  }
  if (step === 5 && (!agent.channel || agent.channel === "Nenhum canal"))
    return "Escolha um canal demonstrativo.";
  return null;
}
export function demoReply(agent: Agent, message: string) {
  if (/humano|pessoa|reclama|irrit/i.test(message))
    return "Vou encaminhar o contexto para a equipe responsável. Você não precisa repetir as informações.";
  if (/agenda|reunião|horário/i.test(message))
    return `A agenda selecionada é ${agent.host}. Podemos alinhar o objetivo da conversa antes de escolher um horário?`;
  if (/orçamento/i.test(message))
    return "Podemos começar pelo dimensionamento da equipe enquanto o orçamento é analisado. Há uma data prevista para começar?";
  if (/técnic|integra|projeto/i.test(message))
    return `Segundo ${agent.sources[0]?.name ?? "as fontes disponíveis"}, a equipe responsável acompanha as dúvidas do projeto. Qual integração você quer revisar?`;
  return agent.tone === "Objetivo"
    ? "Qual detalhe do projeto você precisa esclarecer?"
    : `Olá! Sou ${agent.persona}. O que você gostaria de resolver hoje?`;
}

export const flowIssues = (agent: Agent) =>
  validateGraph(
    { nodes: agent.nodes, edges: agent.edges },
    { available: DEMO_AVAILABLE, httpAllowlist: [] },
  );

/** Monta o prompt principal a partir dos campos estruturados (sem IA; determinístico). */
export function buildPrompt(agent: Agent) {
  const node = agent.nodes.find((n) => n.type === "agent")?.config ?? {};
  const line = (label: string, v: unknown) =>
    typeof v === "string" && v.trim() ? `${label}: ${v.trim()}` : "";
  return [
    `Você é ${agent.persona}, assistente de ${agent.name}. Finalidade: ${agent.purpose}.`,
    `Tom ${agent.tone.toLowerCase()}, em PT-BR natural. Não abra mensagens com "Entendi" nem repita o que o cliente disse.`,
    line("Objetivo", node.objective),
    line("Informações a coletar (uma pergunta por vez)", node.collect),
    line("Política de preço", node.pricePolicy),
    line("Quando envolver uma pessoa", node.whenHuman),
    "Use apenas fatos das fontes consultadas; sem evidência, diga que vai confirmar com a equipe.",
  ]
    .filter(Boolean)
    .join("\n");
}
