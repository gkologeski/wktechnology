// Esquemas de entrada das funções de tarifas, medições e rentabilidade (fora do *.functions.ts, que fica fino).
import { z } from "zod";
import { BILLING_MODELS } from "@/lib/projects/billing.shared";

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida");
export const reason = z.string().trim().min(10, "Mínimo de 10 caracteres").max(1000);
export const shortReason = z.string().trim().min(5, "Mínimo de 5 caracteres").max(1000);
export const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Moeda com 3 letras");
export const hash = z.string().min(1).max(64);
export const tz = z.string().min(3).max(64);
/** Valor monetário: null nunca é aceito como zero; zero só se informado. */
export const money = z.number().finite().min(0).max(1e12);

export const rateTarget = z.object({
  project_id: uuid.optional(),
  user_id: uuid.optional(),
  allocation_id: uuid.optional(),
  service_id: uuid.optional(),
  person_id: uuid.optional(),
  service_catalog_id: uuid.optional(),
  confirm_exception: z.boolean().optional(),
});

export const rateCreate = z.object({
  kind: z.enum(["cost", "price"]),
  scope: z.enum(["exception", "allocation", "service", "person", "catalog"]),
  target: rateTarget,
  unit: z.enum(["hour", "month"]),
  proration: z.enum(["full_month", "calendar_days"]).nullable(),
  currency,
  amount: money,
  validFrom: isoDate,
  validTo: isoDate.nullable(),
  reason: shortReason,
  confirmRetroactive: z.boolean(),
});

export const billingParams = z.record(z.string(), z.union([z.boolean(), z.number(), z.string()]));

export const configSave = z.object({
  contractId: uuid,
  serviceId: uuid.nullable(),
  model: z.enum(BILLING_MODELS),
  params: billingParams,
  validFrom: isoDate,
  reason,
});

export const listScope = z
  .object({
    projectId: uuid.optional(),
    contractId: uuid.optional(),
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .refine((v) => Boolean(v.projectId) !== Boolean(v.contractId), "Informe projeto ou contrato.");

export const profitabilityInput = z
  .object({
    projectId: uuid.optional(),
    contractId: uuid.optional(),
    fromMonth: month,
    toMonth: month,
    currency,
  })
  .refine((v) => Boolean(v.projectId) !== Boolean(v.contractId), "Informe projeto ou contrato.");
