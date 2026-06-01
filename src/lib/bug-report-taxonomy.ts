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
    value: "other",
    label: "Outro",
    subtypes: [{ value: "other", label: "Outro" }],
  },
];

export const BUG_KINDS = [
  { value: "existing_broken", label: "Funcionalidade existente com problema" },
  { value: "new_feature", label: "Nova funcionalidade / sugestão" },
] as const;
