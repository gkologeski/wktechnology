import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  loadRecordSuppressions,
  loadSuppressionStats,
  releaseSuppression,
} from "./whatsapp-suppression-access";

export const getRecordWhatsAppSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ entity: z.enum(["contact", "lead"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) =>
    loadRecordSuppressions(context.supabase, data.entity, data.id),
  );

export const releaseWhatsAppSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await releaseSuppression(context.supabase, data.id);
    return { ok: true as const };
  });

export const getWhatsAppSuppressionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => loadSuppressionStats(context.supabase, data.workspaceId));
