// Modelos nativos do ciclo de contratação/desligamento (Fase 3).
// São apenas rascunhos pré-preenchidos: o admin revisa, ajusta e publica.
// Nada roda sem publicação, e cada workspace pode editar ou desligar os passos.
import { HIRING_EVENT_PRESETS } from "./hiring-events";
import type { WorkflowAction, WorkflowEntity, WorkflowTrigger } from "./types";

export interface HiringTemplate {
  key: string;
  name: string;
  description: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
}

const hired = HIRING_EVENT_PRESETS["ats.candidate.hired"];
const terminated = HIRING_EVENT_PRESETS["people.person.terminated"];

/** Gatilho "Candidato contratado" restrito a um modelo do diálogo de desfecho. */
function hiredAs(model: "internal" | "outsourcing" | "hunting"): WorkflowTrigger {
  return {
    ...hired.trigger,
    filters: [
      ...(hired.trigger.filters ?? []),
      { field: "hiring_details.model", op: "equals", value: model },
    ],
  } as WorkflowTrigger;
}

const PERSON = "{{vars.contratacao.person_id}}";

export const HIRING_TEMPLATES: HiringTemplate[] = [
  {
    key: "internal_pj",
    name: "Contratação interna PJ",
    description: "Pessoa no TechPeople, contrato PJ e 12 parcelas mensais a pagar.",
    entity: "ats_applications",
    trigger: hiredAs("internal"),
    actions: [
      { type: "create_person_from_candidate", employment_type: "pj" },
      { type: "create_contract_document", kind: "provider", person_id: PERSON },
      {
        type: "create_payable_schedule",
        person_id: PERSON,
        amount: "{{hiring_details.monthly_amount}}",
        installments: 12,
        day_of_month: 10,
      },
    ] as WorkflowAction[],
  },
  {
    key: "internal_freelancer",
    name: "Freelancer técnico (por hora)",
    description: "Pessoa freelancer com custo/hora e contrato de prestação.",
    entity: "ats_applications",
    trigger: {
      ...hiredAs("internal"),
      filters: [
        ...(hiredAs("internal").filters ?? []),
        { field: "hiring_details.modality", op: "equals", value: "hourly" },
      ],
    } as WorkflowTrigger,
    actions: [
      {
        type: "create_person_from_candidate",
        employment_type: "contractor",
        cost_hour: "{{hiring_details.hourly_rate}}",
      },
      { type: "create_contract_document", kind: "provider", person_id: PERSON },
    ] as WorkflowAction[],
  },
  {
    key: "outsourcing",
    name: "Alocação em cliente (outsourcing)",
    description: "Pessoa, contrato e alocação no projeto do cliente — escolha o projeto.",
    entity: "ats_applications",
    trigger: hiredAs("outsourcing"),
    actions: [
      { type: "create_person_from_candidate" },
      { type: "create_contract_document", kind: "provider", person_id: PERSON },
      {
        type: "create_allocation",
        person_id: PERSON,
        allocation_pct: "100",
        cost_rate: "{{hiring_details.hourly_rate}}",
      },
    ] as WorkflowAction[],
  },
  {
    key: "hunting",
    name: "Sucesso de hunting",
    description: "Conta a receber dos honorários contra a empresa da vaga. Sem pessoa interna.",
    entity: "ats_applications",
    trigger: hiredAs("hunting"),
    actions: [
      {
        type: "create_receivable_invoice",
        amount: "{{hiring_details.fee_amount}}",
        description: "Honorários de hunting",
        due_in_days: 30,
      },
    ] as WorkflowAction[],
  },
  {
    key: "offboarding",
    name: "Desligamento",
    description: "Encerra contratos e alocações, revoga acesso e cancela parcelas futuras.",
    entity: terminated.entity,
    trigger: terminated.trigger,
    actions: [
      { type: "terminate_contracts" },
      { type: "close_allocations" },
      { type: "revoke_access" },
      { type: "cancel_payable_schedules" },
    ] as WorkflowAction[],
  },
];
