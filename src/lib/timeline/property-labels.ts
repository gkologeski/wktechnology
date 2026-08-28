// Rótulos pt-BR compartilhados pelo histórico de propriedades (gaveta de
// histórico e cards de histórico na timeline). Fonte única para evitar
// divergência de tradução entre as duas superfícies.

export const PROPERTY_LABELS: Record<string, string> = {
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "Email",
  phone: "Telefone",
  mobile_phone: "Celular",
  company_name: "Empresa",
  company: "Empresa",
  company_id: "Empresa",
  contact_id: "Contato",
  primary_contact_id: "Contato principal",
  source: "Origem",
  source_id: "Origem",
  status: "Status",
  score: "Score",
  label: "Etiqueta",
  notes: "Notas",
  job_title: "Cargo",
  city: "Cidade",
  state: "UF",
  country: "País",
  cep: "CEP",
  address: "Endereço",
  website: "Site",
  linkedin_url: "LinkedIn",
  owner_id: "Responsável",
  assigned_to: "Responsável",
  assigned_user_id: "Responsável",
  pipeline_id: "Pipeline",
  stage: "Etapa",
  stage_id: "Etapa",
  stage_substatus_id: "Substatus",
  name: "Nome",
  value: "Valor",
  currency: "Moeda",
  expected_close_date: "Fechamento esperado",
  priority: "Prioridade",
  due_at: "Vencimento",
  description: "Descrição",
  title: "Título",
  lost_reason: "Motivo da perda",
  probability: "Probabilidade",
};

export const VALUE_LABELS: Record<string, string> = {
  // Lead/contact status
  new: "Novo",
  contacted: "Contatado",
  contacting: "Contatando",
  qualifying: "Qualificando",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  unqualified: "Não qualificado",
  nurturing: "Em nutrição",
  // Deal / genérico
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  closed: "Fechado",
  resolved: "Resolvido",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  active: "Ativo",
  inactive: "Inativo",
  paused: "Pausado",
  draft: "Rascunho",
  scheduled: "Agendado",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  // Prioridade
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
  // Booleanos
  true: "Sim",
  false: "Não",
  null: "—",
};

/** Propriedades tratadas como "movimentação" (destaque próprio na timeline). */
export const MOVEMENT_PROPERTIES = new Set([
  "stage",
  "stage_id",
  "pipeline_id",
  "stage_substatus_id",
  "status",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
]);

export function labelProperty(key: string): string {
  if (PROPERTY_LABELS[key]) return PROPERTY_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  const key = s.toLowerCase();
  return VALUE_LABELS[key] ?? s;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
