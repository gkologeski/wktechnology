import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import {
  discardPendingLegacyContract,
  loadLegacyState,
  openLegacyEvidence,
  recognizeLegacyContract,
  regularizeLegacyContract,
  uploadLegacyEvidence,
} from "./legacy.server";

// LEGADO-REGULARIZA: wrappers finos. Toda decisão é da RPC com o cliente do usuário (context.supabase).
const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const discardContractLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: id,
      expectedRevision: z.number().int().positive(),
      reason: z.string().trim().min(5).max(2000),
      confirmed: z.literal(true),
      operationId: id,
    }),
  )
  .handler(async ({ context, data }) =>
    discardPendingLegacyContract(context.supabase, {
      workspaceId: await getActiveWorkspaceId(context.supabase, context.userId),
      ...data,
    }),
  );

export const getContractLegacyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id }))
  .handler(async ({ context, data }) =>
    loadLegacyState(
      context.supabase,
      await getActiveWorkspaceId(context.supabase, context.userId),
      data.contractId,
    ),
  );

export const recognizeContractLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: id,
      expectedRevision: z.number().int().positive().nullable(),
      reason: z.string().trim().min(5).max(2000),
      operationId: id,
    }),
  )
  .handler(async ({ context, data }) =>
    recognizeLegacyContract(context.supabase, {
      workspaceId: await getActiveWorkspaceId(context.supabase, context.userId),
      ...data,
    }),
  );

export const uploadContractLegacyEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: id,
      expectedRevision: z.number().int().positive(),
      fileName: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .regex(/\.pdf$/i),
      base64: z.string().min(8).max(7_100_000),
      operationId: id,
    }),
  )
  .handler(async ({ context, data }) =>
    uploadLegacyEvidence(
      context.supabase,
      context.userId,
      await getActiveWorkspaceId(context.supabase, context.userId),
      data,
    ),
  );

export const regularizeContractLegacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: id,
      expectedRevision: z.number().int().positive(),
      situation: z.enum(["in_force", "ended", "terminated"]),
      signedOn: day,
      signatureConfirmed: z.literal(true),
      startsOn: day,
      endsOn: day.nullable(),
      terminatedOn: day.nullable(),
      autoRenew: z.boolean(),
      autoRenewConfirmed: z.boolean(),
      evidenceId: id,
      evidenceSha256: z.string().regex(/^[0-9a-f]{64}$/),
      externalReference: z.string().trim().min(3).max(500),
      reason: z.string().trim().min(5).max(2000),
      operationId: id,
    }),
  )
  .handler(async ({ context, data }) =>
    regularizeLegacyContract(
      context.supabase,
      await getActiveWorkspaceId(context.supabase, context.userId),
      data,
    ),
  );

export const openContractLegacyEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id, evidenceId: id }))
  .handler(async ({ context, data }) =>
    openLegacyEvidence(
      context.supabase,
      await getActiveWorkspaceId(context.supabase, context.userId),
      data.contractId,
      data.evidenceId,
    ),
  );
