import { z } from "zod";
export const requestKind = z.enum(["professional", "supplier"]);
export type RequestKind = z.infer<typeof requestKind>;
const optionalId = z.string().uuid().nullable();
export const preparationData = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(200),
    scope_text: z.string().max(10000),
    purpose: z.enum(["client", "internal", "shared_management"]),
    area_id: optionalId,
    legal_entity_id: optionalId,
    regime: z.enum(["clt", "pj", "freelance"]).nullable(),
    person_id: optionalId,
    company_id: optionalId,
    contact_id: optionalId,
    deal_id: optionalId,
    additional_deal_ids: z.array(z.string().uuid()).max(20, "Até 20 negócios adicionais.").default([]),
    project_id: optionalId,
    commercial_contract_id: optionalId,
    status: z.enum(["draft", "ready", "cancelled"]),
    selection_mode: z.enum(["defined", "needs_selection"]).default("needs_selection"),
    modality: z.enum(["delivery", "hourly", "monthly", "mixed"]).default("delivery"),
    release_condition: z
      .enum(["wk_acceptance_invoice", "also_client_acceptance"])
      .nullable()
      .default(null),
  })
  .strict();
export type PreparationData = z.infer<typeof preparationData>;
export type PreparationRow = PreparationData & {
  id: string;
  workspace_id: string;
  kind: RequestKind;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type PreparationEvent = {
  id: string;
  revision: number;
  created_at: string;
  actor_id: string;
  snapshot: PreparationRow;
};
export const resourceFor = (kind: RequestKind) =>
  kind === "professional" ? "techpeople.hiring_requests" : "techcontracts.supplier_requests";
export const statusLabels = {
  draft: "Rascunho",
  ready: "Pronta para aprovação",
  cancelled: "Cancelada",
};
export const emptyPreparation = (kind: RequestKind): PreparationData => ({
  title: "",
  scope_text: "",
  purpose: "internal",
  area_id: null,
  legal_entity_id: null,
  regime: kind === "professional" ? "clt" : null,
  person_id: null,
  company_id: null,
  contact_id: null,
  deal_id: null,
  additional_deal_ids: [],
  project_id: null,
  commercial_contract_id: null,
  status: "draft",
  selection_mode: "needs_selection",
  modality: "delivery",
  release_condition: kind === "supplier" ? "wk_acceptance_invoice" : null,
});
export const preparationWriteData = preparationData.extend({
  reference_value: z.number().finite().min(0).max(999999999999.99).nullable().optional(),
});
export const modalityLabels = {
  delivery: "Por entrega",
  hourly: "Por hora",
  monthly: "Mensal",
  mixed: "Mista",
};
export const releaseLabels = {
  wk_acceptance_invoice: "Aceite WK + NF válida",
  also_client_acceptance: "Aceite WK + NF válida + aceite cliente final",
};
export const wizardSteps = ["Demanda", "Vínculos", "Condições", "Revisão"] as const;
export const pickerKind = z.enum([
  "area",
  "legal_entity",
  "person",
  "company",
  "contact",
  "deal",
  "project",
  "contract",
  "commercial_contract",
]);
export type PickerKind = z.infer<typeof pickerKind>;
export type PickerOption = { id: string; label: string; hint?: string | null };
