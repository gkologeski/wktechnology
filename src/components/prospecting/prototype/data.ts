/**
 * Protótipo de Prospecção — dados DEMONSTRATIVOS.
 *
 * Nada aqui vem do banco e nada é gravado. Este módulo existe apenas para o
 * protótipo navegável de aprovação visual (`/prospecting/prototype`).
 * Proibido importar isto em telas produtivas.
 */

export type DemoArea = "visao-geral" | "meu-trabalho" | "campanhas" | "publicos" | "resultados";

export const AREAS: { id: DemoArea; label: string; hint: string }[] = [
  { id: "visao-geral", label: "Visão geral", hint: "Pendências, respostas, qualificados" },
  { id: "meu-trabalho", label: "Meu trabalho", hint: "Filas, próxima ação, nutrição" },
  { id: "campanhas", label: "Campanhas", hint: "Público, serviço, agente, cadência" },
  { id: "publicos", label: "Públicos", hint: "Base, importações, listas salvas" },
  { id: "resultados", label: "Resultados", hint: "Campanha, serviço, canal, agente" },
];

/** Serviços ativos do catálogo (exemplo; a fonte oficial é o catálogo). */
export const DEMO_SERVICES = [
  "Fábrica de Software",
  "Alocação de Squad",
  "Engenharia de IA & Governança",
  "Consultoria Técnica",
  "Hunting de TI",
  "Outsourcing de TI",
];

export const DEMO_OVERVIEW = [
  { label: "Pendências de hoje", value: "18", hint: "12 ligações · 6 e-mails" },
  { label: "Respostas a tratar", value: "7", hint: "4 WhatsApp · 3 e-mail" },
  { label: "Qualificados na semana", value: "9", hint: "meta 12" },
  { label: "Reuniões agendadas", value: "5", hint: "3 confirmadas" },
  { label: "Falhas de envio", value: "2", hint: "fora da janela de 24 h" },
];

export const DEMO_NEXT_ACTIONS = [
  {
    person: "Marina Alves",
    company: "Delta Log",
    service: "Fábrica de Software",
    channel: "WhatsApp",
    due: "Hoje, 14:30",
    state: "Resposta recebida",
    owner: "Você",
  },
  {
    person: "Caio Prado",
    company: "Nexa Agro",
    service: "Alocação de Squad",
    channel: "Ligação",
    due: "Hoje, 16:00",
    state: "Tentativa 2 de 4",
    owner: "Você",
  },
  {
    person: "Helena Dias",
    company: "Grupo Vivace",
    service: "Engenharia de IA & Governança",
    channel: "E-mail",
    due: "Amanhã, 09:00",
    state: "Nutrição",
    owner: "Rafael",
  },
  {
    person: "Otávio Lima",
    company: "Construtora Sete",
    service: "Consultoria Técnica",
    channel: "WhatsApp",
    due: "Amanhã, 11:00",
    state: "Aguardando material",
    owner: "Você",
  },
];

export const DEMO_CAMPAIGNS = [
  {
    name: "Indústria SP · Fábrica de Software",
    service: "Fábrica de Software",
    agent: "SDR Ana",
    audience: "Indústria SP (312)",
    state: "Em andamento",
    answered: "23%",
    qualified: 14,
    meetings: 5,
  },
  {
    name: "Agro MT · Alocação",
    service: "Alocação de Squad",
    agent: "SDR Bruno",
    audience: "Agro MT (180)",
    state: "Pausada",
    answered: "17%",
    qualified: 6,
    meetings: 2,
  },
  {
    name: "Conselhos · Engenharia de IA & Governança",
    service: "Engenharia de IA & Governança",
    agent: "SDR Ana",
    audience: "Lista salva: C-level (74)",
    state: "Rascunho",
    answered: "—",
    qualified: 0,
    meetings: 0,
  },
];

export const DEMO_AUDIENCES = [
  { name: "Base interna · contatos ativos", size: 2140, origin: "Base do CRM", updated: "hoje" },
  { name: "Importação · Feira Tecno 2026", size: 318, origin: "Planilha", updated: "há 3 dias" },
  { name: "Busca Apollo · TI 200-1000", size: 50, origin: "Apollo (1ª página)", updated: "há 1 h" },
  { name: "Lista salva · C-level", size: 74, origin: "Lista salva", updated: "há 2 semanas" },
];

export const DEMO_RESULTS = [
  {
    dim: "Fábrica de Software",
    sent: 420,
    answered: 97,
    qualified: 14,
    meetings: 5,
    lost: "Sem fit (31)",
  },
  {
    dim: "Alocação de Squad",
    sent: 260,
    answered: 44,
    qualified: 6,
    meetings: 2,
    lost: "Sem orçamento (18)",
  },
  {
    dim: "Engenharia de IA & Governança",
    sent: 0,
    answered: 0,
    qualified: 0,
    meetings: 0,
    lost: "—",
  },
];

export const DEMO_FLOW = [
  {
    step: "Público e serviço",
    detail: "Indústria SP (312) · Fábrica de Software",
    note: "O serviço sai do catálogo oficial.",
  },
  {
    step: "Agente e primeira mensagem",
    detail: "SDR Ana · modelo “Apresentação curta”",
    note: "A configuração do agente fica em Agentes; aqui só se escolhe e supervisiona.",
  },
  {
    step: "Qualificar e registrar no CRM",
    detail: "Roteiro comercial + pontuação visível na ficha",
    note: "Conversa vinculada a pessoa, empresa e negócio.",
  },
  {
    step: "Material",
    detail: "Apresentação institucional + caso de indústria",
    note: "Material sugerido pelo contexto da conversa.",
  },
  {
    step: "Agenda ou passagem para humano",
    detail: "Reunião 30 min · responsável Rafael",
    note: "A passagem leva histórico, pontuação e material enviado.",
  },
];
