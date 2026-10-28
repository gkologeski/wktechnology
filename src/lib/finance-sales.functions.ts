import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Lista as vendas importadas do Conta Azul (somente leitura). */
export const listFinanceSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        search: z.string().max(200).optional(),
        status: z.string().max(80).nullable().optional(),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        page: z.number().int().min(0).max(2000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, sales] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("./finance-sales.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return sales.listSales(context.supabase, workspaceId, context.userId, data);
  });
