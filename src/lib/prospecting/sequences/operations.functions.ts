import { createServerFn } from "@tanstack/react-start";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { SEQUENCE_RESOURCE } from "./draft";
import { operationsInput, operationInput } from "./draft";
export const getSequenceOperations = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((input: unknown) => operationsInput.parse(input))
  .handler(async ({ context, data }) => {
    const { sequenceOperations } = await import("./operations.server");
    return sequenceOperations(context.supabase, data);
  });
export const runSequenceOperation = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "manage")])
  .inputValidator((input: unknown) => operationInput.parse(input))
  .handler(async ({ context, data }) => {
    const { operateSequence } = await import("./operations.server");
    return operateSequence(context.supabase, data);
  });
