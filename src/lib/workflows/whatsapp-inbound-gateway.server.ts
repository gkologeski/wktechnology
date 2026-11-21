import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { gatewayConfigured, getConnectedPhone } from "@/lib/whatsapp/gateway-channel.server";

export type WorkflowWhatsAppSourceIssue = "lovable_unavailable" | "lovable_unmapped";
const phoneSchema = z.object({
  id: z.string().regex(/^[0-9]{5,30}$/),
  display_phone_number: z
    .string()
    .max(50)
    .regex(/^[+0-9() .-]+$/)
    .transform((value) => "+" + value.replace(/\D/g, ""))
    .refine((value) => /^\+[1-9][0-9]{6,14}$/.test(value)),
});

/** Only an authenticated gateway read can attest its current business number.
 * The private RPC derives the unique workspace/account; no actor supplies it.
 * This runs when configuring filters, never adds HTTP work to inbound receipts. */
export async function refreshWorkflowWhatsAppGateway(
  serviceClient?: SupabaseClient,
): Promise<WorkflowWhatsAppSourceIssue | null> {
  const client =
    serviceClient ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const observe = async (phone: string | null, display: string | null) =>
    z.boolean().parse(
      await workRpc(client, "notification_whatsapp_gateway_observe", {
        p_phone: phone,
        p_display: display,
      }),
    );
  if (!gatewayConfigured()) {
    await observe(null, null);
    return "lovable_unavailable";
  }
  let phone: z.infer<typeof phoneSchema>;
  try {
    phone = phoneSchema.parse(await getConnectedPhone());
  } catch {
    // A failed/invalid provider read must not leave an earlier number eligible.
    // Database failures propagate instead of claiming a successful invalidation.
    await observe(null, null);
    return "lovable_unavailable";
  }
  return (await observe(phone.id, phone.display_phone_number)) ? null : "lovable_unmapped";
}
