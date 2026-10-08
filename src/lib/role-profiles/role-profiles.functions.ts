// Server functions finas dos perfis de vaga. Regras em ./service.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();
const TitleLinksZ = z
  .object({ jobProfileId: id.nullable().optional(), presetId: id.nullable().optional() })
  .strict();

async function ctxOf(context: { supabase: unknown; userId: string }) {
  const { getActiveWorkspaceId } = await import("@/lib/access-control/enforce.server");
  const supabase = context.supabase as import("./service.server").Ctx["supabase"];
  return {
    supabase,
    userId: context.userId,
    workspaceId: await getActiveWorkspaceId(supabase, context.userId),
  };
}

export const listDealRoleProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.listForDeal(await ctxOf(context), data.dealId);
  });

export const getRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return JSON.parse(JSON.stringify(await s.getDetail(await ctxOf(context), data.id)));
  });

export const createRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dealId: id,
        header: z.unknown(),
        data: z.unknown().optional(),
        templateId: id.optional(),
        duplicateOf: id.optional(),
        importId: id.optional(),
        links: z
          .object({
            sourceLineItemId: id.optional(),
            jobProfileId: id.optional(),
            presetId: id.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.createProfile(await ctxOf(context), { ...data, header: data.header });
  });

export const saveRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        expectedRevision: z.number().int(),
        header: z.unknown(),
        data: z.unknown(),
        commercial: z.unknown().optional(),
        links: TitleLinksZ.optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.saveProfile(await ctxOf(context), { ...data, header: data.header, data: data.data });
  });

export const setRoleProfileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        to: z.enum(["draft", "awaiting_info", "in_validation", "approved", "forwarded"]),
        expectedRevision: z.number().int(),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.setStatus(await ctxOf(context), data);
  });

export const approveRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id, expectedRevision: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.approve(await ctxOf(context), data);
  });

export const forwardRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id, early: z.boolean(), reason: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.forward(await ctxOf(context), data);
  });

export const syncRoleProfileAts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.syncAts(await ctxOf(context), data.id);
  });

export const saveRoleProfileTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ profileId: id, name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.saveTemplate(await ctxOf(context), data);
  });

export const archiveRoleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.archive(await ctxOf(context), data.id);
  });

export const createRoleProfileShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        allowedFields: z.array(z.string().max(80)).max(40),
        days: z.number().int().min(1).max(30),
        maxWrites: z.number().int().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.createShareLink(await ctxOf(context), data);
  });

export const revokeRoleProfileShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ linkId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.revokeShareLink(await ctxOf(context), data.linkId);
  });

export const reviewRoleProfileProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        proposalId: id,
        action: z.enum(["apply", "reject"]),
        expectedRevision: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.reviewProposal(await ctxOf(context), data);
  });

export const uploadRoleProfileAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        filename: z.string().min(1).max(255),
        base64: z.string().min(8).max(14_500_000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    const ctx = await ctxOf(context);
    await s.loadProfile(ctx, data.id);
    return s.uploadAttachment(ctx, data);
  });

export const getRoleProfileAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attachmentId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.attachmentUrl(await ctxOf(context), data.attachmentId);
  });

export const removeRoleProfileAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ attachmentId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.removeAttachment(await ctxOf(context), data.attachmentId);
  });

export const listRoleProfileConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.listDealConversations(await ctxOf(context), data.dealId);
  });

export const listRoleProfileTitleOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./service.server");
    return s.listTitleOptions(await ctxOf(context));
  });

export const createRoleProfilesFromLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealId: id, lineItemIds: z.array(id).min(1).max(50) }).strict().parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.createFromLines(await ctxOf(context), data);
  });

export const saveRoleProfilesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z
          .array(
            z
              .object({
                id,
                expectedRevision: z.number().int(),
                header: z.unknown(),
                data: z.unknown(),
                links: TitleLinksZ.optional(),
              })
              .strict(),
          )
          .min(1)
          .max(50),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const s = await import("./service.server");
    return s.saveMany(
      await ctxOf(context),
      data.items.map((i) => ({ ...i, header: i.header, data: i.data })),
    );
  });

export const resolveRoleProfileApprover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const a = await import("./approval.server");
    return a.resolveApprover(await ctxOf(context), data.dealId);
  });

export const requestRoleProfileValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dealId: id,
        expected: z.record(id, z.number().int()),
        key: z.string().min(8).max(120),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const a = await import("./approval.server");
    return a.requestValidation(await ctxOf(context), data);
  });

export const retryRoleProfileApprovalDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requestId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const a = await import("./approval.server");
    return a.dispatchRequest(await ctxOf(context), data.requestId);
  });

export const decideRoleProfileApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: id,
        decision: z.enum(["approve", "request_changes"]),
        comment: z.string().max(1000).optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const a = await import("./approval.server");
    return a.decide(await ctxOf(context), data);
  });

export const listRoleProfileApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dealId: id }).parse(d))
  .handler(async ({ context, data }) => {
    const a = await import("./approval.server");
    return a.listApprovals(await ctxOf(context), data.dealId);
  });
