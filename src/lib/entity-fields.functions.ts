// Catálogo dinâmico de campos por entidade para o construtor de filtros.
// Retorna lista de colunas com tipo inferido e, quando aplicável,
// valores distintos (até 21) já escolhidos como opções.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REF_COLUMNS, type RefKind } from "./entity-fields-refs";
import { isMoneyField } from "./format/money-fields";

import {
  CONTRACT_FIELD_LABELS,
  CONTRACT_FIELD_OPTIONS,
  CONTRACT_FREE_TEXT_FIELDS,
  CONTRACT_SYSTEM_FIELDS,
} from "./contracts/workflow-field-meta";

export type EntityFieldType = "text" | "number" | "currency" | "date" | "select" | "boolean";

export type EntityFieldDef = {
  name: string;
  label: string;
  type: EntityFieldType;
  // Quando preenchido (≤20), o construtor renderiza Select.
  options?: { value: string; label: string }[];
  /** Campo é obrigatório no schema (NOT NULL sem default). */
  required?: boolean;
  /** Quando presente, o construtor renderiza seletor com busca por nome. */
  ref?: RefKind;
  /** Campo normalmente preenchido pelo sistema/integração — vai em bloco colapsado. */
  system?: boolean;
  /** Campo de texto rico (HTML) — renderiza editor WYSIWYG. */
  richText?: boolean;
};

type RawRow = {
  column_name: string;
  data_type: string;
  distinct_values: string[] | null;
  distinct_count: number | null;
  is_nullable?: string | null;
  has_default?: boolean | null;
};

// Colunas internas/sistema escondidas do builder.
const HIDDEN = new Set<string>([
  "id",
  "owner_id",
  "workspace_id",
  "deleted_at",
  "portal_token",
  "hs_raw",
  "external_ids",
  "custom_fields",
  "hs_object_id",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
  "hs_createdate",
  "converted_at",
  "converted_contact_id",
  "converted_deal_id",
  // Colunas técnicas/redundantes: já existe equivalente amigável ou são IDs
  // de sincronização que não fazem sentido em condições de workflow.
  "stage_id",
  "external_id",
  "hs_pipeline",
  "hs_pipeline_stage",
  "hs_deal_stage_probability_raw",
  "hubspot_id",
  "hubspot_owner_id_text",
  "sync_state_id",
  "import_batch_id",
]);

/** Esconde qualquer coluna `hs_*`/`hubspot_*` remanescente de sincronização. */
function isSyncColumn(col: string): boolean {
  return /^(hs_|hubspot_)/.test(col) && col !== "hs_lead_status" && col !== "hs_priority";
}

// Rótulos amigáveis (pt-BR) — fallback é snake_case → Title Case.
const LABELS: Record<string, string> = {
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "Email",
  phone: "Telefone",
  mobile_phone: "Celular",
  company: "Empresa",
  company_name: "Empresa (texto livre)",
  company_id: "Empresa",
  source: "Origem",
  status: "Status",
  score: "Score",
  label: "Etiqueta",
  notes: "Notas",
  job_title: "Cargo",
  title: "Cargo",
  city: "Cidade",
  state: "UF",
  country: "País",
  cep: "CEP",
  address: "Endereço",
  website: "Site",
  domain: "Domínio",
  cnpj: "CNPJ",
  cnpj_enriched_at: "CNPJ enriquecido em",
  industry: "Setor",
  size: "Porte",
  annualrevenue: "Receita anual",
  is_target_account: "Target account",
  target_account_tier: "Tier de target",
  type: "Tipo",
  marketing_status: "Status de marketing",
  legal_basis: "Base legal",
  consent_date: "Data de consentimento",
  lifecyclestage: "Lifecycle stage",
  hs_lead_status: "Status (HubSpot)",
  linkedin_url: "LinkedIn",
  linkedin_company_page: "LinkedIn da empresa",
  twitter_handle: "Twitter",
  twitterhandle: "Twitter",
  facebook_company_page: "Facebook da empresa",
  portal_enabled: "Portal habilitado",
  assigned_user_id: "Responsável (legado)",
  pipeline_id: "Pipeline",
  stage: "Etapa",
  stage_id: "Etapa (ID)",
  name: "Nome",
  value: "Valor",
  currency: "Moeda",
  expected_close_date: "Fechamento esperado",
  lost_at: "Perdido em",


  dealtype: "Tipo de negócio",
  hs_priority: "Prioridade",
  hs_deal_stage_probability: "Probabilidade",
  closed_lost_reason: "Motivo de perda",
  closed_won_reason: "Motivo de ganho",
  num_associated_contacts: "Nº contatos associados",
  primary_contact_id: "Contato principal",
  parent_company_id: "Empresa-mãe",
  hubspot_owner_id_text: "Responsável (HubSpot)",
  hs_lead_source_detail: "Detalhe da origem",
  description: "Descrição",
  timezone: "Fuso horário",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  // Tickets
  subject: "Assunto",
  priority: "Prioridade",
  assignee_id: "Responsável",
  due_at: "Vence em",
  sla_policy_id: "Política de SLA",
  first_response_at: "Primeira resposta em",
  resolved_at: "Resolvido em",
  closed_at: "Fechado em",
  reopened_at: "Reaberto em",
  contact_id: "Contato",
  deal_id: "Negócio",
  tags: "Tags",
  channel: "Canal",
  category: "Categoria",
  subcategory: "Subcategoria",
  resolution: "Resolução",
  satisfaction_score: "Nota de satisfação",
  ticket_number: "Número do chamado",
  sla_response_due_at: "SLA de resposta até",
  sla_resolution_due_at: "SLA de resolução até",
  sla_breached: "SLA violado",
  csat_rating: "Avaliação CSAT",
  csat_comment: "Comentário CSAT",
  kb_article_ids: "Artigos KB vinculados",
  is_public: "Público",
  external_id: "ID externo",
  form_id: "Formulário",
  // Atividades / tarefas
  body: "Descrição",
  activity_type: "Tipo de atividade",
  due_date: "Vence em",
  completed_at: "Concluída em",
  // Projects / tasks / milestones
  project_id: "Projeto",
  milestone_id: "Marco",
  parent_task_id: "Tarefa pai",
  start_date: "Início",
  end_date: "Término",
  estimated_hours: "Horas estimadas",
  actual_hours: "Horas realizadas",
  progress: "Progresso",
  // Finance
  amount: "Valor",
  net_amount: "Valor líquido",
  gross_amount: "Valor bruto",
  due_at_date: "Vence em",
  paid_at: "Pago em",
  category_id: "Categoria",
  cost_center_id: "Centro de custo",
  legal_entity_id: "Empresa (CNPJ)",
  bank_account_id: "Conta bancária",
  direction: "Direção",
  payment_method: "Método de pagamento",
  reference: "Referência",
  // Contracts / quotes / proposals
  contract_id: "Contrato",
  deal_id_ref: "Negócio",
  start_at: "Início da vigência",
  end_at: "Fim da vigência",
  total: "Total",
  subtotal: "Subtotal",
  discount: "Desconto",
  tax: "Imposto",
  valid_until: "Válido até",
  // Products / services / recurring plans
  sku: "SKU",
  unit_price: "Preço unitário",
  unit: "Unidade",
  billing_cycle: "Ciclo de cobrança",
  interval: "Intervalo",
  interval_count: "Nº de intervalos",
  price: "Preço",
  barcode: "Código de barras",
  quantity: "Quantidade",
  active: "Ativo",
  trial_days: "Dias de teste",
  next_billing_at: "Próxima cobrança em",
  period_start: "Início do período",
  period_end: "Fim do período",
  version: "Versão",
  slug: "Identificador (slug)",
  sort_order: "Ordem de exibição",
  kind: "Tipo",
  terms: "Termos",
  variables: "Variáveis",
  template_id: "Modelo",
  locked: "Bloqueado",
  archived: "Arquivado",
  position: "Posição",
  metadata: "Metadados técnicos",
  attachments: "Anexos",
  mentions: "Menções",
  location: "Local",
  provider: "Provedor",
  role: "Papel",
  // Responsáveis e pessoas
  assigned_to: "Responsável",
  created_by: "Criado por",
  approved_by: "Aprovado por",
  full_name: "Nome completo",
  photo_url: "Foto",
  delivery_owner_id: "Responsável pela entrega",
  relationship_owner_id: "Responsável pelo relacionamento",
  relationship_status: "Status do relacionamento",
  assignee_ids: "Responsáveis",
  // Datas / marcos
  accepted_at: "Aceito em",
  applied_at: "Candidatura em",
  approved_at: "Aprovado em",
  cancelled_at: "Cancelado em",
  decided_at: "Decidido em",
  declined_at: "Recusado em",
  expires_at: "Expira em",
  filled_at: "Preenchido em",
  issued_at: "Emitido em",
  moved_at: "Movido em",
  opened_at: "Aberto em",
  sent_at: "Enviado em",
  scheduled_at: "Agendado para",
  scheduled_for: "Agendado para",
  signed_at: "Assinado em",
  starts_at: "Início",
  ends_at: "Término",
  next_action_at: "Próxima ação em",
  last_touch_at: "Último contato em",
  captured_at: "Capturado em",
  competence_date: "Data de competência",
  retention_until: "Retenção até",
  lgpd_redacted_at: "Anonimizado (LGPD) em",
  nurture_started_at: "Nutrição iniciada em",
  outcome_set_at: "Resultado definido em",
  relink_checked_at: "Revinculação checada em",
  reminder_1h_sent_at: "Lembrete de 1h enviado em",
  reminder_d1_sent_at: "Lembrete de 1 dia enviado em",
  self_scheduled_at: "Autoagendado em",
  self_schedule_expires_at: "Autoagendamento expira em",
  // Financeiro
  amount_total: "Valor total",
  total_amount: "Valor total",
  total_value: "Valor total",
  monthly_value: "Valor mensal",
  paid_amount: "Valor pago",
  bill_amount: "Valor da fatura",
  discount_total: "Desconto total",
  tax_total: "Impostos",
  tax_rate: "Alíquota (%)",
  invoice_number: "Número da fatura",
  installment_number: "Nº da parcela",
  installment_total: "Total de parcelas",
  parent_entry_id: "Lançamento pai",
  financial_entry_id: "Lançamento financeiro",
  subscription_id: "Assinatura",
  quote_id: "Cotação",
  product_id: "Produto",
  service_id: "Serviço",
  list_id: "Lista",
  pool_id: "Pool de talentos",
  origin_id: "Origem (ID)",
  origin_type: "Tipo de origem",
  external_ref: "Referência externa",
  gateway: "Gateway de pagamento",
  gateway_mode: "Modo do gateway",
  payment_url: "Link de pagamento",
  payment_link_url: "Link de pagamento",
  payment_session_id: "Sessão de pagamento",
  payment_day: "Dia de pagamento",
  payment_terms: "Condições de pagamento",
  boleto_barcode: "Código de barras do boleto",
  boleto_digitable_line: "Linha digitável do boleto",
  pix_key: "Chave Pix",
  pix_key_type: "Tipo da chave Pix",
  pix_copy_paste: "Pix copia e cola",
  pix_qr_code: "QR Code Pix",
  favored_name: "Favorecido",
  favored_document: "Documento do favorecido",
  failure_reason: "Motivo da falha",
  billable: "Faturável",
  planned_cost: "Custo planejado",
  planned_hours: "Horas planejadas",
  duration_min: "Duração (min)",
  duration_ms: "Duração (ms)",
  // Contratos / assinatura
  auto_renew: "Renovação automática",
  notice_days: "Aviso prévio (dias)",
  cure_period_days: "Prazo de cura (dias)",
  trial_period_days: "Período de experiência (dias)",
  unilateral_termination_notice_days: "Aviso de rescisão unilateral (dias)",
  expense_reimbursement_days: "Reembolso de despesas (dias)",
  confidentiality_term_months: "Prazo de sigilo (meses)",
  late_fee_percent: "Multa por atraso (%)",
  late_interest_monthly_percent: "Juros mensais por atraso (%)",
  penalty_percent: "Multa rescisória (%)",
  readjustment_index: "Índice de reajuste",
  readjustment_period: "Periodicidade do reajuste",
  service_type: "Tipo de serviço",
  service_scope: "Escopo do serviço",
  service_location: "Local de execução",
  governing_law: "Lei aplicável",
  jurisdiction: "Foro",
  hours_per_month: "Horas por mês",
  body_html: "Corpo do documento",
  number: "Número",
  counterparty_company_id: "Empresa contraparte",
  counterparty_legal_entity_id: "Empresa contraparte (CNPJ)",
  contracting_legal_entity_id: "Empresa contratante (CNPJ)",
  parent_contract_id: "Contrato principal",
  source_file_path: "Arquivo de origem",
  imported_from: "Importado de",
  import_confidence: "Confiança da importação (IA)",
  public_token: "Token do link público",
  signature_provider: "Provedor de assinatura",
  signature_name: "Nome da assinatura",
  signature_document_id: "Documento no provedor de assinatura",
  signature_operation_id: "Operação de assinatura",
  signed_pdf_path: "PDF assinado",
  esign_document_id: "Documento de assinatura eletrônica",
  // Atividades / comunicação
  email_direction: "Direção do e-mail",
  email_status: "Status do e-mail",
  disposition: "Desfecho da ligação",
  outcome: "Resultado",
  meeting_id: "Reunião",
  meeting_key: "Chave da reunião",
  meeting_location: "Local da reunião",
  meeting_outcome: "Resultado da reunião",
  meet_url: "Link da reunião",
  recording_url: "Gravação",
  recording_sid: "ID da gravação",
  recording_channels: "Canais da gravação",
  recording_duration_seconds: "Duração da gravação (s)",
  transcript: "Transcrição",
  transcription: "Transcrição",
  transcription_model: "Modelo de transcrição",
  transcription_status: "Status da transcrição",
  completed: "Concluída",
  task_priority: "Prioridade da tarefa",
  task_status: "Status da tarefa",
  cadence: "Cadência",
  connection_id: "Conexão",
  custom_field_values: "Campos personalizados",
  custom_status_id: "Status personalizado",
  view_count: "Visualizações",
  slots: "Horários",
  offered_slots: "Horários oferecidos",
  self_schedule_token: "Token de autoagendamento",
  auto_rescheduled_from: "Reagendado de",
  async_questions_snapshot: "Perguntas assíncronas (registro)",
  panel_interviewer_ids: "Banca de entrevistadores",
  interviewer_id: "Entrevistador",
  interview_kit_id: "Kit de entrevista",
  recruiter_id: "Recrutador",
  hiring_manager_id: "Gestor da vaga",
  candidate_id: "Candidato",
  application_id: "Candidatura",
  job_id: "Vaga",
  stage_value: "Etapa",
  rejection_reason: "Motivo da reprovação",
  // SLA (tickets)
  sla_first_response_at: "Primeira resposta em",
  sla_first_response_due_at: "SLA de primeira resposta até",
  sla_first_response_breached: "SLA de primeira resposta violado",
  sla_resolution_breached: "SLA de resolução violado",
  // Relacionamentos genéricos
  related_company_id: "Empresa relacionada",
  related_contact_id: "Contato relacionado",
  related_deal_id: "Negócio relacionado",
  related_lead_id: "Lead relacionado",
  related_ticket_id: "Chamado relacionado",
  projects: "Projetos",
  // Candidatos / talentos
  about: "Sobre",
  headline: "Resumo profissional",
  current_company: "Empresa atual",
  current_company_data: "Dados da empresa atual",
  current_position: "Cargo atual",
  seniority: "Senioridade",
  employment_type: "Tipo de contratação",
  remote_mode: "Modelo de trabalho",
  skills: "Competências",
  skills_detailed: "Competências detalhadas",
  languages: "Idiomas",
  education: "Formação",
  experiences: "Experiências",
  certifications: "Certificações",
  publications: "Publicações",
  volunteering: "Trabalho voluntário",
  recommendations: "Recomendações",
  recent_activity: "Atividade recente",
  external_links: "Links externos",
  cv_url: "Currículo",
  cv_parsed: "Currículo processado",
  open_to_work: "Aberto a oportunidades",
  connection_degree: "Grau de conexão",
  capture_version: "Versão da captura",
  available_actions: "Ações disponíveis",
  provider_applicant_id: "ID do candidato no provedor",
  salary_min: "Salário mínimo",
  salary_max: "Salário máximo",
  salary_currency: "Moeda do salário",
  requirements: "Requisitos",
  dei_gender: "Gênero (D&I)",
  dei_race: "Raça/cor (D&I)",
  dei_disability: "Deficiência (D&I)",
  dei_lgbtqia: "LGBTQIA+ (D&I)",
  // LinkedIn
  linkedin_apply_type: "Tipo de candidatura (LinkedIn)",
  linkedin_apply_url: "URL de candidatura (LinkedIn)",
  linkedin_company_id: "Empresa no LinkedIn (ID)",
  linkedin_company_name: "Empresa no LinkedIn",
  linkedin_employment_status: "Tipo de vínculo (LinkedIn)",
  linkedin_location_id: "Localidade no LinkedIn (ID)",
  linkedin_location_name: "Localidade (LinkedIn)",
  linkedin_notification_email: "E-mail de notificação (LinkedIn)",
  linkedin_workplace: "Modelo de trabalho (LinkedIn)",
  // IA
  ai_summary: "Resumo (IA)",
  ai_score: "Score (IA)",
  ai_match_score: "Score de match (IA)",
  ai_match_summary: "Resumo do match (IA)",
  ai_strengths: "Pontos fortes (IA)",
  ai_concerns: "Pontos de atenção (IA)",
  ai_followups: "Perguntas de follow-up (IA)",
  ai_recommendation: "Recomendação (IA)",
  ai_model: "Modelo de IA",
  ai_generated_at: "Gerado por IA em",
};

/**
 * Rótulos que dependem da entidade — evita traduções erradas do dicionário
 * global (ex.: `title` = "Cargo" em contatos, mas "Título" em contratos).
 */
const ENTITY_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  contracts: CONTRACT_FIELD_LABELS,
  quotes: { title: "Título da cotação" },
  proposals: { title: "Título da proposta" },
  ats_jobs: { title: "Título da vaga" },
  project_tasks: { title: "Título da tarefa" },
  project_milestones: { title: "Título do marco" },
  tickets: { title: "Título do chamado" },
  activities: { title: "Título da atividade" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toLabel(col: string, entity?: string): string {
  const override = entity ? ENTITY_LABEL_OVERRIDES[entity]?.[col] : undefined;
  if (override) return override;
  if (LABELS[col]) return LABELS[col];
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferType(dataType: string): EntityFieldType {
  if (dataType === "boolean") return "boolean";
  if (
    dataType === "integer" ||
    dataType === "numeric" ||
    dataType === "bigint" ||
    dataType === "double precision" ||
    dataType === "real" ||
    dataType === "smallint"
  )
    return "number";
  if (dataType.startsWith("timestamp") || dataType === "date") return "date";
  return "text";
}

export const getEntityFieldCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: z.enum([
          "leads",
          "contacts",
          "companies",
          "deals",
          "tickets",
          "activities",
          "ats_jobs",
          "ats_candidates",
          "ats_applications",
          "ats_interviews",
          "ats_offers",
          "projects",
          "project_tasks",
          "project_milestones",
          "contracts",
          "financial_entries",
          "bank_payments",
          "quotes",
          "proposals",
          "products",
          "services",
          "recurring_plans",
          "subscription_invoices",
          "customer_invoices",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase);
    const { data: rows, error } = await rpc("get_entity_field_catalog", {
      p_table: data.entity,
      p_owner_id: userId,
    });
    if (error) throw error;

    const allRows = (rows ?? []) as RawRow[];

    // Para deals/leads/tickets, as etapas dependem do pipeline — buscamos a definição
    // canônica em pipelines.stages e usamos como opções do campo `stage`,
    // ignorando os valores distintos crus da coluna (que podem incluir lixo legado).
    let pipelineStageOptions: { value: string; label: string }[] | null = null;
    if (data.entity === "deals" || data.entity === "leads" || data.entity === "tickets") {
      const pipelineEntity =
        data.entity === "deals" ? "deal" : data.entity === "leads" ? "lead" : "ticket";
      const { data: pls } = await supabase
        .from("pipelines")
        .select("name, stages, entity")
        .eq("entity", pipelineEntity);
      const seen = new Set<string>();
      const opts: { value: string; label: string }[] = [];
      for (const p of (pls ?? []) as { name: string; stages: unknown }[]) {
        const stages = Array.isArray(p.stages)
          ? (p.stages as Array<{ value?: string; label?: string }>)
          : [];
        for (const s of stages) {
          if (!s?.value) continue;
          if (seen.has(s.value)) continue;
          seen.add(s.value);
          opts.push({
            value: s.value,
            label: `${p.name} · ${s.label ?? s.value}`,
          });
        }
      }
      if (opts.length) pipelineStageOptions = opts;
    }

    // Campos com cadastro auxiliar: o construtor espelha o cadastro de origem.
    // Se o cadastro tem itens, é combo com esses itens; se está vazio, é texto livre.
    const registryOptions: Record<string, { value: string; label: string }[]> = {};
    const hasColumn = (col: string) => allRows.some((r) => r.column_name === col);
    if (hasColumn("closed_lost_reason")) {
      const { data: reasons } = await supabase
        .from("deal_loss_reasons")
        .select("value, label, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const opts = ((reasons ?? []) as { value: string; label: string }[]).map((r) => ({
        value: r.label || r.value,
        label: r.label || r.value,
      }));
      if (opts.length) registryOptions["closed_lost_reason"] = opts;
    }
    if (hasColumn("source") || hasColumn("lead_source")) {
      const { data: sources } = await supabase.from("lead_sources").select("name").order("name");
      const opts = ((sources ?? []) as { name: string }[])
        .filter((s) => !!s.name)
        .map((s) => ({ value: s.name, label: s.name }));
      if (opts.length) {
        registryOptions["source"] = opts;
        registryOptions["lead_source"] = opts;
      }
    }

    // Campos cujo cadastro de entrada é digitação livre — nunca viram combo
    // a partir de amostragem de valores já existentes.
    const FREE_TEXT = new Set<string>([
      "dealtype",
      "closed_won_reason",
      "resolution",
      "reference",
      "notes",
      "description",
      "subcategory",
      // Identificação/título: sempre texto livre (com pills de variáveis).
      "name",
      "title",
      "subject",
      "full_name",
      "first_name",
      "last_name",
      "company_name",
      "label",
      "code",
      "slug",
      "email",
      "phone",
      "document",
      "cnpj",
      "cpf",
    ]);

    const isContracts = data.entity === "contracts";
    // Listas canônicas por entidade (substituem amostragem de valores distintos).
    const canonicalOptions: Record<string, { value: string; label: string }[]> = isContracts
      ? CONTRACT_FIELD_OPTIONS
      : {};
    const freeTextByEntity = isContracts ? CONTRACT_FREE_TEXT_FIELDS : new Set<string>();
    const systemFields = isContracts ? CONTRACT_SYSTEM_FIELDS : new Set<string>();
    // Colunas legadas que duplicam um campo oficial (associação real por ID):
    // ficam no bloco recolhido para não parecerem campos repetidos.
    const legacySystemFields = new Set<string>(["company_name", "assigned_user_id"]);

    const fields: EntityFieldDef[] = [];
    for (const r of allRows) {
      const isPipelineStageField =
        r.column_name === "stage_id" &&
        (data.entity === "deals" || data.entity === "leads" || data.entity === "tickets");
      if ((HIDDEN.has(r.column_name) && !isPipelineStageField) || isSyncColumn(r.column_name))
        continue;
      const inferred = inferType(r.data_type);
      // Colunas numéricas com nome de dinheiro viram "currency" (formatação BRL).
      const type: EntityFieldType =
        inferred === "number" && isMoneyField(r.column_name) ? "currency" : inferred;

      const def: EntityFieldDef = {
        name: r.column_name,
        label: toLabel(r.column_name, data.entity),
        type,
        required: r.is_nullable === "NO" && !r.has_default,
      };
      if (systemFields.has(r.column_name) || legacySystemFields.has(r.column_name))
        def.system = true;
      if (isContracts && r.column_name === "body_html") def.richText = true;

      const ref = REF_COLUMNS[r.column_name];
      if (ref) {
        // Referência: seletor com busca por nome; grava o ID e nunca lista hashes.
        def.ref = ref;
        def.type = "text";
      } else if (canonicalOptions[r.column_name]) {
        def.type = "select";
        def.options = canonicalOptions[r.column_name];
      } else if (
        pipelineStageOptions &&
        (r.column_name === "stage" || r.column_name === "stage_id")
      ) {
        def.type = "select";
        def.options = pipelineStageOptions;
      } else if (registryOptions[r.column_name]) {
        def.type = "select";
        def.options = registryOptions[r.column_name];
      } else if (FREE_TEXT.has(r.column_name) || freeTextByEntity.has(r.column_name)) {
        def.type = type === "boolean" ? "boolean" : "text";
      } else if (
        r.distinct_values &&
        r.distinct_count !== null &&
        r.distinct_count <= 20 &&
        r.distinct_count > 0 &&
        type !== "date" &&
        type !== "number" &&
        // Nunca transformar UUID cru em opção de combo.
        !r.distinct_values.some((v) => UUID_RE.test(v))
      ) {
        const valuesOnly = r.distinct_values.slice(0, 20);
        def.type = "select";
        def.options = valuesOnly.map((v) => ({
          value: v,
          label: type === "boolean" ? (v === "true" ? "Sim" : v === "false" ? "Não" : v) : v,
        }));
      }

      fields.push(def);
    }

    // Ordenação amigável: campos com valores listáveis primeiro,
    // depois datas, depois o resto alfabeticamente por label.
    fields.sort((a, b) => {
      const wa = a.type === "select" ? 0 : a.type === "date" ? 2 : 1;
      const wb = b.type === "select" ? 0 : b.type === "date" ? 2 : 1;
      if (wa !== wb) return wa - wb;
      return a.label.localeCompare(b.label, "pt-BR");
    });

    return { fields };
  });
