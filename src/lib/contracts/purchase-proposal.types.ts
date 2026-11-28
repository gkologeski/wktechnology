import { z } from "zod";
import type { VisualDesign } from "../proposals/visual-design";
import { purchaseProposalAmounts } from "./purchase-proposal-amounts";

export const PURCHASE_PROPOSAL_KEYS = {
  view: "techcontracts.purchase_proposals.view.workspace",
  manage: "techcontracts.purchase_proposals.manage.workspace",
  templates: "techcontracts.purchase_proposal_templates.manage.workspace",
} as const;

const text = (maximum: number) => z.string().trim().max(maximum);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T12:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Data inválida.")
  .nullable();
export const purchaseProposalDataSchema = z
  .object({
    title: text(200).min(1),
    scope: text(30000).min(1),
    exclusions: text(12000),
    acceptanceCriteria: text(12000).min(1),
    hours: z.number().finite().min(0.000001).max(1000000),
    hourlyRate: z.number().finite().min(0.000001).max(100000000),
    businessDays: z.number().int().positive().max(10000),
    startsOn: day,
    endsOn: day,
    paymentTerms: text(12000).min(1),
    responsibilities: text(12000).min(1),
    warrantyDays: z.number().int().min(0).max(3650),
    milestones: z
      .array(
        z
          .object({
            id: text(100).min(1),
            title: text(200).min(1),
            description: text(12000).min(1),
            acceptanceCriteria: text(12000).min(1),
            hours: z.number().finite().min(0.000001).max(1000000),
            businessDays: z.number().int().positive().max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((data, ctx) => {
    try {
      purchaseProposalAmounts(data);
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["hourlyRate"],
        message: "O valor da compra excede o limite de precisão monetária.",
      });
    }
    const allocated = data.milestones.reduce((sum, row) => sum + row.hours, 0);
    if (Math.abs(allocated - data.hours) > 0.000001)
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: "A soma das horas dos marcos deve corresponder às horas da compra.",
      });
    if (new Set(data.milestones.map((row) => row.id)).size !== data.milestones.length)
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: "Identificação de marco duplicada.",
      });
    if (data.startsOn && data.endsOn && data.endsOn < data.startsOn)
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "O término deve ser igual ou posterior ao início.",
      });
  });
export type PurchaseProposalData = z.infer<typeof purchaseProposalDataSchema>;
export type PurchaseProposalParty = { name: string; cnpj: string | null };
export type PurchaseProposalTemplate = {
  id: string;
  name: string;
  revision: number;
  design: VisualDesign;
};
export type PurchaseProposalDocument = {
  id: string;
  version: number;
  templateId: string;
  templateRevision: number;
  data: PurchaseProposalData;
  design: VisualDesign;
  parties: { wk: PurchaseProposalParty; supplier: PurchaseProposalParty };
  createdAt: string;
  attachmentId: string | null;
  status: "draft" | "reserved" | "generated";
  sha256: string | null;
};
export type PurchaseProposalContext = {
  canView: boolean;
  canManage: boolean;
  canGenerate: boolean;
  canManageTemplates: boolean;
  isPurchase: boolean;
  contractHash: string | null;
  branding?: { logoUrl: string | null };
  blockedReason: string | null;
  contract?: {
    id: string;
    totalValue: number;
    currency: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  parties?: { wk: PurchaseProposalParty; supplier: PurchaseProposalParty } | null;
  templates: PurchaseProposalTemplate[];
  documents: PurchaseProposalDocument[];
};
export type PurchaseProposalSaveInput = {
  contractId: string;
  templateId: string;
  expectedVersion: number;
  expectedContractHash: string;
  data: PurchaseProposalData;
};
export type PurchaseProposalDocumentInput = { contractId: string; documentId: string };

/** Generic initial terms, without transaction numbers, counterparty or sales data. */
export function createEmptyPurchaseProposalData(): PurchaseProposalData {
  return {
    title: "Proposta técnica — Fábrica de Software",
    scope: "",
    exclusions: "",
    acceptanceCriteria: "",
    hours: 0,
    hourlyRate: 0,
    businessDays: 0,
    startsOn: null,
    endsOn: null,
    paymentTerms:
      "Pagamento em 10 dias úteis após, cumulativamente, aceite expresso da WK e apresentação de nota fiscal válida.",
    responsibilities:
      "A fornecedora executará requisitos, arquitetura, desenvolvimento, testes, correções e documentação. A implantação em produção será realizada pela WK. Excesso de horas sobre o preço fechado da entrega será de responsabilidade da fornecedora. Mudanças deverão ser formalizadas em documento assinado.",
    warrantyDays: 90,
    milestones: [],
  };
}
