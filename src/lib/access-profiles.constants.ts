// Constantes de perfis de acesso. Client-safe (sem imports server-only).
export const ACCESS_OBJECTS: Array<{
  key: string;
  label: string;
  category: "crm" | "marketing" | "sales" | "service";
}> = [
  { key: "contacts", label: "Contatos", category: "crm" },
  { key: "companies", label: "Empresas", category: "crm" },
  { key: "leads", label: "Leads", category: "crm" },
  { key: "deals", label: "Negócios", category: "sales" },
  { key: "quotes", label: "Cotações", category: "sales" },
  { key: "products", label: "Produtos", category: "sales" },
  { key: "tickets", label: "Tickets", category: "service" },
  { key: "tasks", label: "Tarefas", category: "crm" },
  { key: "notes", label: "Notas", category: "crm" },
  { key: "calls", label: "Chamadas", category: "crm" },
  { key: "meetings", label: "Reuniões", category: "crm" },
  { key: "emails", label: "E-mails do CRM", category: "crm" },
  { key: "activities", label: "Atividades", category: "crm" },
];

export const ACCESS_TOOLS: Array<{
  key: string;
  label: string;
  description: string;
  category: "crm" | "marketing" | "sales" | "service" | "account";
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
];

export const SCOPE_LABELS: Record<"none" | "own" | "team" | "all", string> = {
  none: "Nenhum",
  own: "Próprios",
  team: "Equipe",
  all: "Todos",
};
