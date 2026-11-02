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
    const { resolveEmailSender } = await import("./drafts.server");
    const sender = await resolveEmailSender(context.userId, data.workspaceId);
    return saveDraft(context.supabase, data, sender);
  });
export const getSequenceEmailSender = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ context, data }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    if ((await resolveActiveWorkspace(context.userId)) !== data.workspaceId)
      throw new Error("Workspace indisponível.");
    const { resolveEmailSender } = await import("./drafts.server");
    return resolveEmailSender(context.userId, data.workspaceId);
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

export const preflightProspectingSequence = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        expectedRevision: z.number().int().min(1),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { preflightSequence } = await import("./releases.server");
    return preflightSequence(context.supabase, data);
  });
export const createProspectingSequenceVersion = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "manage")])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        expectedRevision: z.number().int().min(1),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { createSequenceVersion } = await import("./releases.server");
    return createSequenceVersion(context.supabase, data);
  });
export const getProspectingSequenceTemplates = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((input: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), accountId: z.string().uuid() })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { sequenceTemplates } = await import("./releases.server");
    const { describeTemplate } = await import("@/lib/whatsapp/template-shape");
    return (
      await sequenceTemplates(context.supabase, context.userId, data.workspaceId, data.accountId)
    ).map((t) => ({
      name: t.name,
      language: t.language,
      status: t.status,
      ...describeTemplate(t.components),
    }));
  });
export const listProspectingSequenceVersions = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission(SEQUENCE_RESOURCE, "view")])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        expectedRevision: z.number().int().min(1),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { listSequenceVersions } = await import("./releases.server");
    return listSequenceVersions(context.supabase, data);
  });
