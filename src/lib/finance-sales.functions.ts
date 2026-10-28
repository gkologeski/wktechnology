import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";

/** Lista as vendas importadas do Conta Azul (somente leitura). */
export const listFinanceSales = createServerFn({ method: "POST" })
  .middleware([requireWorkspaceContext()])
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
    const sales = await import("./finance-sales.server");
    // Membro ativo e workspace selecionado já validados; a permissão é checada no servidor e na RLS.
    return sales.listSales(context.supabase, context.activeWorkspaceId, context.userId, data);
  });
