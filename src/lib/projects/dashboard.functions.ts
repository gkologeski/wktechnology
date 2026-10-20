import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadProjectDashboard } from "./dashboard.server";
import { isIanaTimeZone, validateIsoRange } from "./reconciliation-labels";

export const getProjectDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ from: z.string().date(), to: z.string().date(), tz: z.string().min(1).max(64) })
      .superRefine((v, ctx) => {
        const msg = validateIsoRange(v.from, v.to);
        if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
        if (!isIanaTimeZone(v.tz))
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fuso horário inválido." });
      })
      .parse(input),
  )
  .handler(async ({ context, data }) =>
    loadProjectDashboard(context.supabase, data.from, data.to, data.tz),
  );
