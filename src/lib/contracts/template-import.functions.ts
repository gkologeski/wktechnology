// Server functions para importar MODELOS de contrato a partir de .docx/.pdf.
// O diálogo usa a rota em fluxo /api/contracts/template-import; estas funções
// permanecem por compatibilidade e delegam ao mesmo conversor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImportedTemplate } from "./template-import.server";
export type { ImportedTemplate };

export const parseContractTemplatePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ filename: z.string().min(1).max(255), base64: z.string().min(20).max(30_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { assertAnyPermission } = await import("@/lib/access-control/enforce.server");
    const m = await import("./template-import.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, workspaceId, m.TEMPLATE_IMPORT_PERMISSIONS);
    return m.convertTemplateWithAi(
      [
        { type: "text", text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras.` },
        { type: "file", file: { filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` } },
      ],
      { userId: context.userId, workspaceId },
    );
  });

export const parseContractTemplateHtml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ filename: z.string().min(1).max(255), html: z.string().min(40).max(400_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { assertAnyPermission } = await import("@/lib/access-control/enforce.server");
    const m = await import("./template-import.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertAnyPermission(context.supabase, context.userId, workspaceId, m.TEMPLATE_IMPORT_PERMISSIONS);
    return m.convertTemplateWithAi(
      [{ type: "text", text: `Converta o contrato "${data.filename}" em um modelo reutilizável conforme as regras. Conteúdo em HTML:\n\n${data.html}` }],
      { userId: context.userId, workspaceId },
    );
  });
