import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRecordWhatsAppSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ entity: z.enum(["contact", "lead"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadRecordSuppressions } = await import("./whatsapp-suppression-access.server");
    return loadRecordSuppressions(context.supabase, data.entity, data.id);
  });

export const releaseWhatsAppSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { releaseSuppression } = await import("./whatsapp-suppression-access.server");
    await releaseSuppression(context.supabase, data.id);
    return { ok: true as const };
  });

export const getWhatsAppSuppressionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadSuppressionStats } = await import("./whatsapp-suppression-access.server");
    return loadSuppressionStats(context.supabase, data.workspaceId);
  });
