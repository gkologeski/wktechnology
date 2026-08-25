export type BugSubtype = { value: string; label: string };
export type BugCategory = {
  value: string;
  label: string;
  subtypes: BugSubtype[];
};

export const BUG_CATEGORIES: BugCategory[] = [
  {
    value: "deals",
    label: "Negócios",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "pipeline", label: "Pipeline / Kanban" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "contacts",
    label: "Contatos",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "create", label: "Criação / edição" },
      { value: "import", label: "Importação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "companies",
    label: "Empresas",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "leads",
    label: "Leads",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "tickets",
    label: "Tickets",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "calendar",
    label: "Calendário / Reuniões",
    subtypes: [
      { value: "view", label: "Visualização" },
      { value: "create", label: "Criação de evento" },
      { value: "meet", label: "Integração com Meet" },
      { value: "sync", label: "Sincronização" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "email",
    label: "E-mail",
    subtypes: [
      { value: "send", label: "Envio" },
      { value: "receive", label: "Recebimento" },
      { value: "templates", label: "Templates" },
      { value: "campaigns", label: "Campanhas" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    subtypes: [
      { value: "send", label: "Envio" },
      { value: "receive", label: "Recebimento" },
      { value: "campaigns", label: "Campanhas" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "calls",
    label: "Ligações",
    subtypes: [
      { value: "outbound", label: "Saída" },
      { value: "inbound", label: "Entrada" },
      { value: "recording", label: "Gravação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "workflows",
    label: "Workflows / Automações",
    subtypes: [
      { value: "trigger", label: "Gatilho não dispara" },
      { value: "action", label: "Ação não executa" },
      { value: "editor", label: "Editor" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "reports",
    label: "Relatórios / Dashboards",
    subtypes: [
      { value: "render", label: "Não renderiza" },
      { value: "data", label: "Dados incorretos" },
      { value: "export", label: "Exportação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "settings",
    label: "Configurações",
    subtypes: [
      { value: "users", label: "Usuários e equipes" },
      { value: "permissions", label: "Permissões" },
      { value: "pipelines", label: "Pipelines" },
      { value: "properties", label: "Propriedades customizadas" },
      { value: "integrations", label: "Integrações" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "auth",
    label: "Login / Autenticação",
    subtypes: [
      { value: "signin", label: "Não consigo entrar" },
      { value: "signup", label: "Cadastro" },
      { value: "password", label: "Senha" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "performance",
    label: "Performance",
    subtypes: [
      { value: "slow", label: "Tela lenta" },
      { value: "freeze", label: "Travamento" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "ui",
    label: "Interface / Layout",
    subtypes: [
      { value: "broken", label: "Elemento quebrado" },
      { value: "mobile", label: "Mobile / responsivo" },
      { value: "text", label: "Texto / tradução" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "tasks",
    label: "Tarefas",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "queues", label: "Filas de tarefas" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "notes",
    label: "Notas",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "kb",
    label: "Base de conhecimento",
    subtypes: [
      { value: "list", label: "Listagem / busca" },
      { value: "article", label: "Artigo" },
      { value: "create", label: "Criação / edição" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "dashboards",
    label: "Dashboards",
    subtypes: [
      { value: "render", label: "Não renderiza" },
      { value: "data", label: "Dados incorretos" },
      { value: "widgets", label: "Widgets / cards" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "inbox",
    label: "Caixa de entrada",
    subtypes: [
      { value: "email", label: "E-mail" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "chat", label: "Chat" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "prospecting",
    label: "Prospecção",
    subtypes: [
      { value: "campaigns", label: "Campanhas" },
      { value: "scripts", label: "Scripts" },
      { value: "dialer", label: "Discador" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "agents",
    label: "Agentes (SDR / Voz)",
    subtypes: [
      { value: "sdr", label: "Agente SDR" },
      { value: "voice", label: "Agente de voz" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "proposals",
    label: "Propostas / Orçamentos",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "detail", label: "Tela de detalhes" },
      { value: "templates", label: "Templates" },
      { value: "esign", label: "Assinatura eletrônica" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "invoices",
    label: "Faturas / Cobrança",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "payments", label: "Pagamentos" },
      { value: "nfse", label: "NFS-e" },
      { value: "subscriptions", label: "Assinaturas" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "landing_pages",
    label: "Landing pages",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "editor", label: "Editor" },
      { value: "publish", label: "Publicação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "forms",
    label: "Formulários",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "editor", label: "Editor" },
      { value: "submit", label: "Envio público" },
      { value: "embed", label: "Embed" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "campaigns",
    label: "Campanhas",
    subtypes: [
      { value: "email", label: "E-mail" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "meetings",
    label: "Reuniões",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "booking", label: "Agendamento público" },
      { value: "recording", label: "Gravação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "analytics",
    label: "Análises",
    subtypes: [
      { value: "render", label: "Não renderiza" },
      { value: "data", label: "Dados incorretos" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "integrations",
    label: "Integrações",
    subtypes: [
      { value: "hubspot", label: "HubSpot" },
      { value: "google", label: "Google" },
      { value: "zapier", label: "Zapier" },
      { value: "webhooks", label: "Webhooks" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "marketplace",
    label: "Marketplace",
    subtypes: [
      { value: "list", label: "Listagem" },
      { value: "install", label: "Instalação" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "portal",
    label: "Portal do cliente",
    subtypes: [
      { value: "access", label: "Acesso" },
      { value: "view", label: "Visualização" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "widget",
    label: "Widget / Chat público",
    subtypes: [
      { value: "load", label: "Carregamento" },
      { value: "messages", label: "Mensagens" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "admin",
    label: "Administração",
    subtypes: [
      { value: "workspaces", label: "Workspaces" },
      { value: "alerts", label: "Alertas" },
      { value: "quotas", label: "Quotas" },
      { value: "security", label: "Segurança" },
      { value: "other", label: "Outro" },
    ],
  },
  {
    value: "other",
    label: "Outro",
    subtypes: [{ value: "other", label: "Outro" }],
  },
];

export const BUG_KINDS = [
  { value: "existing_broken", label: "Funcionalidade existente com problema" },
  { value: "new_feature", label: "Nova funcionalidade / sugestão" },
] as const;
