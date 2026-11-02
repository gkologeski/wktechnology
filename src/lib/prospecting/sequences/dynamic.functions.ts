import { createServerFn } from "@tanstack/react-start";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { SEQUENCE_RESOURCE, subscriptionInput } from "./draft";
export const setProspectingSequenceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "manage")])
  .inputValidator((input: unknown) => subscriptionInput.parse(input))
  .handler(async ({ context, data }) => {
    const { setSequenceSubscription } = await import("./dynamic.server");
    return setSequenceSubscription(context.supabase, data);
  });
