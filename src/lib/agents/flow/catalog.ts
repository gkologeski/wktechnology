/**
 * Catálogo único de tipos de bloco do fluxo de agentes de IA.
 * Fonte de verdade para: paleta, editor contextual, resumo no canvas,
 * portas de saída, validação e executor (ver `runtime.ts`).
 * Puro TypeScript: usado pelo protótipo, pelo sandbox e pelo runtime do servidor.
 */
export type Config = Record<string, unknown>;
export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "switch"
  | "categories"
  | "conditions"
  | "pairs";
/** Origem das opções de seletor; resolvida por workspace + permissões pelo provedor de dados. */
export type OptionSource =
  | "hosts"
  | "teams"
  | "people"
  | "pipelines"
  | "stages"
  | "sources"
  | "tags"
  | "agents"
  | "media"
  | "connections"
  | "fields";
export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  source?: OptionSource;
  required?: boolean;
  help?: string;
  min?: number;
  max?: number;
  showIf?: (c: Config) => boolean;
};
export type NodeCategory = "Construir" | "Conhecimento" | "Ferramentas" | "Integrações" | "Visual";
/** Dependência externa exigida para executar em produção. */
export type Dependency = "kb" | "catalog" | "crm" | "calendar" | "http_connection" | "inbox";
export type NodeTypeDef = {
  type: string;
  label: string;
  category: NodeCategory;
  icon: string;
  description: string;
  fields: FieldDef[];
  defaults: () => Config;
  outputs: (c: Config) => string[];
  summary: (c: Config) => string;
  dependency?: Dependency;
  /** Bloco apenas visual: não participa da execução. */
  visual?: boolean;
  /** Só pode haver um por fluxo. */
  unique?: boolean;
};
export type Category = { name: string; criteria: string; examples: string };
export type ConditionRule = { field: string; op: string; value: string };
export type Conditions = { mode: "E" | "OU"; rules: ConditionRule[] };
export type Pair = { key: string; value: string };

export const CONDITION_FIELDS = [
  "Intenção",
  "Mensagem",
  "Nome do contato",
  "E-mail do contato",
  "Telefone do contato",
  "Atributo personalizado",
] as const;
export const CONDITION_OPS = ["é", "não é", "contém", "não contém", "preenchido", "vazio"] as const;
export const GUARD_RULES = [
  "Dados pessoais (PII)",
  "Moderação",
  "Jailbreak",
  "Conteúdo NSFW",
  "URLs",
  "Prompt injection",
] as const;
export const VARIABLES = ["{{nome}}", "{{telefone}}", "{{email}}", "{{empresa}}"] as const;

const s = (v: unknown) => (typeof v === "string" ? v : "");
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const cut = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const port =
  (...p: string[]) =>
  () =>
    p;

export const NODE_TYPES: NodeTypeDef[] = [
  {
    type: "start",
    label: "Início",
    category: "Construir",
    icon: "zap",
    unique: true,
    description: "Ponto de entrada da conversa.",
    fields: [
      {
        key: "origin",
        label: "Origem",
        kind: "select",
        options: ["Receptivo", "Prospecção", "Ambas"],
        required: true,
        help: "Prospecção liga apenas os controles comerciais (cotas, horário, pacing).",
      },
      { key: "includeHistory", label: "Incluir histórico do chat", kind: "switch" },
    ],
    defaults: () => ({ origin: "Ambas", includeHistory: true }),
    outputs: port("próximo"),
    summary: (c) => `Origem: ${s(c.origin)}${c.includeHistory ? " · com histórico" : ""}`,
  },
  {
    type: "agent",
    label: "Agente",
    category: "Construir",
    icon: "bot",
    description: "Gera a resposta com persona, objetivo e ferramentas.",
    fields: [
      {
        key: "model",
        label: "Modelo",
        kind: "select",
        options: ["Padrão do workspace", "Rápido", "Avançado"],
        required: true,
      },
      {
        key: "reasoning",
        label: "Raciocínio",
        kind: "select",
        options: ["Desligado", "Adaptativo", "Baixo", "Médio", "Alto"],
      },
      {
        key: "goal",
        label: "Meta do agente",
        kind: "select",
        options: ["Sem meta", "Reunião agendada", "Lead capturado", "Resolvida sem humano"],
      },
      {
        key: "tone",
        label: "Tom",
        kind: "select",
        options: ["Acolhedor", "Objetivo", "Consultivo"],
        required: true,
      },
      {
        key: "style",
        label: "Estilo",
        kind: "select",
        options: ["Formal", "Casual", "Descontraído"],
      },
      { key: "emojis", label: "Emojis", kind: "select", options: ["Nenhum", "Leve", "Expressivo"] },
      {
        key: "pricePolicy",
        label: "Política de preço",
        kind: "select",
        options: ["Nunca informar", "Só do catálogo", "Encaminhar para proposta"],
        required: true,
        help: "Preço só com evidência do catálogo.",
      },
      { key: "objective", label: "Objetivo", kind: "textarea", required: true },
      { key: "collect", label: "Informações a coletar", kind: "textarea" },
      { key: "whenHuman", label: "Quando envolver uma pessoa", kind: "textarea" },
      {
        key: "maxLines",
        label: "Máximo de linhas por mensagem",
        kind: "number",
        min: 0,
        max: 4,
        help: "0 = padrão.",
      },
      { key: "delaySec", label: "Atraso de resposta (s)", kind: "number", min: 0, max: 10 },
      { key: "prompt", label: "Prompt principal", kind: "textarea" },
    ],
    defaults: () => ({
      model: "Padrão do workspace",
      reasoning: "Adaptativo",
      goal: "Sem meta",
      tone: "Consultivo",
      style: "Casual",
      emojis: "Leve",
      pricePolicy: "Só do catálogo",
      objective: "",
      collect: "",
      whenHuman: "",
      maxLines: 3,
      delaySec: 2,
      prompt: "",
    }),
    outputs: port("próximo"),
    summary: (c) => `${s(c.tone)} · ${s(c.goal)} · preço: ${s(c.pricePolicy).toLowerCase()}`,
  },
  {
    type: "classify",
    label: "Classificar",
    category: "Construir",
    icon: "split",
    description: "Classifica a intenção em categorias, cada uma com uma saída.",
    fields: [
      { key: "categories", label: "Categorias", kind: "categories", required: true },
      { key: "fallback", label: "Categoria padrão", kind: "text", required: true },
    ],
    defaults: () => ({
      categories: [
        {
          name: "Comercial",
          criteria: "Interesse em contratar",
          examples: "orçamento, proposta, contratar",
        },
        {
          name: "Suporte",
          criteria: "Problema em serviço existente",
          examples: "erro, problema, não funciona",
        },
      ],
      fallback: "Outros",
    }),
    outputs: (c) => [
      ...arr<Category>(c.categories)
        .map((k) => k.name)
        .filter(Boolean),
      s(c.fallback) || "Outros",
    ],
    summary: (c) =>
      arr<Category>(c.categories)
        .map((k) => k.name)
        .join(" · ") || "Sem categorias",
  },
  {
    type: "guardrails",
    label: "Proteções",
    category: "Construir",
    icon: "shield",
    description: "Verifica a mensagem antes do agente.",
    fields: [
      {
        key: "rules",
        label: "Regras ativas",
        kind: "multiselect",
        options: GUARD_RULES,
        required: true,
      },
      {
        key: "custom",
        label: "Regra customizada (palavras bloqueadas, separadas por vírgula)",
        kind: "text",
      },
      { key: "continueAnyway", label: "Continuar mesmo assim (só registra)", kind: "switch" },
      { key: "blockedMessage", label: "Mensagem quando bloqueado", kind: "textarea" },
    ],
    defaults: () => ({
      rules: ["Jailbreak", "Prompt injection", "Moderação"],
      custom: "",
      continueAnyway: false,
      blockedMessage: "Não consigo ajudar com isso por aqui, mas posso chamar alguém da equipe.",
    }),
    outputs: port("ok", "blocked"),
    summary: (c) => `${arr(c.rules).length} regras${c.continueAnyway ? " · só registra" : ""}`,
  },
  {
    type: "condition",
    label: "Condição",
    category: "Construir",
    icon: "branch",
    description: "Ramifica por campos e operadores combinados com E/OU.",
    fields: [{ key: "conditions", label: "Regras", kind: "conditions", required: true }],
    defaults: () => ({
      conditions: { mode: "E", rules: [{ field: "Intenção", op: "é", value: "Comercial" }] },
    }),
    outputs: port("sim", "não"),
    summary: (c) => {
      const k = c.conditions as Conditions | undefined;
      return k?.rules?.length
        ? k.rules.map((r) => `${r.field} ${r.op} ${r.value}`.trim()).join(` ${k.mode} `)
        : "Sem regras";
    },
  },
  {
    type: "approval",
    label: "Aprovação",
    category: "Construir",
    icon: "check",
    description: "Pausa e pede confirmação antes de uma ação.",
    fields: [
      { key: "what", label: "O que aprovar", kind: "text", required: true },
      { key: "question", label: "Pergunta de confirmação", kind: "textarea", required: true },
      { key: "onReject", label: "Instrução para recusa", kind: "textarea" },
      { key: "requiresHuman", label: "Exige um humano", kind: "switch" },
    ],
    defaults: () => ({
      what: "Agendar reunião",
      question: "Posso reservar esse horário para você?",
      onReject: "Ofereça outra opção sem insistir.",
      requiresHuman: false,
    }),
    outputs: port("aprovado", "recusado"),
    summary: (c) => `${s(c.what)}${c.requiresHuman ? " · humano" : " · cliente"}`,
  },
  {
    type: "reply",
    label: "Enviar resposta",
    category: "Construir",
    icon: "send",
    description: "Envia texto fixo com variáveis.",
    fields: [
      {
        key: "text",
        label: "Mensagem",
        kind: "textarea",
        required: true,
        help: `Variáveis: ${VARIABLES.join(" ")}`,
      },
    ],
    defaults: () => ({ text: "Oi {{nome}}! Já te respondo por aqui." }),
    outputs: port("próximo"),
    summary: (c) => cut(s(c.text)),
  },
  {
    type: "end",
    label: "Fim",
    category: "Construir",
    icon: "stop",
    description: "Encerra o turno.",
    fields: [
      {
        key: "status",
        label: "Status final",
        kind: "select",
        options: ["Turno concluído", "Resolvida", "Aguardando cliente"],
      },
    ],
    defaults: () => ({ status: "Turno concluído" }),
    outputs: port(),
    summary: (c) => s(c.status),
  },
  {
    type: "sticky",
    label: "Nota",
    category: "Visual",
    icon: "sticky",
    visual: true,
    description: "Anotação visual no canvas; não executa.",
    fields: [{ key: "text", label: "Texto da nota", kind: "textarea" }],
    defaults: () => ({ text: "Anotação para a equipe" }),
    outputs: port(),
    summary: (c) => cut(s(c.text)),
  },
  {
    type: "find_customer",
    label: "Buscar cliente",
    category: "Conhecimento",
    icon: "user-search",
    dependency: "crm",
    description: "Consulta nome, e-mail e telefone da conversa atual.",
    fields: [],
    defaults: () => ({}),
    outputs: port("encontrado", "não encontrado"),
    summary: () => "Contato da conversa atual",
  },
  {
    type: "kb_search",
    label: "Buscar KB",
    category: "Conhecimento",
    icon: "database",
    dependency: "kb",
    description: "Consulta as fontes permitidas deste agente.",
    fields: [
      {
        key: "sources",
        label: "Fontes permitidas",
        kind: "multiselect",
        source: "sources",
        required: true,
      },
      { key: "always", label: "Sempre consultar a base", kind: "switch" },
      { key: "minScore", label: "Relevância mínima (%)", kind: "number", min: 0, max: 100 },
      { key: "fallback", label: "Resposta sem evidência", kind: "textarea", required: true },
    ],
    defaults: () => ({
      sources: [],
      always: true,
      minScore: 40,
      fallback: "Não tenho essa informação confirmada. Vou verificar com a equipe.",
    }),
    outputs: port("encontrado", "sem resposta"),
    summary: (c) => `${arr(c.sources).length} fontes · mín. ${Number(c.minScore ?? 0)}%`,
  },
  {
    type: "catalog",
    label: "Consultar catálogo",
    category: "Conhecimento",
    icon: "package",
    dependency: "catalog",
    description: "Busca serviços ativos; preço só vem daqui.",
    fields: [
      { key: "onlyActive", label: "Somente itens ativos", kind: "switch" },
      { key: "showPrice", label: "Pode citar preço do catálogo", kind: "switch" },
      { key: "category", label: "Filtro de categoria", kind: "text" },
    ],
    defaults: () => ({ onlyActive: true, showPrice: false, category: "" }),
    outputs: port("encontrado", "não encontrado"),
    summary: (c) =>
      `${c.onlyActive ? "Ativos" : "Todos"} · ${c.showPrice ? "com preço" : "sem preço"}`,
  },
  {
    type: "schedule",
    label: "Agendar reunião",
    category: "Ferramentas",
    icon: "calendar",
    dependency: "calendar",
    description: "Oferece horários da agenda do anfitrião escolhido.",
    fields: [
      { key: "host", label: "Anfitrião", kind: "select", source: "hosts", required: true },
      {
        key: "distribution",
        label: "Distribuição",
        kind: "select",
        options: ["Pessoa específica", "Rodízio da equipe"],
      },
      {
        key: "duration",
        label: "Duração (min)",
        kind: "number",
        min: 15,
        max: 240,
        required: true,
      },
      {
        key: "bufferMin",
        label: "Intervalo entre reuniões (min)",
        kind: "number",
        min: 0,
        max: 120,
      },
      { key: "noticeHours", label: "Antecedência mínima (h)", kind: "number", min: 0, max: 168 },
      {
        key: "timezone",
        label: "Fuso horário",
        kind: "select",
        options: ["America/Sao_Paulo", "America/Manaus", "America/Noronha"],
      },
      {
        key: "meetingType",
        label: "Tipo",
        kind: "select",
        options: ["Google Meet", "Presencial", "Telefone"],
      },
      { key: "confirmation", label: "Enviar link de confirmação", kind: "switch" },
      {
        key: "notify",
        label: "Notificar equipe por",
        kind: "multiselect",
        options: ["E-mail", "WhatsApp"],
      },
    ],
    defaults: () => ({
      host: "",
      distribution: "Pessoa específica",
      duration: 30,
      bufferMin: 15,
      noticeHours: 4,
      timezone: "America/Sao_Paulo",
      meetingType: "Google Meet",
      confirmation: true,
      notify: ["E-mail"],
    }),
    outputs: port("agendado", "sem horário"),
    summary: (c) =>
      `${s(c.host) || "Sem anfitrião"} · ${Number(c.duration ?? 0)} min · ${s(c.meetingType)}`,
  },
  {
    type: "handoff",
    label: "Escalar pra humano",
    category: "Ferramentas",
    icon: "user",
    dependency: "inbox",
    description: "Transfere para equipe ou pessoa, na mesma conversa.",
    fields: [
      {
        key: "target",
        label: "Destino",
        kind: "select",
        options: ["Equipe específica", "Pessoa específica", "IA escolhe a equipe"],
        required: true,
      },
      {
        key: "team",
        label: "Equipe",
        kind: "select",
        source: "teams",
        showIf: (c) => c.target === "Equipe específica",
        required: true,
      },
      {
        key: "person",
        label: "Pessoa",
        kind: "select",
        source: "people",
        showIf: (c) => c.target === "Pessoa específica",
        required: true,
      },
      { key: "message", label: "Mensagem de transferência", kind: "textarea", required: true },
      { key: "summary", label: "Anexar resumo para a equipe", kind: "switch" },
      { key: "afterHours", label: "Fora do expediente", kind: "textarea" },
    ],
    defaults: () => ({
      target: "Equipe específica",
      team: "",
      person: "",
      message: "Vou chamar alguém da equipe, você não precisa repetir nada.",
      summary: true,
      afterHours: "Nossa equipe retorna no próximo horário comercial.",
    }),
    outputs: port(),
    summary: (c) => `${s(c.team) || s(c.person) || s(c.target)}${c.summary ? " · com resumo" : ""}`,
  },
  {
    type: "transfer_agent",
    label: "Transferir agente",
    category: "Ferramentas",
    icon: "bot",
    description: "Passa a conversa para outro agente permitido, no mesmo canal.",
    fields: [
      {
        key: "targets",
        label: "Destinos permitidos",
        kind: "multiselect",
        source: "agents",
        required: true,
      },
      { key: "reason", label: "Quando transferir", kind: "textarea" },
    ],
    defaults: () => ({ targets: [], reason: "" }),
    outputs: port(),
    summary: (c) => `${arr(c.targets).length} destinos permitidos`,
  },
  {
    type: "capture_lead",
    label: "Capturar lead",
    category: "Ferramentas",
    icon: "user-plus",
    dependency: "crm",
    description: "Salva contato ou cria negócio no funil/etapa escolhidos.",
    fields: [
      {
        key: "mode",
        label: "Ação",
        kind: "select",
        options: ["Salvar contato", "Criar negócio"],
        required: true,
      },
      {
        key: "pipeline",
        label: "Funil",
        kind: "select",
        source: "pipelines",
        showIf: (c) => c.mode === "Criar negócio",
        required: true,
      },
      {
        key: "stage",
        label: "Etapa",
        kind: "select",
        source: "stages",
        showIf: (c) => c.mode === "Criar negócio",
        required: true,
      },
      {
        key: "dedupe",
        label: "Deduplicar por",
        kind: "select",
        options: ["Telefone", "E-mail", "Telefone ou e-mail"],
      },
      { key: "requireEvidence", label: "Só com dado dito pelo cliente", kind: "switch" },
    ],
    defaults: () => ({
      mode: "Salvar contato",
      pipeline: "",
      stage: "",
      dedupe: "Telefone ou e-mail",
      requireEvidence: true,
    }),
    outputs: port("próximo"),
    summary: (c) =>
      c.mode === "Criar negócio"
        ? `${s(c.pipeline)} › ${s(c.stage)}`
        : `Contato · dedupe ${s(c.dedupe).toLowerCase()}`,
  },
  {
    type: "tag",
    label: "Etiquetar",
    category: "Ferramentas",
    icon: "tag",
    dependency: "inbox",
    description: "Aplica apenas etiquetas permitidas; nunca cria novas.",
    fields: [
      {
        key: "allowed",
        label: "Etiquetas permitidas",
        kind: "multiselect",
        source: "tags",
        required: true,
      },
      { key: "guidance", label: "Orientação", kind: "textarea" },
    ],
    defaults: () => ({ allowed: [], guidance: "" }),
    outputs: port("próximo"),
    summary: (c) => arr<string>(c.allowed).join(", ") || "Nenhuma etiqueta",
  },
  {
    type: "send_media",
    label: "Enviar mídia",
    category: "Ferramentas",
    icon: "image",
    description: "Envia material aprovado da biblioteca.",
    fields: [
      {
        key: "items",
        label: "Materiais aprovados",
        kind: "multiselect",
        source: "media",
        required: true,
      },
      { key: "caption", label: "Legenda", kind: "text" },
    ],
    defaults: () => ({ items: [], caption: "" }),
    outputs: port("próximo"),
    summary: (c) => `${arr(c.items).length} materiais`,
  },
  {
    type: "reminder",
    label: "Agendar lembrete",
    category: "Ferramentas",
    icon: "clock",
    description: "Retoma a conversa após um tempo, dentro da janela permitida.",
    fields: [
      {
        key: "minutes",
        label: "Depois de (min)",
        kind: "number",
        min: 5,
        max: 1440,
        required: true,
      },
      { key: "message", label: "Mensagem", kind: "textarea", required: true },
    ],
    defaults: () => ({
      minutes: 60,
      message: "Oi {{nome}}, conseguiu ver a minha última mensagem?",
    }),
    outputs: port("próximo"),
    summary: (c) => `Em ${Number(c.minutes ?? 0)} min`,
  },
  {
    type: "internal_note",
    label: "Nota interna",
    category: "Ferramentas",
    icon: "file",
    dependency: "inbox",
    description: "Registra nota privada para a equipe.",
    fields: [{ key: "content", label: "Conteúdo", kind: "textarea", required: true }],
    defaults: () => ({ content: "Resumo: {{nome}} — {{empresa}}" }),
    outputs: port("próximo"),
    summary: (c) => cut(s(c.content)),
  },
  {
    type: "evaluate",
    label: "Avaliar atendimento",
    category: "Ferramentas",
    icon: "star",
    dependency: "inbox",
    description: "Lê nota e comentário já existentes na conversa.",
    fields: [],
    defaults: () => ({}),
    outputs: port("com avaliação", "sem avaliação"),
    summary: () => "Consulta avaliação existente",
  },
  {
    type: "prospecting",
    label: "Prospecção",
    category: "Ferramentas",
    icon: "target",
    description: "Gatilho de prospecção ativa; ao responder, segue o fluxo.",
    fields: [
      {
        key: "campaign",
        label: "Prospecção salva",
        kind: "select",
        source: "connections",
        required: true,
      },
      {
        key: "channels",
        label: "Canais em ordem",
        kind: "multiselect",
        options: ["WhatsApp", "E-mail"],
        required: true,
      },
      { key: "template", label: "Template Meta aprovado", kind: "text", required: true },
    ],
    defaults: () => ({ campaign: "", channels: ["WhatsApp"], template: "" }),
    outputs: port("respondeu"),
    summary: (c) => `${arr<string>(c.channels).join(" → ")} · ${s(c.template) || "sem template"}`,
  },
  {
    type: "http",
    label: "HTTP Request",
    category: "Integrações",
    icon: "globe",
    dependency: "http_connection",
    description: "Chamada a API externa pelo servidor, com allowlist.",
    fields: [
      { key: "name", label: "Nome", kind: "text", required: true },
      { key: "aiDescription", label: "Descrição para a IA", kind: "textarea" },
      {
        key: "method",
        label: "Método",
        kind: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        required: true,
      },
      {
        key: "url",
        label: "URL (aceita {param})",
        kind: "text",
        required: true,
        help: "Apenas https e domínio na allowlist do workspace.",
      },
      { key: "headers", label: "Cabeçalhos", kind: "pairs" },
      {
        key: "body",
        label: "Corpo (template)",
        kind: "textarea",
        showIf: (c) => c.method !== "GET" && c.method !== "DELETE",
      },
      {
        key: "auth",
        label: "Autenticação",
        kind: "select",
        options: ["Nenhuma", "Bearer", "API key", "Basic"],
      },
      {
        key: "connection",
        label: "Conexão (credencial no cofre)",
        kind: "select",
        source: "connections",
        showIf: (c) => c.auth !== "Nenhuma",
        required: true,
      },
      { key: "responsePath", label: "Caminho da resposta", kind: "text" },
    ],
    defaults: () => ({
      name: "",
      aiDescription: "",
      method: "GET",
      url: "https://",
      headers: [],
      body: "",
      auth: "Nenhuma",
      connection: "",
      responsePath: "",
    }),
    outputs: port("sucesso", "erro"),
    summary: (c) => `${s(c.method)} ${cut(s(c.url), 40)}`,
  },
];

export const NODE_MAP: Record<string, NodeTypeDef> = Object.fromEntries(
  NODE_TYPES.map((d) => [d.type, d]),
);
export const getNodeType = (type: string) => NODE_MAP[type];
export const CATEGORIES: NodeCategory[] = [
  "Construir",
  "Conhecimento",
  "Ferramentas",
  "Integrações",
  "Visual",
];

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?)/i;
/** Valida URL do HTTP Request contra SSRF: https + host público + allowlist do workspace. */
export function checkHttpUrl(url: string, allowlist: readonly string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.replace(/\{[^}]+\}/g, "x"));
  } catch {
    return "URL inválida.";
  }
  if (parsed.protocol !== "https:") return "Use apenas https.";
  if (PRIVATE_HOST.test(parsed.hostname)) return "Endereço interno bloqueado.";
  if (!allowlist.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`)))
    return `Domínio ${parsed.hostname} fora da allowlist do workspace.`;
  return null;
}

export function validateConfig(
  type: string,
  c: Config,
  httpAllowlist: readonly string[] = [],
): string[] {
  const def = getNodeType(type);
  if (!def) return [`Tipo de bloco desconhecido: ${type}`];
  const errors: string[] = [];
  for (const f of def.fields) {
    if (f.showIf && !f.showIf(c)) continue;
    const v = c[f.key];
    if (f.required) {
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && !v.trim()) ||
        (Array.isArray(v) && !v.length);
      if (empty) errors.push(`${f.label} é obrigatório.`);
    }
    if (f.kind === "number" && v !== undefined && v !== "") {
      const n = Number(v);
      if (
        Number.isNaN(n) ||
        (f.min !== undefined && n < f.min) ||
        (f.max !== undefined && n > f.max)
      )
        errors.push(`${f.label} deve ficar entre ${f.min} e ${f.max}.`);
    }
    if (f.kind === "categories") {
      const cats = arr<Category>(v);
      if (cats.some((k) => !k.name.trim())) errors.push("Toda categoria precisa de nome.");
      if (new Set(cats.map((k) => k.name)).size !== cats.length)
        errors.push("Categorias repetidas.");
    }
    if (f.kind === "conditions") {
      const k = v as Conditions | undefined;
      if (
        k?.rules?.some(
          (r) => !r.field || !r.op || (!["preenchido", "vazio"].includes(r.op) && !r.value.trim()),
        )
      )
        errors.push("Toda regra precisa de campo, operador e valor.");
    }
  }
  if (type === "http" && s(c.url)) {
    const e = checkHttpUrl(s(c.url), httpAllowlist);
    if (e) errors.push(e);
  }
  return errors;
}

export function defaultConfig(type: string): Config {
  return getNodeType(type)?.defaults() ?? {};
}
