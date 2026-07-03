export type WorkflowEntity =
  | "leads"
  | "contacts"
  | "companies"
  | "deals"
  | "tickets"
  | "ats_jobs"
  | "ats_candidates"
  | "ats_applications"
  | "ats_interviews";

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

export interface WorkflowTrigger {
  event: WorkflowEventType;
  filters?: WorkflowFilter[];
  reenroll?: {
    enabled: boolean;
    events?: WorkflowEventType[];
  };
}

export type WorkflowAction =
  | { type: "set_field"; field: string; value: unknown }
  | {
      type: "create_activity";
      activity_type?: string;
      subject: string;
      body?: string;
      due_in_days?: number;
    }
  | { type: "assign_to"; user_id: string }
  | { type: "rotate_assign"; rule_id: string }
  | { type: "add_to_sequence"; sequence_id: string }
  | { type: "send_notification"; title: string; body?: string; user_id?: string }
  | { type: "webhook"; url: string; payload?: Record<string, unknown> }
  | { type: "delay"; amount: number; unit: "minutes" | "hours" | "days" }
  | {
      type: "branch_if";
      filters: WorkflowFilter[];
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
};

// Grupos por módulo (para dropdown do builder).
export const ENTITY_GROUPS: Array<{ label: string; entities: WorkflowEntity[] }> = [
  { label: "Vendas", entities: ["leads", "contacts", "companies", "deals"] },
  { label: "Atendimento", entities: ["tickets"] },
  {
    label: "Recrutamento",
    entities: ["ats_jobs", "ats_candidates", "ats_applications", "ats_interviews"],
  },
];

export const EVENT_LABELS: Record<WorkflowEventType, string> = {
  created: "Quando for criado",
  updated: "Quando for atualizado",
  stage_changed: "Quando mudar de etapa",
};

export const ACTION_LABELS: Record<WorkflowActionType, string> = {
  set_field: "Atualizar campo",
  create_activity: "Criar atividade",
  assign_to: "Atribuir a usuário",
  rotate_assign: "Distribuir via regra (rotação)",
  add_to_sequence: "Adicionar a sequência",
  send_notification: "Enviar notificação",
  webhook: "Disparar webhook",
  create_ats_job: "Abrir vaga no ATS (rascunho)",
  advance_ats_application_stage: "Mover aplicação para etapa (ATS)",
  create_ats_candidate: "Criar candidato (ATS)",
  assign_recruiter: "Atribuir recrutador (ATS)",
};

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
