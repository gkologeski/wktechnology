// Schema client-safe compartilhado para a extração de contratos importados.
// Reflete a coluna correspondente em public.contracts.
import { z } from "zod";

export const SERVICE_TYPES = [
  "outsourcing",
  "desenvolvimento",
  "manutencao",
  "consultoria",
  "licenciamento",
  "outros",
] as const;

export const SERVICE_LOCATIONS = ["remoto", "presencial", "hibrido"] as const;

export const PAYMENT_METHODS = ["pix", "ted", "boleto", "transferencia", "outros"] as const;

export const SIGNATURE_PROVIDERS = [
  "forsign",
  "docusign",
  "clicksign",
  "manual",
  "outros",
] as const;

export const READJUSTMENT_INDEXES = ["IGPM", "IPCA", "INPC", "SELIC", "CDI", "outros"] as const;

// Schema retornado pela IA. Todos os campos são opcionais — extração parcial é o caso comum.
export const ExtractedContractSchema = z.object({
  title: z.string().optional().nullable(),
  role: z.enum(["provider", "client"]).optional().nullable(),

  /** Tipo do documento: contrato principal ou termo aditivo. */
  document_kind: z.enum(["main", "amendment"]).optional().nullable(),
  /** Número do aditivo ("1", "2", ...), quando o documento é um termo aditivo. */
  amendment_number: z.string().max(40).optional().nullable(),
  /** Número/identificação do contrato que o aditivo altera, quando citado. */
  amends_contract_number: z.string().max(120).optional().nullable(),

  counterparty_name: z.string().optional().nullable(),
  counterparty_cnpj: z.string().optional().nullable(),
  contracting_name: z.string().optional().nullable(),
  contracting_cnpj: z.string().optional().nullable(),

  starts_at: z.string().optional().nullable(), // ISO YYYY-MM-DD
  ends_at: z.string().optional().nullable(),
  auto_renew: z.boolean().optional().nullable(),
  notice_days: z.number().int().nonnegative().optional().nullable(),

  total_value: z.number().nonnegative().optional().nullable(),
  monthly_value: z.number().nonnegative().optional().nullable(),
  hours_per_month: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().optional().nullable(),

  payment_day: z.number().int().min(1).max(31).optional().nullable(),
  payment_method: z.enum(PAYMENT_METHODS).optional().nullable(),
  late_fee_percent: z.number().nonnegative().optional().nullable(),
  late_interest_monthly_percent: z.number().nonnegative().optional().nullable(),
  expense_reimbursement_days: z.number().int().nonnegative().optional().nullable(),

  readjustment_index: z.string().optional().nullable(),
  readjustment_period: z.string().optional().nullable(),

  penalty_percent: z.number().nonnegative().optional().nullable(),
  cure_period_days: z.number().int().nonnegative().optional().nullable(),
  trial_period_days: z.number().int().nonnegative().optional().nullable(),
  unilateral_termination_notice_days: z.number().int().nonnegative().optional().nullable(),

  service_type: z.enum(SERVICE_TYPES).optional().nullable(),
  service_scope: z.string().optional().nullable(),
  service_location: z.enum(SERVICE_LOCATIONS).optional().nullable(),

  governing_law: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  confidentiality_term_months: z.number().int().nonnegative().optional().nullable(),

  signature_provider: z.enum(SIGNATURE_PROVIDERS).optional().nullable(),
  signature_document_id: z.string().optional().nullable(),
  signature_operation_id: z.string().optional().nullable(),

  witnesses: z
    .array(
      z.object({
        name: z.string().optional().nullable(),
        cpf: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
      }),
    )
    .optional()
    .nullable(),

  /** Número do próprio contrato, quando impresso no documento. */
  self_contract_number: z.string().max(120).optional().nullable(),
  /**
   * Números de outros contratos citados no documento (ex.: um contrato de compra
   * que referencia o contrato de prestação com o cliente final).
   */
  referenced_contract_numbers: z.array(z.string().max(120)).optional().nullable(),

  confidence: z.number().min(0).max(1).optional().nullable(),
  warnings: z.array(z.string()).optional().nullable(),
});

export type ExtractedContract = z.infer<typeof ExtractedContractSchema>;

// Payload de criação a partir da importação. Aceita todos os campos + arquivo de origem.
export const CreateFromImportSchema = z.object({
  fields: ExtractedContractSchema,
  source_file_path: z.string().nullable().optional(),
  imported_from: z.enum(["pdf", "docx"]),
});
export type CreateFromImportInput = z.infer<typeof CreateFromImportSchema>;
