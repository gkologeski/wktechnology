export type WorkflowEntity =
  | "leads"
  | "contacts"
  | "companies"
  | "deals"
  | "tickets"
  | "ats_jobs"
  | "ats_candidates"
  | "ats_applications"
  | "ats_interviews"
  // Cross-módulo (Fase workflows-erp)
  | "projects"
  | "project_tasks"
  | "project_milestones"
  | "contracts"
  | "financial_entries"
  | "bank_payments"
  | "quotes"
  | "proposals"
  | "services"
  | "recurring_plans"
  | "subscription_invoices"
  | "customer_invoices";

/**
 * Tabelas permitidas em ações genéricas create_record / update_record / delete_record.
 * Precisa bater 1:1 com as policies RLS e triggers do engine.
 */
export const WORKFLOW_WRITABLE_TABLES = [
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
  "activities",
  "projects",
  "project_tasks",
  "project_milestones",
  "contracts",
  "financial_entries",
  "bank_payments",
  "quotes",
  "proposals",
  "services",
  "recurring_plans",
  "subscription_invoices",
  "customer_invoices",
] as const;
export type WorkflowWritableTable = (typeof WORKFLOW_WRITABLE_TABLES)[number];

export type WorkflowEventType = "created" | "updated" | "stage_changed";

export type FilterOp =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gt"
  | "lt"
  | "changed_to"
  | "is_empty"
  | "is_not_empty";

export interface WorkflowFilter {
  field: string;
  op: FilterOp;
  value?: unknown;
}

/** Grupo de condições combinadas com E/OU (agrupamento aninhado, estilo HubSpot). */
export interface WorkflowFilterGroup {
  logic: "and" | "or";
  conditions: WorkflowCondition[];
}

/** Nó de condição: uma condição simples ou um grupo aninhado. */
export type WorkflowCondition = WorkflowFilter | WorkflowFilterGroup;

export function isFilterGroup(node: WorkflowCondition): node is WorkflowFilterGroup {
  return (
    typeof node === "object" &&
    node !== null &&
    Array.isArray((node as WorkflowFilterGroup).conditions)
  );
}

export type TimeTriggerKind =
  | "time_since_field"
  | "no_activity_for"
  | "stuck_in_stage_for"
  | "field_unchanged_for";

export interface TimeTriggerConfig {
  kind: TimeTriggerKind;
  /** Campo de referência (data). Para no_activity_for usa-se `updated_at` por padrão. */
  field?: string;
  amount: number;
  unit: "minutes" | "hours" | "days";
  /** Filtros aplicados na varredura para restringir os registros elegíveis. */
  filters?: WorkflowCondition[];
}

export interface WorkflowTrigger {
  event: WorkflowEventType;
  filters?: WorkflowCondition[];
  reenroll?: {
    enabled: boolean;
    events?: WorkflowEventType[];
  };
  /** Fase 3 — critérios de meta. Se todos passarem no processamento do evento,
   *  o registro sai do workflow sem executar novas ações. */
  goal_filters?: WorkflowCondition[];
  /** Fase 5c — quando presente, o workflow é disparado pelo cron temporal
   *  (não por eventos CRUD). Gera evento sintético do tipo `event`. */
  time_based?: TimeTriggerConfig;
}

export interface SwitchCase {
  label?: string;
  value: unknown;
  actions: WorkflowAction[];
}

export interface MultiBranch {
  label?: string;
  filters: WorkflowCondition[];
  actions: WorkflowAction[];
}

export type WorkflowAction =
  | { type: "set_field"; field: string; value: unknown }
  | { type: "set_substatus"; substatus_id: string }
  | {
      type: "create_activity";
      activity_type?: string;
      subject: string;
      body?: string;
      due_in_days?: number;
    }
  | {
      /** Cria uma atividade de pesquisa pendente (aba Pesquisas) para ser respondida. */
      type: "create_survey_activity";
      source: "survey_template" | "prospecting_questionnaire";
      source_id: string;
      subject?: string;
      body?: string;
      due_in_days?: number;
    }
  | {
      /**
       * Registra uma intenção pendente para abrir, na tela do registro, o modal
       * de criação de oportunidade (negócio) já pré-preenchido. Não cria o
       * negócio automaticamente — a confirmação é sempre do usuário.
       */
      type: "open_deal_dialog";
      pipeline_id?: string;
      stage_value?: string;
      /** Regra da data de previsão de fechamento sugerida no modal. */
      due_rule?: "last_business_day_of_month" | "none";
      subject?: string;
    }
  | { type: "assign_to"; user_id: string }
  | { type: "rotate_assign"; rule_id: string }
  | { type: "add_to_sequence"; sequence_id: string }
  | { type: "send_notification"; title: string; body?: string; user_id?: string }
  | { type: "webhook"; url: string; payload?: Record<string, unknown> }
  | { type: "delay"; amount: number; unit: "minutes" | "hours" | "days" }
  | {
      type: "branch_if";
      filters: WorkflowCondition[];
      then: WorkflowAction[];
      else: WorkflowAction[];
    }
  | {
      type: "create_ats_job";
      title: string;
      department?: string;
      headcount?: number;
      hiring_manager_id?: string;
      recruiter_id?: string;
      notify_user_id?: string;
    }
  | {
      type: "advance_ats_application_stage";
      stage_value: string;
    }
  | {
      type: "create_ats_candidate";
      full_name: string;
      email?: string;
      phone?: string;
      source?: string;
    }
  | {
      type: "assign_recruiter";
      user_id: string;
      target?: "auto" | "job" | "candidate" | "application" | "interview";
    }
  // Fase 1 — Criar entidade
  | {
      type: "create_lead";
      first_name: string;
      last_name?: string;
      email?: string;
      phone?: string;
      company_name?: string;
      source?: string;
      owner_id?: string;
      extra_fields?: Record<string, unknown>;
    }
  | {
      type: "create_contact";
      first_name: string;
      last_name?: string;
      email?: string;
      phone?: string;
      job_title?: string;
      company_name?: string;
      owner_id?: string;
      extra_fields?: Record<string, unknown>;
    }
  | {
      type: "create_company";
      name: string;
      domain?: string;
      industry?: string;
      owner_id?: string;
      extra_fields?: Record<string, unknown>;
    }
  | {
      type: "create_deal";
      name: string;
      value?: number;
      currency?: string;
      pipeline_id?: string;
      stage_id?: string;
      owner_id?: string;
      extra_fields?: Record<string, unknown>;
    }
  | {
      type: "create_ticket";
      subject: string;
      description?: string;
      priority?: string;
      pipeline_id?: string;
      assignee_id?: string;
      extra_fields?: Record<string, unknown>;
    }
  | {
      type: "create_task";
      subject: string;
      body?: string;
      due_in_days?: number;
      assignee_id?: string;
      extra_fields?: Record<string, unknown>;
    }

  // Fase 2 — CRM avançado
  | {
      type: "copy_field_from_association";
      association: string; // chave em ENTITY_ASSOCIATIONS
      source_field: string;
      target_field: string;
    }
  | {
      type: "associate_records";
      association: string;
      target_id: string; // uuid ou {{token}}
    }
  | {
      type: "disassociate_records";
      association: string;
    }
  | { type: "clear_field"; field: string }
  | { type: "increment_field"; field: string; amount: number }
  | {
      type: "send_email";
      template_id?: string;
      subject: string;
      body: string;
      to_field?: string; // default: "email"
    }
  | {
      type: "send_whatsapp";
      template_name?: string;
      body?: string;
      to_field?: string; // default: "phone"
    }
  // Fase 3 — Fluxo avançado
  | {
      type: "switch_by_value";
      field: string;
      cases: SwitchCase[];
      default: WorkflowAction[];
    }
  | {
      type: "branch_multi";
      branches: MultiBranch[];
      else: WorkflowAction[];
    }
  | {
      type: "delay_until_date";
      field: string; // campo tipo data no registro
      offset_amount?: number; // pode ser negativo
      offset_unit?: "minutes" | "hours" | "days";
    }
  // Fase 5 — Utilitários avançados
  | {
      type: "format_data";
      op:
        | "upper"
        | "lower"
        | "trim"
        | "date_add"
        | "date_format"
        | "number_round"
        | "template_string";
      /** Campo do registro para ler o valor de entrada (ex: "name" ou "created_at"). Ignorado quando op=template_string. */
      source_field?: string;
      /** Nome da variável do run onde o resultado é armazenado (acessível via {{vars.NAME}}). */
      target_var: string;
      /** Para template_string: template com tokens {{field}} / {{vars.X}}. */
      template?: string;
      /** Para date_format. Ex: "yyyy-MM-dd" ou "dd/MM/yyyy HH:mm". */
      format?: string;
      /** Para date_add / number_round: quantidade / precisão. */
      amount?: number;
      /** Para date_add. */
      unit?: "minutes" | "hours" | "days";
    }
  | {
      type: "send_slack";
      /** ID do canal Slack (C0…). Se vazio, usa default_channel_id da integração. */
      channel?: string;
      /** Texto (aceita tokens {{field}} / {{vars.X}}). */
      text: string;
    }
  | {
      type: "send_teams";
      /** Incoming webhook URL do Teams (configurável por ação; fica no workflow). */
      webhook_url: string;
      title?: string;
      text: string;
    }
  // Fase 5b — Aprovações
  | {
      type: "approval_step";
      /** Título da aprovação exibido para o aprovador. Aceita tokens. */
      title: string;
      /** Nota/contexto para o aprovador. Aceita tokens. */
      note?: string;
      /** Usuário responsável pela decisão. Se vazio, usa o owner do workflow. */
      approver_user_id?: string;
      /** Se true, ao rejeitar interrompe a run com erro; se false, apenas ignora o restante. */
      halt_on_reject?: boolean;
    }
  // Ações genéricas cross-módulo
  | {
      type: "create_record";
      table: WorkflowWritableTable;
      values: Record<string, unknown>;
      owner_id?: string;
    }
  | {
      type: "update_record";
      table: WorkflowWritableTable;
      target_id: string;
      values: Record<string, unknown>;
    }
  | {
      type: "delete_record";
      table: WorkflowWritableTable;
      target_id: string;
    };

export type WorkflowActionType = WorkflowAction["type"];

export const ENTITY_LABELS: Record<WorkflowEntity, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
  tickets: "Tickets",
  ats_jobs: "Vagas (ATS)",
  ats_candidates: "Candidatos (ATS)",
  ats_applications: "Aplicações (ATS)",
  ats_interviews: "Entrevistas (ATS)",
  projects: "Projetos",
  project_tasks: "Tarefas de projeto",
  project_milestones: "Marcos de projeto",
  contracts: "Contratos",
  financial_entries: "Lançamentos financeiros",
  bank_payments: "Pagamentos bancários",
  quotes: "Cotações",
  proposals: "Propostas",
  services: "Serviços",
  recurring_plans: "Planos recorrentes",
  subscription_invoices: "Faturas de assinatura",
  customer_invoices: "Faturas de clientes",
};

// Grupos por módulo (para dropdown do builder).
export const ENTITY_GROUPS: Array<{ label: string; entities: WorkflowEntity[] }> = [
  { label: "Vendas", entities: ["leads", "contacts", "companies", "deals", "quotes", "proposals"] },
  { label: "Atendimento", entities: ["tickets"] },
  {
    label: "Recrutamento",
    entities: ["ats_jobs", "ats_candidates", "ats_applications", "ats_interviews"],
  },
  { label: "Projetos", entities: ["projects", "project_tasks", "project_milestones"] },
  { label: "Contratos e catálogo", entities: ["contracts", "services"] },
  {
    label: "Financeiro",
    entities: [
      "financial_entries",
      "bank_payments",
      "customer_invoices",
      "subscription_invoices",
      "recurring_plans",
    ],
  },
];

export const EVENT_LABELS: Record<WorkflowEventType, string> = {
  created: "Quando for criado",
  updated: "Quando for atualizado",
  stage_changed: "Quando mudar de etapa",
};

export const ACTION_LABELS: Record<WorkflowActionType, string> = {
  set_field: "Atualizar campo",
  set_substatus: "Atualizar substatus",
  create_activity: "Criar atividade",
  create_survey_activity: "Criar pesquisa (atividade)",
  open_deal_dialog: "Abrir criação de oportunidade",
  assign_to: "Atribuir a usuário",
  rotate_assign: "Distribuir via regra (rotação)",
  add_to_sequence: "Adicionar a sequência",
  send_notification: "Enviar notificação",
  webhook: "Disparar webhook",
  delay: "Esperar (delay)",
  branch_if: "Se / Então / Senão",
  create_ats_job: "Abrir vaga no ATS (rascunho)",
  advance_ats_application_stage: "Mover aplicação para etapa (ATS)",
  create_ats_candidate: "Criar candidato (ATS)",
  assign_recruiter: "Atribuir recrutador (ATS)",
  create_lead: "Criar lead",
  create_contact: "Criar contato",
  create_company: "Criar empresa",
  create_deal: "Criar negócio",
  create_ticket: "Criar ticket",
  create_task: "Criar tarefa",
  copy_field_from_association: "Copiar campo de associação",
  associate_records: "Associar registro",
  disassociate_records: "Desassociar registro",
  clear_field: "Limpar campo",
  increment_field: "Incrementar campo",
  send_email: "Enviar email",
  send_whatsapp: "Enviar WhatsApp",
  switch_by_value: "Ramificar por valor (switch)",
  branch_multi: "Ramificação múltipla",
  delay_until_date: "Esperar até data",
  format_data: "Formatar dados",
  send_slack: "Enviar mensagem no Slack",
  send_teams: "Enviar mensagem no Teams",
  approval_step: "Aprovação humana",
  create_record: "Criar registro (qualquer módulo)",
  update_record: "Atualizar registro (qualquer módulo)",
  delete_record: "Excluir registro (qualquer módulo)",
};

// Categorias exibidas na biblioteca de ações do builder (estilo HubSpot).
export const ACTION_CATEGORIES: Array<{ label: string; actions: WorkflowActionType[] }> = [
  {
    label: "Controle de fluxo",
    actions: [
      "delay",
      "delay_until_date",
      "branch_if",
      "switch_by_value",
      "branch_multi",
      "approval_step",
    ],
  },
  {
    label: "CRM",
    actions: [
      "set_field",
      "set_substatus",
      "clear_field",
      "increment_field",
      "copy_field_from_association",
      "associate_records",
      "disassociate_records",
      "assign_to",
      "rotate_assign",
    ],
  },
  {
    label: "Criar registro",
    actions: [
      "create_lead",
      "create_contact",
      "create_company",
      "create_deal",
      "open_deal_dialog",
      "create_ticket",
      "create_task",
    ],
  },
  // "Registros (qualquer módulo)" agora é renderizado via RECORD_ACTION_MODULES
  // com submenu por módulo → entidade → operação. Mantido fora do array plano.

  {
    label: "Comunicação",
    actions: [
      "create_activity",
      "create_survey_activity",
      "send_notification",
      "send_email",
      "send_whatsapp",
      "send_slack",
      "send_teams",
    ],
  },
  { label: "Sequências", actions: ["add_to_sequence"] },
  {
    label: "Recrutamento (ATS)",
    actions: [
      "create_ats_job",
      "create_ats_candidate",
      "advance_ats_application_stage",
      "assign_recruiter",
    ],
  },
  { label: "Utilitários", actions: ["format_data"] },
  { label: "Externo", actions: ["webhook"] },
];

// Catálogo de "Registros (qualquer módulo)" agrupado por módulo com labels
// específicos por entidade. Consumido pelo ActionLibraryPanel para renderizar
// navegação módulo → entidade → operação (Criar/Editar/Excluir).
export type RecordActionEntity = {
  table: WorkflowWritableTable;
  singular: string; // rótulo curto para linha da entidade (ex.: "Projeto")
  hint?: string; // texto auxiliar opcional
};

export type RecordActionModule = {
  key: string;
  label: string;
  entities: RecordActionEntity[];
};

export const RECORD_ACTION_MODULES: RecordActionModule[] = [
  {
    key: "sales",
    label: "Vendas",
    entities: [
      { table: "leads", singular: "Lead" },
      { table: "contacts", singular: "Contato" },
      { table: "companies", singular: "Empresa" },
      { table: "deals", singular: "Negócio" },
      { table: "quotes", singular: "Cotação" },
      { table: "proposals", singular: "Proposta" },
    ],
  },
  {
    key: "support",
    label: "Atendimento",
    entities: [{ table: "tickets", singular: "Ticket" }],
  },
  {
    key: "ats",
    label: "Recrutamento (ATS)",
    entities: [
      { table: "ats_jobs", singular: "Vaga" },
      { table: "ats_candidates", singular: "Candidato" },
      { table: "ats_applications", singular: "Aplicação" },
      { table: "ats_interviews", singular: "Entrevista" },
    ],
  },
  {
    key: "projects",
    label: "Projetos",
    entities: [
      { table: "projects", singular: "Projeto" },
      { table: "project_tasks", singular: "Tarefa de projeto" },
      { table: "project_milestones", singular: "Marco de projeto" },
    ],
  },
  {
    key: "catalog",
    label: "Contratos e catálogo",
    entities: [
      { table: "contracts", singular: "Contrato" },
      { table: "services", singular: "Serviço" },
    ],
  },
  {
    key: "finance",
    label: "Financeiro",
    entities: [
      {
        table: "financial_entries",
        singular: "Lançamento financeiro",
        hint: "Contas a pagar/receber (definido pelo campo direção)",
      },
      { table: "bank_payments", singular: "Pagamento bancário" },
      { table: "customer_invoices", singular: "Fatura de cliente" },
      { table: "subscription_invoices", singular: "Fatura de assinatura" },
      { table: "recurring_plans", singular: "Plano recorrente" },
    ],
  },
  {
    key: "activities",
    label: "Atividades",
    entities: [{ table: "activities", singular: "Atividade" }],
  },
];

// Common fields by entity, used in filter dropdowns and set_field actions
export const ENTITY_FIELDS: Record<WorkflowEntity, string[]> = {
  leads: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "company_name",
    "source",
    "status",
    "score",
    "label",
    "owner_id",
  ],
  contacts: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "job_title",
    "company_name",
    "label",
    "score",
    "owner_id",
  ],
  companies: [
    "name",
    "domain",
    "industry",
    "size",
    "city",
    "state",
    "country",
    "is_target_account",
    "owner_id",
  ],
  deals: [
    "name",
    "value",
    "currency",
    "stage",
    "stage_id",
    "pipeline_id",
    "expected_close_date",
    "owner_id",
  ],
  tickets: [
    "subject",
    "description",
    "status",
    "priority",
    "source",
    "assignee_id",
    "pipeline_id",
    "contact_id",
    "company_id",
    "deal_id",
    "due_at",
  ],
  ats_jobs: [
    "title",
    "status",
    "seniority",
    "employment_type",
    "location",
    "remote_mode",
    "pipeline_id",
    "hiring_manager_id",
    "recruiter_id",
    "company_id",
    "deal_id",
  ],
  ats_candidates: [
    "full_name",
    "email",
    "phone",
    "source",
    "score",
    "location",
    "current_position",
    "current_company",
    "relationship_status",
    "relationship_owner_id",
    "owner_id",
  ],
  ats_applications: [
    "job_id",
    "candidate_id",
    "stage_value",
    "status",
    "source",
    "ai_match_score",
    "position",
  ],
  ats_interviews: [
    "job_id",
    "candidate_id",
    "application_id",
    "interviewer_id",
    "status",
    "kind",
    "scheduled_at",
    "duration_min",
    "stage_value",
  ],
  projects: [
    "name",
    "status",
    "priority",
    "company_id",
    "deal_id",
    "start_date",
    "end_date",
    "budget",
    "owner_id",
  ],
  project_tasks: ["name", "status_id", "priority", "assignee_id", "project_id", "due_date"],
  project_milestones: ["name", "status", "due_date", "project_id"],
  contracts: [
    "title",
    "status",
    "value",
    "currency",
    "start_date",
    "end_date",
    "company_id",
    "deal_id",
    "owner_id",
  ],
  financial_entries: [
    "description",
    "kind",
    "status",
    "amount",
    "due_date",
    "paid_at",
    "category_id",
    "cost_center_id",
    "legal_entity_id",
    "bank_account_id",
    "owner_id",
  ],
  bank_payments: ["description", "status", "amount", "due_date", "paid_at", "bank_account_id"],
  quotes: [
    "title",
    "status",
    "total",
    "currency",
    "deal_id",
    "company_id",
    "valid_until",
    "owner_id",
  ],
  proposals: [
    "title",
    "status",
    "value",
    "deal_id",
    "company_id",
    "sent_at",
    "accepted_at",
    "owner_id",
  ],
  services: ["name", "unit_price", "duration_min", "active", "category", "owner_id"],
  recurring_plans: ["name", "amount", "currency", "interval", "active", "owner_id"],
  subscription_invoices: ["number", "status", "amount", "due_date", "paid_at", "subscription_id"],
  customer_invoices: ["number", "status", "amount", "due_date", "paid_at", "company_id"],
};

export const FILTER_OPS: Array<{ value: FilterOp; label: string }> = [
  { value: "eq", label: "é igual a" },
  { value: "neq", label: "é diferente de" },
  { value: "in", label: "está em (lista separada por vírgula)" },
  { value: "contains", label: "contém" },
  { value: "gt", label: "maior que" },
  { value: "lt", label: "menor que" },
  { value: "changed_to", label: "mudou para" },
  { value: "is_empty", label: "está vazio" },
  { value: "is_not_empty", label: "não está vazio" },
];
