// TechProjects — assistente de análise somente leitura (ver assistant.core.ts / assistant.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askProjectsAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        question: z.string().trim().min(3).max(500),
        filters: z.object({
          from: z.string().date(),
          to: z.string().date(),
          tz: z.string().min(1).max(64),
          project: z.string().uuid().optional(),
          company: z.string().uuid().optional(),
          service: z.string().uuid().optional(),
          leader: z.string().uuid().optional(),
          person: z.string().uuid().optional(),
          origin: z.string().max(20).optional(),
          status: z.string().max(20).optional(),
          currency: z
            .string()
            .regex(/^[A-Z]{3}$/)
            .optional(),
        }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const { askAssistant, aiModelCaller, assertAssistantQuota } =
      await import("./assistant.server");
    const { isIanaTimeZone, validateIsoRange } = await import("./reconciliation-labels");
    const rangeErr = validateIsoRange(data.filters.from, data.filters.to);
    if (rangeErr) throw new Error(rangeErr);
    if (!isIanaTimeZone(data.filters.tz)) throw new Error("Fuso horário inválido.");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertAssistantQuota(context.userId, workspaceId);
    return askAssistant(context.supabase, data, {
      userId: context.userId,
      callModel: aiModelCaller({ workspaceId, userId: context.userId }),
    });
  });
