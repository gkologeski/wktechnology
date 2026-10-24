import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { financeRpc } from "./finance-records.server";
export type FinanceCapability = {
  id: string;
  can_update: boolean;
  can_delete: boolean;
  can_cancel: boolean;
  can_pay: boolean;
  can_reverse: boolean;
};
export const getFinanceCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(input))
  .handler(
    async ({ data, context }): Promise<FinanceCapability[]> =>
      (await financeRpc(context.supabase, "finance_entry_capabilities", { _ids: data.ids })) ?? [],
  );
