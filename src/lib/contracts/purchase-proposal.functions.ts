import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { purchaseProposalDataSchema } from "./purchase-proposal.types";
import {
  purchaseProposalContext,
  savePurchaseProposal,
  generatePurchaseProposalDocument,
  previewPurchaseProposalDocument,
} from "./purchase-proposal.server";

const contract = z.object({ contractId: z.string().uuid() });
const document = contract.extend({ documentId: z.string().uuid() });
const revision = z.object({
  expectedVersion: z.number().int().min(0),
  expectedContractHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export const getPurchaseProposalContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contract)
  .handler(async ({ data, context }) => {
    return purchaseProposalContext(context.supabase, data.contractId);
  });

export const savePurchaseProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    contract
      .merge(revision)
      .extend({ templateId: z.string().uuid(), data: purchaseProposalDataSchema }),
  )
  .handler(async ({ data, context }) => {
    return savePurchaseProposal(context.supabase, data);
  });

export const generatePurchaseProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(document.merge(revision))
  .handler(async ({ data, context }) => {
    return generatePurchaseProposalDocument(context.supabase, data);
  });

export const previewPurchaseProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(document)
  .handler(async ({ data, context }) => {
    return previewPurchaseProposalDocument(
      context.supabase,
      context.userId,
      data.contractId,
      data.documentId,
    );
  });
