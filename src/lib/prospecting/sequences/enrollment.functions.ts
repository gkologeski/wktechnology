import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { enrollmentInput } from "./enrollment";
import { SEQUENCE_RESOURCE } from "./draft";
export const prepareProspectingSequenceEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "assign")])
  .inputValidator((input: unknown) => enrollmentInput.parse(input))
  .handler(async ({ context, data }) => {
    const { prepareSequenceEnrollment } = await import("./enrollment.server");
    return prepareSequenceEnrollment(context.supabase, data);
  });
export const listProspectingSequenceCohorts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((input: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), versionId: z.string().uuid() })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { listSequenceCohorts } = await import("./enrollment.server");
    return listSequenceCohorts(context.supabase, data.workspaceId, data.versionId);
  });
