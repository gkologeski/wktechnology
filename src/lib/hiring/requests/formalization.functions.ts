import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import {
  formalizationInput,
  formalizationAction,
  type FormalizationContext,
} from "./formalization-types";
export const getFormalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(formalizationInput)
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<FormalizationContext>(context.supabase, "hiring_formalization_context", {
      w,
      i: data.id,
    });
  });
export const actFormalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(formalizationAction)
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    if (data.action === "prepare")
      return {
        result: await workRpc<string>(context.supabase, "hiring_formalization_prepare", {
          w,
          i: data.id,
          rev: data.revision,
        }),
      };
    return {
      result: await workRpc<string>(context.supabase, "hiring_formalization_transition", {
        w,
        i: data.id,
        rev: data.revision,
        action: data.action,
        note: data.note,
      }),
    };
  });
export const requestHiringDraftCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().uuid() }))
  .handler(async ({ data }) => {
    const key = process.env["AI_KEYS_ENCRYPTION_KEY"];
    if (!key) throw new Error("Verificação de e-mail indisponível.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requestDraftCode } = await import("./draft-code.server");
    await workRpc(supabaseAdmin, "hiring_draft_public", { token: data.token });
    return requestDraftCode(supabaseAdmin, data.token, key, async (to, code, id) =>
      (await import("@/lib/email-templates/send-email")).sendTemplateEmail(
        "hiring-draft-code",
        to,
        { templateData: { code }, idempotencyKey: `hiring-draft-code:${id}` },
      ),
    );
  });
export const decideHiringDraft = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().uuid(),
      code: z.string().regex(/^\d{8}$/),
      decision: z.enum(["accept", "changes"]),
      note: z.string().max(4000).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env["AI_KEYS_ENCRYPTION_KEY"];
    if (!key) throw new Error("Verificação de e-mail indisponível.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const challenge = await workRpc<string>(supabaseAdmin, "hiring_draft_code_context", {
      token: data.token,
    });
    const { codeDigest } = await import("./draft-code.server");
    const result = await workRpc<{ ok: boolean; status: string; error?: string }>(
      supabaseAdmin,
      "hiring_draft_decide",
      {
        token: data.token,
        challenge,
        digest: codeDigest(key, data.token, challenge, data.code),
        decision: data.decision,
        note: data.note,
      },
    );
    if (!result.ok) throw new Error(result.error ?? "Resposta indisponível.");
    return result;
  });
export const downloadHiringDraftAttachment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().uuid(), annex: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const a = await workRpc<{ path: string; sha256: string; name: string }>(
      supabaseAdmin,
      "hiring_draft_attachment",
      data,
    );
    const file = await supabaseAdmin.storage.from("contract-attachments").download(a.path);
    if (file.error || !file.data) throw new Error("Anexo indisponível.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const { createHash } = await import("node:crypto");
    if (createHash("sha256").update(bytes).digest("hex") !== a.sha256)
      throw new Error("Integridade do anexo inválida.");
    await workRpc(supabaseAdmin, "hiring_draft_attachment", data);
    return { name: a.name, mime: file.data.type, base64: Buffer.from(bytes).toString("base64") };
  });
