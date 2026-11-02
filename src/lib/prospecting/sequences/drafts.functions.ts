import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { definitionSchema, saveDraftSchema, SEQUENCE_RESOURCE } from "./draft";
export const listProspectingSequenceDrafts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => {
    const { listDrafts } = await import("./drafts.server");
    return listDrafts(context.supabase, data.workspaceId);
  });
export const saveProspectingSequenceDraft = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, ["create", "update"])])
  .inputValidator((i: unknown) => saveDraftSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { saveDraft } = await import("./drafts.server");
    return saveDraft(context.supabase, data);
  });
export const previewProspectingSequenceAudience = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        audience: definitionSchema.innerType().shape.audience,
      })
      .strict()
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { previewDraftAudience } = await import("./drafts.server");
    return previewDraftAudience(context.supabase, context.userId, data.workspaceId, data.audience);
  });
