// Constantes de perfis de acesso. Client-safe (sem imports server-only).
// `module` mapeia o objeto ao módulo (`crm` ou `ats`) para gravar `module_id`
// em `access_profile_permissions`, viabilizando permissões por módulo.
export type AccessCategory = "crm" | "marketing" | "sales" | "service" | "ats";
export const ACCESS_OBJECTS: Array<{
  key: string;
  label: string;
  category: AccessCategory;
  module?: "crm" | "ats";
}> = [
  { key: "contacts", label: "Contatos", category: "crm", module: "crm" },
  { key: "companies", label: "Empresas", category: "crm", module: "crm" },
  { key: "leads", label: "Leads", category: "crm", module: "crm" },
  { key: "deals", label: "Negócios", category: "sales", module: "crm" },
  { key: "quotes", label: "Cotações", category: "sales", module: "crm" },
  { key: "tickets", label: "Tickets", category: "service", module: "crm" },
  { key: "tasks", label: "Tarefas", category: "crm", module: "crm" },
  { key: "notes", label: "Notas", category: "crm", module: "crm" },
  { key: "calls", label: "Chamadas", category: "crm", module: "crm" },
  { key: "meetings", label: "Reuniões", category: "crm", module: "crm" },
  { key: "emails", label: "E-mails do CRM", category: "crm", module: "crm" },
  { key: "activities", label: "Atividades", category: "crm", module: "crm" },
  // ATS
  { key: "ats_jobs", label: "Vagas", category: "ats", module: "ats" },
  { key: "ats_candidates", label: "Candidatos", category: "ats", module: "ats" },
  { key: "ats_applications", label: "Candidaturas", category: "ats", module: "ats" },
  { key: "ats_scorecards", label: "Scorecards", category: "ats", module: "ats" },
];

export const ACCESS_TOOLS: Array<{
  key: string;
  label: string;
  description: string;
  category: AccessCategory | "account";
  module?: "crm" | "ats";
}> = [
  {
    key: "communicate",
    label: "Comunicar",
    description: "Enviar e-mails, registrar chamadas, agendar reuniões.",
    category: "crm",
  },
  {
    key: "import",
    label: "Importar",
    description: "Importar registros em massa ou um de cada vez.",
    category: "crm",
  },
  { key: "export", label: "Exportar", description: "Exportar registros do CRM.", category: "crm" },
  {
    key: "bulk_delete",
    label: "Exclusão em massa",
    description: "Excluir registros em massa.",
    category: "crm",
  },
  {
    key: "manage_workflows",
    label: "Gerenciar workflows",
    description: "Criar e editar automações.",
    category: "marketing",
  },
  {
    key: "manage_properties",
    label: "Gerenciar propriedades",
    description: "Criar e editar propriedades dos objetos.",
    category: "account",
  },
  {
    key: "manage_pipelines",
    label: "Gerenciar pipelines",
    description: "Criar e editar pipelines e estágios.",
    category: "sales",
  },
  {
    key: "access_logs",
    label: "Acessar logs de auditoria",
    description: "Visualizar histórico completo de alterações.",
    category: "account",
  },
  {
    key: "manage_integrations",
    label: "Gerenciar integrações",
    description: "Conectar e configurar integrações externas.",
    category: "account",
  },
  {
    key: "manage_billing",
    label: "Gerenciar assinatura",
    description: "Acessar billing e cobrança.",
    category: "account",
  },
  {
    key: "manage_users",
    label: "Gerenciar usuários",
    description: "Convidar, editar e remover membros da equipe.",
    category: "account",
  },
  // ATS
  {
    key: "ats_publish_jobs",
    label: "Publicar vagas",
    description: "Publicar/despublicar vagas na página de carreiras.",
    category: "ats",
    module: "ats",
  },
  {
    key: "ats_manage_scorecards",
    label: "Gerenciar scorecards",
    description: "Criar e editar templates de avaliação de candidatos.",
    category: "ats",
    module: "ats",
  },
  {
    key: "ats_parse_cv",
    label: "Parsing de CV com IA",
    description: "Extrair dados de currículos automaticamente.",
    category: "ats",
    module: "ats",
  },
];

export const SCOPE_LABELS: Record<"none" | "own" | "team" | "all", string> = {
  none: "Nenhum",
  own: "Próprios",
  team: "Equipe",
  all: "Todos",
};
