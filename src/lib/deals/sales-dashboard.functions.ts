// RPC do painel inicial do TechSales. Arquivo fino: apenas valida a entrada
// e delega a agregação para `sales-dashboard.server.ts`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { loadSalesDashboard } from "./sales-dashboard.server";
import type { SalesDashboardData } from "./sales-dashboard.types";

const InputSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    pipelineId: z.string().uuid().nullable().default(null),
    leadPipelineId: z.string().uuid().nullable().default(null),
    channel: z
      .enum([
        "prospecting",
        "website",
        "paid",
        "organic",
        "referral",
        "offline",
        "import",
        "other",
        "unknown",
      ])
      .nullable()
      .default(null),
    assignee: z
      .union([z.enum(["__all__", "__me__", "__none__"]), z.string().uuid()])
      .default("__all__"),
  })
  .refine(
    (v) => {
      const a = Date.parse(v.from);
      const b = Date.parse(v.to);
      return a <= b && b - a <= 2 * 366 * 24 * 60 * 60 * 1000;
    },
    { message: "Período inválido (máximo de 2 anos)." },
  );

export const getSalesDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<SalesDashboardData> => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return loadSalesDashboard(context.supabase, context.userId, workspaceId, data);
  });
