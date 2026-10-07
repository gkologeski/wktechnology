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
};
export type Source = {
  id: string;
  name: string;
  type: string;
  scope: string;
  text: string;
  ready: boolean;
};
export type FlowNode = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  x: number;
  y: number;
  from?: string;
};
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
export const makeNodes = (): FlowNode[] => [
  { id: "start", title: "Início", kind: "entrada", summary: "Mensagem recebida", x: 50, y: 205 },
  {
    id: "guard",
    title: "Proteções",
    kind: "proteção",
    summary: "Janela, permissão e dono humano",
    x: 310,
    y: 205,
  },
  {
    id: "agent",
    title: "Agente",
    kind: "agente",
    summary: "Conhecimento + persona consultiva",
    x: 595,
    y: 95,
  },
  {
    id: "human",
    title: "Transferir para pessoa",
    kind: "humano",
    summary: "Encaminhar com contexto completo",
    x: 595,
    y: 325,
  },
  { id: "end", title: "Fim", kind: "saída", summary: "Concluir este turno", x: 890, y: 205 },
];
export const EDGES = [
  ["start", "guard", ""],
  ["guard", "agent", "Passou"],
  ["guard", "human", "Bloqueou"],
  ["agent", "end", "Resposta"],
  ["human", "end", "Transferido"],
];
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
    nodes: makeNodes(),
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
    nodes: makeNodes(),
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
    nodes: makeNodes(),
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
  if (step === 3 && !agent.nodes.length) return "Adicione um bloco ao fluxo.";
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
