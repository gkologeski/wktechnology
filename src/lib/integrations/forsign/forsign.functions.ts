import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema } from "@/lib/email-schema";
import {
  cancelForUser,
  getContractOps,
  getSettings,
  refreshForUser,
  saveSettings,
  sendContract,
  testSettings,
} from "./forsign-service.server";

export const getForsignSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getSettings(context.supabase, context.userId));

export const saveForsignSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      apiKey: z.string().trim().min(16).max(512).optional(),
      webhookSecret: z.string().trim().min(16).max(512).optional(),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => saveSettings(context.supabase, context.userId, data));

export const testForsignSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => testSettings(context.supabase, context.userId));

export const getContractForsign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: z.string().uuid() }))
  .handler(async ({ context, data }) =>
    getContractOps(context.supabase, context.userId, data.contractId),
  );

export const sendContractForsign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: z.string().uuid(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      signers: z
        .array(
          z.object({
            name: z.string().trim().min(2).max(255),
            email: emailSchema(255),
            cpf: z.string().trim().max(20).nullable().optional(),
            role: z.string().trim().min(2).max(60),
          }),
        )
        .min(1)
        .max(10),
    }),
  )
  .handler(async ({ context, data }) => sendContract(context.supabase, context.userId, data));

export const refreshContractForsign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ operationRowId: z.string().uuid() }))
  .handler(async ({ context, data }) =>
    refreshForUser(context.supabase, context.userId, data.operationRowId),
  );

export const cancelContractForsign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ operationRowId: z.string().uuid(), message: z.string().trim().min(5).max(500) }),
  )
  .handler(async ({ context, data }) =>
    cancelForUser(context.supabase, context.userId, data.operationRowId, data.message),
  );
