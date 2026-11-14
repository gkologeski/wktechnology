import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
export const sendContractSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.esign", "send")])
  .inputValidator(
    z.object({
      contractId: z.string().uuid(),
      documentId: z.string().uuid(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      requestId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { dispatchContractSignature } = await import("./signature-delivery.server");
    return dispatchContractSignature(context.supabase, data, {
      admin: async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin,
      send: async (to, templateData, idempotencyKey) =>
        (await import("@/lib/email-templates/send-email")).sendTemplateEmail(
          "contract-signature-request",
          to,
          { templateData, idempotencyKey },
        ),
    });
  });
