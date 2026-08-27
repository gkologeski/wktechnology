// RPC do painel inicial do TechSales. Arquivo fino: apenas valida a entrada
// e delega a agregação para `sales-dashboard.server.ts`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { loadSalesDashboard } from "./sales-dashboard.server";
import type { SalesDashboardData } from "./sales-dashboard.types";

const InputSchema = z.object({
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
  pipelineId: z.string().uuid().nullable().default(null),
  scope: z.enum(["me", "team"]).default("me"),
});

export const getSalesDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<SalesDashboardData> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return loadSalesDashboard(context.supabase, context.userId, workspaceId, data);
  });
