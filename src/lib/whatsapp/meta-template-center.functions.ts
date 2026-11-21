import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";
import { metaTemplateDraftSchema } from "./meta-template-definition";
import { MetaTemplateService } from "./meta-template-center.server";

const workspaceInput = z.object({ workspaceId: z.string().uuid() }).strict();
const targetInput = workspaceInput
  .extend({ targetId: z.string().regex(/^(cloud|lovable):[0-9a-f-]{36}$/) })
  .strict();
const itemInput = targetInput
  .extend({
    templateId: z.string().regex(/^\d{5,30}$/),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
function service(
  context: { supabase: any; userId: string; activeWorkspaceId: string },
  workspaceId: string,
) {
  if (context.activeWorkspaceId !== workspaceId)
    throw new Error("Selecione o workspace autorizado antes de abrir os modelos.");
  return new MetaTemplateService(context.supabase, context.userId, workspaceId);
}
export const getMetaTemplateContext = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => workspaceInput.parse(input))
  .handler(({ context, data }) => service(context, data.workspaceId).authorize());
export const listMetaTemplates = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    targetInput
      .extend({ cursor: z.string().min(1).max(4096).optional() })
      .strict()
      .parse(input),
  )
  .handler(({ context, data }) =>
    service(context, data.workspaceId).list(data.targetId, data.cursor),
  );
export const createMetaTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    targetInput.extend({ draft: metaTemplateDraftSchema }).strict().parse(input),
  )
  .handler(({ context, data }) =>
    service(context, data.workspaceId).create(data.targetId, data.draft),
  );
export const updateMetaTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    itemInput.extend({ draft: metaTemplateDraftSchema }).strict().parse(input),
  )
  .handler(({ context, data }) =>
    service(context, data.workspaceId).update(
      data.targetId,
      data.templateId,
      data.expectedFingerprint,
      data.draft,
    ),
  );
export const inspectMetaTemplateDeletion = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) => itemInput.parse(input))
  .handler(({ context, data }) =>
    service(context, data.workspaceId).inspectDeletion(
      data.targetId,
      data.templateId,
      data.expectedFingerprint,
    ),
  );
export const deleteMetaTemplate = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    itemInput
      .extend({
        name: z.string().min(1).max(512),
        language: z.string().min(2).max(30),
        confirmAllLanguages: z.boolean(),
        expectedVariantIds: z
          .array(z.string().regex(/^\d{5,30}$/))
          .min(1)
          .max(1000),
      })
      .strict()
      .parse(input),
  )
  .handler(({ context, data }) =>
    service(context, data.workspaceId).remove(
      data.targetId,
      data.templateId,
      data.expectedFingerprint,
      data.name,
      data.language,
      data.confirmAllLanguages,
      data.expectedVariantIds,
    ),
  );
export const uploadMetaTemplateSample = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
  .inputValidator((input) =>
    targetInput
      .extend({
        action: z.enum(["create", "update"]),
        appId: z.string().regex(/^\d{5,30}$/),
        filename: z
          .string()
          .min(1)
          .max(180)
          .refine(
            (name) =>
              !/[/\\]/.test(name) && ![...name].some((character) => character.charCodeAt(0) < 32),
            "Nome de arquivo inválido.",
          ),
        mimeType: z.enum(["image/jpeg", "image/png", "video/mp4", "application/pdf"]),
        base64: z
          .string()
          .min(4)
          .max(Math.ceil((16 * 1024 * 1024) / 3) * 4)
          .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
      })
      .strict()
      .parse(input),
  )
  .handler(({ context, data }) =>
    service(context, data.workspaceId).upload(
      data.targetId,
      data.action,
      data.appId,
      data.filename,
      data.mimeType,
      data.base64,
    ),
  );
