import { AI_PANEL_PAGE_SIZE, DB_PAGE_MAX_ROWS } from "@/lib/limits";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const Filters = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  feature: z.string().max(60).optional(),
  triggerSource: z.enum(["user", "automatic"]).optional(),
  provider: z.string().max(40).optional(),
  status: z.enum(["success", "failed"]).optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().min(0).max(10000).default(0),
  pageSize: z.number().int().min(10).max(DB_PAGE_MAX_ROWS).default(AI_PANEL_PAGE_SIZE),
});

export type AiUsageFilters = z.infer<typeof Filters>;

export const getAiUsageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: Filters.shape.from, to: Filters.shape.to }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadUsageSummary } = await import("./ai-usage.server");
    return loadUsageSummary(context.supabase, context.userId, data.from, data.to);
  });

export const listAiCallLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Filters.parse(d))
  .handler(async ({ data, context }) => {
    const { loadCallLogs } = await import("./ai-usage.server");
    return loadCallLogs(context.supabase, context.userId, data);
  });
