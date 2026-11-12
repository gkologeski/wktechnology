// Server functions da importação contínua (finas: validação + delegação).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeImportSchedule } from "@/lib/integrations/import-schedule/schedule.server";

const provider = z.enum(["clockify", "jibble", "clickup"]);

export const getImportSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/integrations/import-schedule/schedule.server");
    const ctx = await authorizeImportSchedule(
      context.supabase,
      context.userId,
      data.provider,
      false,
    );
    return s.getSchedule(context.supabase, ctx, data.provider);
  });

export const saveImportSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider,
        enabled: z.boolean(),
        frequency: z.enum(["hourly", "every_6h", "every_12h", "daily", "weekly"]),
        runHour: z.number().int().min(0).max(23),
        runWeekday: z.number().int().min(0).max(6),
        mode: z.enum(["preview", "auto_import"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("@/lib/integrations/import-schedule/schedule.server");
    const ctx = await authorizeImportSchedule(
      context.supabase,
      context.userId,
      data.provider,
      true,
    );
    return s.saveSchedule(context.supabase, ctx, data);
  });

export const runImportScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = await authorizeImportSchedule(
      context.supabase,
      context.userId,
      data.provider,
      true,
    );
    const s = await import("@/lib/integrations/import-schedule/schedule.server");
    return s.runScheduleNow(ctx, data.provider);
  });
